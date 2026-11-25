import { SYSTEM_PERMISSIONS, DEFAULT_EMPLOYEE_PERMISSION_KEYS } from '../src/constants/permissions.js';

/**
 * Multi-Tenant SaaS & Dynamic RBAC Schema Migration (Non-Destructive)
 *
 * Preserves ALL existing users, organizations, projects, tasks, and activity logs by
 * creating a Default Organization tenant and backfilling tenant_id across all tenant tables.
 * Adds composite (tenant_id, *) unique keys and foreign keys to prevent cross-tenant leaks
 * at the PostgreSQL database level.
 */
export async function up(knex) {
  // =========================================================================
  // A. PLATFORM TABLES (super_admins, tenants, subscription_plans, tenant_subscriptions)
  // =========================================================================

  const hasSuperAdmins = await knex.schema.hasTable('super_admins');
  if (!hasSuperAdmins) {
    await knex.schema.createTable('super_admins', (table) => {
      table.bigIncrements('super_admin_id').primary();
      table.string('full_name', 150).notNullable();
      table.string('email', 255).notNullable().unique();
      table.string('password_hash', 255).notNullable();
      table.boolean('is_active').notNullable().defaultTo(true);
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    });
  }

  const hasTenants = await knex.schema.hasTable('tenants');
  if (!hasTenants) {
    await knex.schema.createTable('tenants', (table) => {
      table.bigIncrements('tenant_id').primary();
      table.string('company_name', 180).notNullable();
      table.string('slug', 120).notNullable().unique();
      table.string('email', 255).notNullable();
      table.string('phone', 40);
      table.string('website', 255);
      table.text('address');
      table.text('description');
      table.text('logo_url');
      table.string('status', 30).notNullable().defaultTo('active');
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    });

    await knex.raw(`
      ALTER TABLE tenants
      ADD CONSTRAINT chk_tenants_status
      CHECK (status IN ('active', 'inactive', 'suspended'));
    `);
    await knex.raw(`CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants (status);`);
    await knex.raw(`CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_email_lower ON tenants (LOWER(email));`);
  }

  const hasPlans = await knex.schema.hasTable('subscription_plans');
  if (!hasPlans) {
    await knex.schema.createTable('subscription_plans', (table) => {
      table.bigIncrements('plan_id').primary();
      table.string('plan_name', 100).notNullable().unique();
      table.text('description');
      table.integer('max_employees').notNullable().defaultTo(25);
      table.integer('max_projects').notNullable().defaultTo(10);
      table.decimal('price', 10, 2).notNullable().defaultTo(0);
      table.string('billing_cycle', 30).notNullable().defaultTo('monthly');
      table.boolean('is_active').notNullable().defaultTo(true);
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    });

    await knex.raw(`
      ALTER TABLE subscription_plans
      ADD CONSTRAINT chk_subscription_plans_cycle
      CHECK (billing_cycle IN ('monthly', 'yearly', 'custom'));
    `);
  }

  const hasTenantSubs = await knex.schema.hasTable('tenant_subscriptions');
  if (!hasTenantSubs) {
    await knex.schema.createTable('tenant_subscriptions', (table) => {
      table.bigIncrements('subscription_id').primary();
      table
        .bigInteger('tenant_id')
        .notNullable()
        .references('tenant_id')
        .inTable('tenants')
        .onDelete('CASCADE');
      table
        .bigInteger('plan_id')
        .notNullable()
        .references('plan_id')
        .inTable('subscription_plans')
        .onDelete('RESTRICT');
      table.date('start_date').notNullable().defaultTo(knex.raw('CURRENT_DATE'));
      table.date('end_date');
      table.integer('max_employees');
      table.integer('max_projects');
      table.string('status', 30).notNullable().defaultTo('active');
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    });

    await knex.raw(`
      ALTER TABLE tenant_subscriptions
      ADD CONSTRAINT chk_tenant_subscriptions_status
      CHECK (status IN ('active', 'trial', 'expired', 'cancelled'));
    `);
    await knex.raw(`CREATE INDEX IF NOT EXISTS idx_tenant_subs_tenant ON tenant_subscriptions (tenant_id, status);`);
  }

  // =========================================================================
  // B. DYNAMIC RBAC TABLES (roles, permissions, role_permissions)
  // =========================================================================

  const hasRoles = await knex.schema.hasTable('roles');
  if (!hasRoles) {
    await knex.schema.createTable('roles', (table) => {
      table.bigIncrements('role_id').primary();
      table
        .bigInteger('tenant_id')
        .notNullable()
        .references('tenant_id')
        .inTable('tenants')
        .onDelete('CASCADE');
      table.string('role_name', 100).notNullable();
      table.text('description');
      table.boolean('is_system_role').notNullable().defaultTo(false);
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());

      table.unique(['tenant_id', 'role_id'], 'uq_roles_tenant_role');
    });
    await knex.raw(`CREATE UNIQUE INDEX IF NOT EXISTS uq_roles_tenant_name_lower ON roles (tenant_id, LOWER(role_name));`);
    await knex.raw(`CREATE INDEX IF NOT EXISTS idx_roles_tenant ON roles (tenant_id);`);
  }

  const hasPermissions = await knex.schema.hasTable('permissions');
  if (!hasPermissions) {
    await knex.schema.createTable('permissions', (table) => {
      table.bigIncrements('permission_id').primary();
      table.string('permission_key', 100).notNullable().unique();
      table.string('module_name', 60).notNullable();
      table.string('action_name', 40).notNullable();
      table.text('description');
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    });
    await knex.raw(`CREATE INDEX IF NOT EXISTS idx_permissions_module ON permissions (module_name);`);
  }

  const hasRolePermissions = await knex.schema.hasTable('role_permissions');
  if (!hasRolePermissions) {
    await knex.schema.createTable('role_permissions', (table) => {
      table.bigIncrements('role_permission_id').primary();
      table
        .bigInteger('role_id')
        .notNullable()
        .references('role_id')
        .inTable('roles')
        .onDelete('CASCADE');
      table
        .bigInteger('permission_id')
        .notNullable()
        .references('permission_id')
        .inTable('permissions')
        .onDelete('CASCADE');
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());

      table.unique(['role_id', 'permission_id'], 'uq_role_permissions_pair');
    });
    await knex.raw(`CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions (role_id);`);
  }

  // =========================================================================
  // C. SEED CANONICAL PLANS, PERMISSIONS, AND DEFAULT TENANT FOR EXISTING DATA
  // =========================================================================

  const defaultPlans = [
    {
      plan_name: 'Starter',
      description: 'Ideal for small teams getting started with Team Task Board.',
      max_employees: 15,
      max_projects: 10,
      price: 0,
      billing_cycle: 'monthly',
      is_active: true,
    },
    {
      plan_name: 'Professional',
      description: 'Built for growing engineering and product organizations.',
      max_employees: 75,
      max_projects: 50,
      price: 49.0,
      billing_cycle: 'monthly',
      is_active: true,
    },
    {
      plan_name: 'Business',
      description: 'Advanced workflows, unlimited collaboration, and custom roles.',
      max_employees: 250,
      max_projects: 200,
      price: 129.0,
      billing_cycle: 'monthly',
      is_active: true,
    },
    {
      plan_name: 'Enterprise',
      description: 'Large-scale multi-department workspace with generous limits.',
      max_employees: 1000,
      max_projects: 1000,
      price: 299.0,
      billing_cycle: 'monthly',
      is_active: true,
    },
  ];

  for (const plan of defaultPlans) {
    await knex('subscription_plans').insert(plan).onConflict('plan_name').ignore();
  }

  for (const perm of SYSTEM_PERMISSIONS) {
    await knex('permissions').insert(perm).onConflict('permission_key').ignore();
  }

  // Create default tenant to hold any pre-existing data without data loss
  let defaultTenant = await knex('tenants').where('slug', 'default-org').first();
  if (!defaultTenant) {
    const [inserted] = await knex('tenants')
      .insert({
        company_name: 'Team Task Board Default Organization',
        slug: 'default-org',
        email: 'admin@default-org.teamtaskboard.local',
        description: 'Default workspace migrated from existing Team Task Board records.',
        status: 'active',
      })
      .returning('*');
    defaultTenant = inserted;
  }

  const enterprisePlan = await knex('subscription_plans').where('plan_name', 'Enterprise').first();
  if (enterprisePlan) {
    const existingDefaultSub = await knex('tenant_subscriptions')
      .where('tenant_id', defaultTenant.tenant_id)
      .first();
    if (!existingDefaultSub) {
      await knex('tenant_subscriptions').insert({
        tenant_id: defaultTenant.tenant_id,
        plan_id: enterprisePlan.plan_id,
        start_date: knex.raw('CURRENT_DATE'),
        end_date: knex.raw("CURRENT_DATE + INTERVAL '1 year'"),
        max_employees: enterprisePlan.max_employees,
        max_projects: enterprisePlan.max_projects,
        status: 'active',
      });
    }
  }

  // =========================================================================
  // D. UPGRADE `users` TABLE & CREATE `user_roles`
  // =========================================================================

  const userCols = [
    { name: 'tenant_id', add: (t) => t.bigInteger('tenant_id').references('tenant_id').inTable('tenants').onDelete('CASCADE') },
    { name: 'employee_code', add: (t) => t.string('employee_code', 60) },
    { name: 'phone', add: (t) => t.string('phone', 40) },
    { name: 'department', add: (t) => t.string('department', 100) },
    { name: 'designation', add: (t) => t.string('designation', 100) },
  ];

  for (const col of userCols) {
    const exists = await knex.schema.hasColumn('users', col.name);
    if (!exists) {
      await knex.schema.alterTable('users', (table) => col.add(table));
    }
  }

  await knex('users').whereNull('tenant_id').update({ tenant_id: defaultTenant.tenant_id });

  await knex.raw(`ALTER TABLE users ALTER COLUMN tenant_id SET NOT NULL;`);

  // Replace global UNIQUE(email) with tenant-scoped UNIQUE(tenant_id, email)
  await knex.raw(`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_key;`);
  await knex.raw(`CREATE UNIQUE INDEX IF NOT EXISTS uq_users_tenant_email_lower ON users (tenant_id, LOWER(email));`);
  await knex.raw(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_users_tenant_user') THEN
        ALTER TABLE users ADD CONSTRAINT uq_users_tenant_user UNIQUE (tenant_id, user_id);
      END IF;
    END $$;
  `);
  await knex.raw(`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_users_tenant_employee_code
    ON users (tenant_id, LOWER(employee_code))
    WHERE employee_code IS NOT NULL AND employee_code <> '';
  `);
  await knex.raw(`CREATE INDEX IF NOT EXISTS idx_users_tenant_active ON users (tenant_id, is_active);`);

  // Create user_roles with composite FKs guaranteeing same-tenant user & role
  const hasUserRoles = await knex.schema.hasTable('user_roles');
  if (!hasUserRoles) {
    await knex.schema.createTable('user_roles', (table) => {
      table.bigIncrements('user_role_id').primary();
      table
        .bigInteger('tenant_id')
        .notNullable()
        .references('tenant_id')
        .inTable('tenants')
        .onDelete('CASCADE');
      table.bigInteger('user_id').notNullable();
      table.bigInteger('role_id').notNullable();
      table.bigInteger('assigned_by').references('user_id').inTable('users').onDelete('SET NULL');
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());

      table.unique(['user_id', 'role_id'], 'uq_user_roles_pair');
    });

    await knex.raw(`
      ALTER TABLE user_roles
      ADD CONSTRAINT fk_user_roles_tenant_user
      FOREIGN KEY (tenant_id, user_id)
      REFERENCES users (tenant_id, user_id)
      ON DELETE CASCADE;
    `);
    await knex.raw(`
      ALTER TABLE user_roles
      ADD CONSTRAINT fk_user_roles_tenant_role
      FOREIGN KEY (tenant_id, role_id)
      REFERENCES roles (tenant_id, role_id)
      ON DELETE RESTRICT;
    `);
    await knex.raw(`CREATE INDEX IF NOT EXISTS idx_user_roles_tenant_user ON user_roles (tenant_id, user_id);`);
    await knex.raw(`CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles (role_id);`);
  }

  // Create default tenant's Company Admin & Employee roles and assign existing users
  let defaultAdminRole = await knex('roles')
    .where({ tenant_id: defaultTenant.tenant_id })
    .whereRaw('LOWER(role_name) = ?', ['company admin'])
    .first();

  if (!defaultAdminRole) {
    [defaultAdminRole] = await knex('roles')
      .insert({
        tenant_id: defaultTenant.tenant_id,
        role_name: 'Company Admin',
        description: 'Full administrative access to manage employees, roles, projects, tasks, and settings.',
        is_system_role: true,
      })
      .returning('*');
  }

  let defaultEmployeeRole = await knex('roles')
    .where({ tenant_id: defaultTenant.tenant_id })
    .whereRaw('LOWER(role_name) = ?', ['employee'])
    .first();

  if (!defaultEmployeeRole) {
    [defaultEmployeeRole] = await knex('roles')
      .insert({
        tenant_id: defaultTenant.tenant_id,
        role_name: 'Employee',
        description: 'Standard company team member role.',
        is_system_role: false,
      })
      .returning('*');
  }

  const allPermissions = await knex('permissions').select('permission_id', 'permission_key');
  for (const perm of allPermissions) {
    await knex('role_permissions')
      .insert({ role_id: defaultAdminRole.role_id, permission_id: perm.permission_id })
      .onConflict(['role_id', 'permission_id'])
      .ignore();

    if (DEFAULT_EMPLOYEE_PERMISSION_KEYS.includes(perm.permission_key)) {
      await knex('role_permissions')
        .insert({ role_id: defaultEmployeeRole.role_id, permission_id: perm.permission_id })
        .onConflict(['role_id', 'permission_id'])
        .ignore();
    }
  }

  // Assign existing users on default tenant (grant Company Admin to existing users so none lose access)
  const existingUsers = await knex('users').where('tenant_id', defaultTenant.tenant_id).select('user_id');
  for (const u of existingUsers) {
    const hasAnyRole = await knex('user_roles').where('user_id', u.user_id).first();
    if (!hasAnyRole) {
      await knex('user_roles')
        .insert({
          tenant_id: defaultTenant.tenant_id,
          user_id: u.user_id,
          role_id: defaultAdminRole.role_id,
        })
        .onConflict(['user_id', 'role_id'])
        .ignore();
    }
  }

  // =========================================================================
  // E. UPGRADE EXISTING TENANT-OWNED TABLES WITH tenant_id & COMPOSITE FKs
  // =========================================================================

  // 1. organizations (legacy compatibility — associate with tenant_id)
  if (await knex.schema.hasTable('organizations')) {
    if (!(await knex.schema.hasColumn('organizations', 'tenant_id'))) {
      await knex.schema.alterTable('organizations', (table) => {
        table.bigInteger('tenant_id').references('tenant_id').inTable('tenants').onDelete('CASCADE');
      });
    }
    await knex('organizations').whereNull('tenant_id').update({ tenant_id: defaultTenant.tenant_id });
    await knex.raw(`CREATE INDEX IF NOT EXISTS idx_organizations_tenant ON organizations (tenant_id);`);
  }

  // 2. projects
  if (!(await knex.schema.hasColumn('projects', 'tenant_id'))) {
    await knex.schema.alterTable('projects', (table) => {
      table.bigInteger('tenant_id').references('tenant_id').inTable('tenants').onDelete('CASCADE');
    });
  }
  await knex('projects').whereNull('tenant_id').update({ tenant_id: defaultTenant.tenant_id });
  await knex.raw(`ALTER TABLE projects ALTER COLUMN tenant_id SET NOT NULL;`);
  await knex.raw(`ALTER TABLE projects ALTER COLUMN organization_id DROP NOT NULL;`);
  await knex.raw(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_projects_tenant_project') THEN
        ALTER TABLE projects ADD CONSTRAINT uq_projects_tenant_project UNIQUE (tenant_id, project_id);
      END IF;
    END $$;
  `);
  await knex.raw(`CREATE UNIQUE INDEX IF NOT EXISTS uq_projects_tenant_key_upper ON projects (tenant_id, UPPER(project_key));`);
  await knex.raw(`CREATE INDEX IF NOT EXISTS idx_projects_tenant_status ON projects (tenant_id, status);`);

  // 3. project_members
  if (!(await knex.schema.hasColumn('project_members', 'tenant_id'))) {
    await knex.schema.alterTable('project_members', (table) => {
      table.bigInteger('tenant_id').references('tenant_id').inTable('tenants').onDelete('CASCADE');
    });
  }
  await knex.raw(`
    UPDATE project_members pm
    SET tenant_id = p.tenant_id
    FROM projects p
    WHERE pm.project_id = p.project_id AND pm.tenant_id IS NULL;
  `);
  await knex('project_members').whereNull('tenant_id').update({ tenant_id: defaultTenant.tenant_id });
  await knex.raw(`ALTER TABLE project_members ALTER COLUMN tenant_id SET NOT NULL;`);
  await knex.raw(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_project_members_tenant_project') THEN
        ALTER TABLE project_members
        ADD CONSTRAINT fk_project_members_tenant_project
        FOREIGN KEY (tenant_id, project_id) REFERENCES projects (tenant_id, project_id) ON DELETE CASCADE;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_project_members_tenant_user') THEN
        ALTER TABLE project_members
        ADD CONSTRAINT fk_project_members_tenant_user
        FOREIGN KEY (tenant_id, user_id) REFERENCES users (tenant_id, user_id) ON DELETE CASCADE;
      END IF;
    END $$;
  `);
  await knex.raw(`CREATE INDEX IF NOT EXISTS idx_project_members_tenant_user ON project_members (tenant_id, user_id);`);

  // 4. tasks
  if (!(await knex.schema.hasColumn('tasks', 'tenant_id'))) {
    await knex.schema.alterTable('tasks', (table) => {
      table.bigInteger('tenant_id').references('tenant_id').inTable('tenants').onDelete('CASCADE');
    });
  }
  await knex.raw(`
    UPDATE tasks t
    SET tenant_id = p.tenant_id
    FROM projects p
    WHERE t.project_id = p.project_id AND t.tenant_id IS NULL;
  `);
  await knex('tasks').whereNull('tenant_id').update({ tenant_id: defaultTenant.tenant_id });
  await knex.raw(`ALTER TABLE tasks ALTER COLUMN tenant_id SET NOT NULL;`);
  await knex.raw(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_tasks_tenant_task') THEN
        ALTER TABLE tasks ADD CONSTRAINT uq_tasks_tenant_task UNIQUE (tenant_id, task_id);
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_tasks_tenant_project') THEN
        ALTER TABLE tasks
        ADD CONSTRAINT fk_tasks_tenant_project
        FOREIGN KEY (tenant_id, project_id) REFERENCES projects (tenant_id, project_id) ON DELETE CASCADE;
      END IF;
    END $$;
  `);
  await knex.raw(`CREATE INDEX IF NOT EXISTS idx_tasks_tenant_project_status ON tasks (tenant_id, project_id, status);`);
  await knex.raw(`CREATE INDEX IF NOT EXISTS idx_tasks_tenant_assignee ON tasks (tenant_id, assigned_to);`);

  // 5. task_comments
  if (!(await knex.schema.hasColumn('task_comments', 'tenant_id'))) {
    await knex.schema.alterTable('task_comments', (table) => {
      table.bigInteger('tenant_id').references('tenant_id').inTable('tenants').onDelete('CASCADE');
    });
  }
  await knex.raw(`
    UPDATE task_comments c
    SET tenant_id = t.tenant_id
    FROM tasks t
    WHERE c.task_id = t.task_id AND c.tenant_id IS NULL;
  `);
  await knex('task_comments').whereNull('tenant_id').update({ tenant_id: defaultTenant.tenant_id });
  await knex.raw(`ALTER TABLE task_comments ALTER COLUMN tenant_id SET NOT NULL;`);
  await knex.raw(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_task_comments_tenant_task') THEN
        ALTER TABLE task_comments
        ADD CONSTRAINT fk_task_comments_tenant_task
        FOREIGN KEY (tenant_id, task_id) REFERENCES tasks (tenant_id, task_id) ON DELETE CASCADE;
      END IF;
    END $$;
  `);
  await knex.raw(`CREATE INDEX IF NOT EXISTS idx_task_comments_tenant_task ON task_comments (tenant_id, task_id);`);

  // 6. task_attachments (also align file_size -> file_size_bytes)
  const hasFileSize = await knex.schema.hasColumn('task_attachments', 'file_size');
  const hasFileSizeBytes = await knex.schema.hasColumn('task_attachments', 'file_size_bytes');
  if (hasFileSize && !hasFileSizeBytes) {
    await knex.schema.alterTable('task_attachments', (table) => {
      table.renameColumn('file_size', 'file_size_bytes');
    });
  } else if (!hasFileSizeBytes) {
    await knex.schema.alterTable('task_attachments', (table) => {
      table.bigInteger('file_size_bytes');
    });
  }

  if (!(await knex.schema.hasColumn('task_attachments', 'tenant_id'))) {
    await knex.schema.alterTable('task_attachments', (table) => {
      table.bigInteger('tenant_id').references('tenant_id').inTable('tenants').onDelete('CASCADE');
    });
  }
  await knex.raw(`
    UPDATE task_attachments a
    SET tenant_id = t.tenant_id
    FROM tasks t
    WHERE a.task_id = t.task_id AND a.tenant_id IS NULL;
  `);
  await knex('task_attachments').whereNull('tenant_id').update({ tenant_id: defaultTenant.tenant_id });
  await knex.raw(`ALTER TABLE task_attachments ALTER COLUMN tenant_id SET NOT NULL;`);
  await knex.raw(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_task_attachments_tenant_task') THEN
        ALTER TABLE task_attachments
        ADD CONSTRAINT fk_task_attachments_tenant_task
        FOREIGN KEY (tenant_id, task_id) REFERENCES tasks (tenant_id, task_id) ON DELETE CASCADE;
      END IF;
    END $$;
  `);
  await knex.raw(`CREATE INDEX IF NOT EXISTS idx_task_attachments_tenant_task ON task_attachments (tenant_id, task_id);`);

  // 7. task_labels
  if (!(await knex.schema.hasColumn('task_labels', 'tenant_id'))) {
    await knex.schema.alterTable('task_labels', (table) => {
      table.bigInteger('tenant_id').references('tenant_id').inTable('tenants').onDelete('CASCADE');
    });
  }
  await knex.raw(`
    UPDATE task_labels l
    SET tenant_id = p.tenant_id
    FROM projects p
    WHERE l.project_id = p.project_id AND l.tenant_id IS NULL;
  `);
  await knex('task_labels').whereNull('tenant_id').update({ tenant_id: defaultTenant.tenant_id });
  await knex.raw(`ALTER TABLE task_labels ALTER COLUMN tenant_id SET NOT NULL;`);
  await knex.raw(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_task_labels_tenant_project') THEN
        ALTER TABLE task_labels
        ADD CONSTRAINT fk_task_labels_tenant_project
        FOREIGN KEY (tenant_id, project_id) REFERENCES projects (tenant_id, project_id) ON DELETE CASCADE;
      END IF;
    END $$;
  `);
  await knex.raw(`CREATE INDEX IF NOT EXISTS idx_task_labels_tenant_project ON task_labels (tenant_id, project_id);`);

  // 8. task_activity_logs
  if (!(await knex.schema.hasColumn('task_activity_logs', 'tenant_id'))) {
    await knex.schema.alterTable('task_activity_logs', (table) => {
      table.bigInteger('tenant_id').references('tenant_id').inTable('tenants').onDelete('CASCADE');
    });
  }
  await knex.raw(`
    UPDATE task_activity_logs al
    SET tenant_id = t.tenant_id
    FROM tasks t
    WHERE al.task_id = t.task_id AND al.tenant_id IS NULL;
  `);
  await knex('task_activity_logs').whereNull('tenant_id').update({ tenant_id: defaultTenant.tenant_id });
  await knex.raw(`ALTER TABLE task_activity_logs ALTER COLUMN tenant_id SET NOT NULL;`);
  await knex.raw(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_task_activity_tenant_task') THEN
        ALTER TABLE task_activity_logs
        ADD CONSTRAINT fk_task_activity_tenant_task
        FOREIGN KEY (tenant_id, task_id) REFERENCES tasks (tenant_id, task_id) ON DELETE CASCADE;
      END IF;
    END $$;
  `);
  await knex.raw(`CREATE INDEX IF NOT EXISTS idx_task_activity_tenant_task ON task_activity_logs (tenant_id, task_id);`);

  // 9. notifications
  if (!(await knex.schema.hasColumn('notifications', 'tenant_id'))) {
    await knex.schema.alterTable('notifications', (table) => {
      table.bigInteger('tenant_id').references('tenant_id').inTable('tenants').onDelete('CASCADE');
    });
  }
  await knex.raw(`
    UPDATE notifications n
    SET tenant_id = u.tenant_id
    FROM users u
    WHERE n.user_id = u.user_id AND n.tenant_id IS NULL;
  `);
  await knex('notifications').whereNull('tenant_id').update({ tenant_id: defaultTenant.tenant_id });
  await knex.raw(`ALTER TABLE notifications ALTER COLUMN tenant_id SET NOT NULL;`);
  await knex.raw(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_notifications_tenant_user') THEN
        ALTER TABLE notifications
        ADD CONSTRAINT fk_notifications_tenant_user
        FOREIGN KEY (tenant_id, user_id) REFERENCES users (tenant_id, user_id) ON DELETE CASCADE;
      END IF;
    END $$;
  `);
  await knex.raw(`CREATE INDEX IF NOT EXISTS idx_notifications_tenant_user ON notifications (tenant_id, user_id, is_read);`);
}

export async function down() {
  // Intentionally non-destructive: do not drop multi-tenant tables or lose tenant data automatically.
}
