import db from '../../config/database.js';

export const SAFE_TENANT_PUBLIC_COLUMNS = [
  'tenant_id',
  'company_name',
  'slug',
  'logo_url',
  'description',
  'status',
];

export const TENANT_COLUMNS = [
  'tenant_id',
  'company_name',
  'slug',
  'email',
  'phone',
  'website',
  'address',
  'description',
  'logo_url',
  'status',
  'created_at',
  'updated_at',
];

export const tenantModel = {
  async findById(tenantId) {
    return db('tenants').select(TENANT_COLUMNS).where('tenant_id', tenantId).first();
  },

  async findBySlug(slug) {
    if (!slug) return null;
    return db('tenants')
      .select(TENANT_COLUMNS)
      .whereRaw('LOWER(slug) = ?', [slug.trim().toLowerCase()])
      .first();
  },

  async findPublicBySlug(slug) {
    if (!slug) return null;
    return db('tenants')
      .select(SAFE_TENANT_PUBLIC_COLUMNS)
      .whereRaw('LOWER(slug) = ?', [slug.trim().toLowerCase()])
      .first();
  },

  async findByEmail(email) {
    if (!email) return null;
    return db('tenants')
      .select(TENANT_COLUMNS)
      .whereRaw('LOWER(email) = ?', [email.trim().toLowerCase()])
      .first();
  },

  async getDefaultTenant() {
    const defaultOrg = await db('tenants').where('slug', 'default-org').first();
    if (defaultOrg) return defaultOrg;
    return db('tenants').orderBy('tenant_id', 'asc').first();
  },

  async getActiveSubscription(tenantId) {
    return db('tenant_subscriptions as ts')
      .join('subscription_plans as sp', 'ts.plan_id', 'sp.plan_id')
      .where('ts.tenant_id', tenantId)
      .orderBy('ts.created_at', 'desc')
      .select([
        'ts.subscription_id',
        'ts.tenant_id',
        'ts.plan_id',
        'sp.plan_name',
        'sp.price',
        'sp.billing_cycle',
        'ts.start_date',
        'ts.end_date',
        db.raw('COALESCE(ts.max_employees, sp.max_employees) as max_employees'),
        db.raw('COALESCE(ts.max_projects, sp.max_projects) as max_projects'),
        'ts.status',
      ])
      .first();
  },

  async listAll({ search, status, offset = 0, limit = 20 }) {
    const baseQuery = db('tenants as t');

    if (status && ['active', 'inactive', 'suspended'].includes(status)) {
      baseQuery.where('t.status', status);
    }

    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      baseQuery.where(function () {
        this.whereILike('t.company_name', term)
          .orWhereILike('t.slug', term)
          .orWhereILike('t.email', term);
      });
    }

    const totalRow = await baseQuery.clone().count('t.tenant_id as total').first();
    const total = parseInt(totalRow?.total || 0, 10);

    const rows = await baseQuery
      .clone()
      .leftJoin(
        db.raw(`(
          SELECT DISTINCT ON (tenant_id)
            tenant_id, subscription_id, plan_id, start_date, end_date, max_employees, max_projects, status
          FROM tenant_subscriptions
          ORDER BY tenant_id, created_at DESC
        ) as ts`),
        't.tenant_id',
        'ts.tenant_id'
      )
      .leftJoin('subscription_plans as sp', 'ts.plan_id', 'sp.plan_id')
      .select([
        't.tenant_id',
        't.company_name',
        't.slug',
        't.email',
        't.phone',
        't.website',
        't.address',
        't.description',
        't.logo_url',
        't.status',
        't.created_at',
        't.updated_at',
        'sp.plan_id',
        'sp.plan_name',
        'sp.price as plan_price',
        'sp.billing_cycle',
        'ts.subscription_id',
        'ts.start_date as subscription_start_date',
        'ts.end_date as subscription_end_date',
        'ts.status as subscription_status',
        db.raw('COALESCE(ts.max_employees, sp.max_employees, 50) as max_employees'),
        db.raw('COALESCE(ts.max_projects, sp.max_projects, 20) as max_projects'),
        db.raw('(SELECT COUNT(*)::int FROM users u WHERE u.tenant_id = t.tenant_id) as employee_count'),
        db.raw('(SELECT COUNT(*)::int FROM users u WHERE u.tenant_id = t.tenant_id AND u.is_active = true) as active_employee_count'),
        db.raw('(SELECT COUNT(*)::int FROM projects p WHERE p.tenant_id = t.tenant_id) as project_count'),
      ])
      .orderBy('t.created_at', 'desc')
      .offset(offset)
      .limit(limit);

    return { tenants: rows, total };
  },

  async findByIdWithDetails(tenantId) {
    const tenant = await db('tenants as t')
      .where('t.tenant_id', tenantId)
      .select([
        't.*',
        db.raw('(SELECT COUNT(*)::int FROM users u WHERE u.tenant_id = t.tenant_id) as employee_count'),
        db.raw('(SELECT COUNT(*)::int FROM users u WHERE u.tenant_id = t.tenant_id AND u.is_active = true) as active_employee_count'),
        db.raw('(SELECT COUNT(*)::int FROM projects p WHERE p.tenant_id = t.tenant_id) as project_count'),
        db.raw('(SELECT COUNT(*)::int FROM tasks tk WHERE tk.tenant_id = t.tenant_id) as task_count'),
        db.raw('(SELECT COUNT(*)::int FROM roles r WHERE r.tenant_id = t.tenant_id) as role_count'),
      ])
      .first();

    if (!tenant) return null;

    const subscription = await this.getActiveSubscription(tenantId);
    const admins = await db('users as u')
      .join('user_roles as ur', function () {
        this.on('u.user_id', '=', 'ur.user_id').andOn('u.tenant_id', '=', 'ur.tenant_id');
      })
      .join('roles as r', 'ur.role_id', 'r.role_id')
      .where({ 'u.tenant_id': tenantId, 'r.is_system_role': true })
      .select(['u.user_id', 'u.full_name', 'u.email', 'u.is_active', 'u.created_at']);

    return { ...tenant, subscription, admins };
  },

  async update(tenantId, updates) {
    const [updated] = await db('tenants')
      .where('tenant_id', tenantId)
      .update({
        ...updates,
        updated_at: db.fn.now(),
      })
      .returning(TENANT_COLUMNS);
    return updated;
  },

  async updateStatus(tenantId, status) {
    const [updated] = await db('tenants')
      .where('tenant_id', tenantId)
      .update({
        status,
        updated_at: db.fn.now(),
      })
      .returning(TENANT_COLUMNS);
    return updated;
  },

  async countUsage(tenantId) {
    const [empRow, projRow] = await Promise.all([
      db('users').where('tenant_id', tenantId).count('user_id as count').first(),
      db('projects').where('tenant_id', tenantId).count('project_id as count').first(),
    ]);
    return {
      employees: parseInt(empRow?.count || 0, 10),
      projects: parseInt(projRow?.count || 0, 10),
    };
  },
};

export default tenantModel;
