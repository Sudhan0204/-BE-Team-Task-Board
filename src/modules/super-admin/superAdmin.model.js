import db from '../../config/database.js';

export const SAFE_SUPER_ADMIN_COLUMNS = [
  'super_admin_id',
  'full_name',
  'email',
  'is_active',
  'created_at',
  'updated_at',
];

export const superAdminModel = {
  async findByEmail(email, includePassword = false) {
    const columns = includePassword
      ? [...SAFE_SUPER_ADMIN_COLUMNS, 'password_hash']
      : SAFE_SUPER_ADMIN_COLUMNS;

    return db('super_admins')
      .select(columns)
      .whereRaw('LOWER(email) = ?', [email.trim().toLowerCase()])
      .first();
  },

  async findById(superAdminId) {
    return db('super_admins')
      .select(SAFE_SUPER_ADMIN_COLUMNS)
      .where('super_admin_id', superAdminId)
      .first();
  },

  async getPlatformMetrics() {
    const [tenantStats, empStats, projectStats, taskStats, planOverview, recentCompanies] =
      await Promise.all([
        db('tenants')
          .select([
            db.raw('COUNT(*)::int as total_companies'),
            db.raw("COUNT(*) FILTER (WHERE status = 'active')::int as active_companies"),
            db.raw("COUNT(*) FILTER (WHERE status = 'inactive')::int as inactive_companies"),
            db.raw("COUNT(*) FILTER (WHERE status = 'suspended')::int as suspended_companies"),
          ])
          .first(),
        db('users')
          .select([
            db.raw('COUNT(*)::int as total_employees'),
            db.raw('COUNT(*) FILTER (WHERE is_active = true)::int as active_employees'),
          ])
          .first(),
        db('projects')
          .select([
            db.raw('COUNT(*)::int as total_projects'),
            db.raw("COUNT(*) FILTER (WHERE status = 'active')::int as active_projects"),
          ])
          .first(),
        db('tasks')
          .select([
            db.raw('COUNT(*)::int as total_tasks'),
            db.raw("COUNT(*) FILTER (WHERE status = 'done')::int as completed_tasks"),
          ])
          .first(),
        db('subscription_plans as sp')
          .leftJoin(
            db.raw(`(
              SELECT DISTINCT ON (tenant_id) tenant_id, plan_id, status
              FROM tenant_subscriptions
              ORDER BY tenant_id, created_at DESC
            ) as ts`),
            'sp.plan_id',
            'ts.plan_id'
          )
          .groupBy('sp.plan_id', 'sp.plan_name', 'sp.price', 'sp.billing_cycle', 'sp.max_employees', 'sp.max_projects')
          .select([
            'sp.plan_id',
            'sp.plan_name',
            'sp.price',
            'sp.billing_cycle',
            'sp.max_employees',
            'sp.max_projects',
            db.raw('COUNT(ts.tenant_id)::int as company_count'),
            db.raw("COUNT(ts.tenant_id) FILTER (WHERE ts.status IN ('active', 'trial'))::int as active_subscriptions"),
          ])
          .orderBy('sp.price', 'asc'),
        db('tenants as t')
          .select([
            't.tenant_id',
            't.company_name',
            't.slug',
            't.logo_url',
            't.status',
            't.created_at',
            db.raw('(SELECT COUNT(*)::int FROM users u WHERE u.tenant_id = t.tenant_id) as employee_count'),
            db.raw('(SELECT COUNT(*)::int FROM projects p WHERE p.tenant_id = t.tenant_id) as project_count'),
          ])
          .orderBy('t.created_at', 'desc')
          .limit(6),
      ]);

    const monthlyRecurringRevenue = planOverview.reduce(
      (sum, plan) => sum + Number(plan.price || 0) * Number(plan.active_subscriptions || 0),
      0
    );

    return {
      totalCompanies: tenantStats?.total_companies || 0,
      activeCompanies: tenantStats?.active_companies || 0,
      inactiveCompanies: tenantStats?.inactive_companies || 0,
      suspendedCompanies: tenantStats?.suspended_companies || 0,
      totalEmployees: empStats?.total_employees || 0,
      activeEmployees: empStats?.active_employees || 0,
      totalProjects: projectStats?.total_projects || 0,
      activeProjects: projectStats?.active_projects || 0,
      totalTasks: taskStats?.total_tasks || 0,
      completedTasks: taskStats?.completed_tasks || 0,
      monthlyRecurringRevenue,
      subscriptionOverview: planOverview,
      recentCompanies,
    };
  },

  async listPlans() {
    return db('subscription_plans as sp')
      .select([
        'sp.*',
        db.raw(`(
          SELECT COUNT(*)::int FROM (
            SELECT DISTINCT ON (tenant_id) tenant_id, plan_id
            FROM tenant_subscriptions
            ORDER BY tenant_id, created_at DESC
          ) sub WHERE sub.plan_id = sp.plan_id
        ) as assigned_companies`),
      ])
      .orderBy('sp.price', 'asc');
  },

  async findPlanById(planId) {
    return db('subscription_plans').where('plan_id', planId).first();
  },

  async createPlan(data) {
    const [plan] = await db('subscription_plans').insert(data).returning('*');
    return plan;
  },

  async updatePlan(planId, updates) {
    const [plan] = await db('subscription_plans')
      .where('plan_id', planId)
      .update(updates)
      .returning('*');
    return plan;
  },
};

export default superAdminModel;
