import db from '../../config/database.js';
import tenantModel from '../tenants/tenant.model.js';

export const dashboardModel = {
  /**
   * Retrieves summary metrics across projects accessible to the user strictly within their tenant.
   */
  async getSummary(userId, tenantId = null, canViewAll = false) {
    const accessibleProjectsQuery = db('projects as p');

    if (tenantId) {
      accessibleProjectsQuery.where('p.tenant_id', tenantId);
    }

    if (!canViewAll) {
      accessibleProjectsQuery
        .leftJoin('project_members as pm', function () {
          this.on('p.project_id', '=', 'pm.project_id').andOn('pm.user_id', '=', db.raw('?', [userId]));
        })
        .leftJoin('organization_members as om', function () {
          this.on('p.organization_id', '=', 'om.organization_id').andOn('om.user_id', '=', db.raw('?', [userId]));
        })
        .where(function () {
          this.whereNotNull('pm.project_member_id').orWhereIn('om.role', ['owner', 'admin']);
        });
    }

    accessibleProjectsQuery.distinct('p.project_id').select('p.project_id');

    const totalProjectsResult = await db('projects')
      .whereIn('project_id', accessibleProjectsQuery)
      .count('project_id as total_projects')
      .first();

    const totalProjects = parseInt(totalProjectsResult?.total_projects || 0, 10);

    const taskBase = db('tasks as t').whereIn('t.project_id', accessibleProjectsQuery);
    if (tenantId) taskBase.andWhere('t.tenant_id', tenantId);

    const taskAggregates = await taskBase
      .clone()
      .select([
        db.raw('COUNT(t.task_id) as total_tasks'),
        db.raw('COUNT(t.task_id) FILTER (WHERE t.assigned_to = ?) as my_assigned_tasks', [userId]),
        db.raw("COUNT(t.task_id) FILTER (WHERE t.status = 'done') as completed_tasks"),
        db.raw("COUNT(t.task_id) FILTER (WHERE t.due_date < CURRENT_DATE AND t.status != 'done') as overdue_tasks"),
        db.raw("COUNT(t.task_id) FILTER (WHERE t.priority = 'urgent' AND t.status != 'done') as urgent_tasks"),
      ])
      .first();

    const statusCountsResult = await taskBase
      .clone()
      .groupBy('t.status')
      .select(['t.status', db.raw('COUNT(t.task_id) as count')]);

    const tasksByStatus = {
      backlog: 0,
      todo: 0,
      in_progress: 0,
      in_review: 0,
      done: 0,
      cancelled: 0,
    };

    for (const row of statusCountsResult) {
      tasksByStatus[row.status] = parseInt(row.count, 10);
    }

    return {
      totalProjects,
      totalTasks: parseInt(taskAggregates?.total_tasks || 0, 10),
      myAssignedTasks: parseInt(taskAggregates?.my_assigned_tasks || 0, 10),
      completedTasks: parseInt(taskAggregates?.completed_tasks || 0, 10),
      overdueTasks: parseInt(taskAggregates?.overdue_tasks || 0, 10),
      urgentTasks: parseInt(taskAggregates?.urgent_tasks || 0, 10),
      tasksByStatus,
    };
  },

  /**
   * Company Admin Dashboard metrics — STRICTLY isolated to a single tenantId.
   * Never exposes platform-wide or cross-tenant data.
   */
  async getCompanyDashboard(tenantId) {
    const [tenant, subscription, empStats, projStats, taskStats, statusBreakdown, projectProgress, roleDistribution] =
      await Promise.all([
        tenantModel.findById(tenantId),
        tenantModel.getActiveSubscription(tenantId),
        db('users')
          .where('tenant_id', tenantId)
          .select([
            db.raw('COUNT(*)::int as total_employees'),
            db.raw('COUNT(*) FILTER (WHERE is_active = true)::int as active_employees'),
            db.raw('COUNT(*) FILTER (WHERE is_active = false)::int as inactive_employees'),
          ])
          .first(),
        db('projects')
          .where('tenant_id', tenantId)
          .select([
            db.raw('COUNT(*)::int as total_projects'),
            db.raw("COUNT(*) FILTER (WHERE status = 'active')::int as active_projects"),
            db.raw("COUNT(*) FILTER (WHERE status = 'completed')::int as completed_projects"),
          ])
          .first(),
        db('tasks')
          .where('tenant_id', tenantId)
          .select([
            db.raw('COUNT(*)::int as total_tasks'),
            db.raw("COUNT(*) FILTER (WHERE status = 'done')::int as completed_tasks"),
            db.raw("COUNT(*) FILTER (WHERE status != 'done')::int as pending_tasks"),
            db.raw("COUNT(*) FILTER (WHERE due_date < CURRENT_DATE AND status != 'done')::int as overdue_tasks"),
          ])
          .first(),
        db('tasks')
          .where('tenant_id', tenantId)
          .groupBy('status')
          .select(['status', db.raw('COUNT(*)::int as count')]),
        db('projects as p')
          .where('p.tenant_id', tenantId)
          .select([
            'p.project_id',
            'p.name',
            'p.project_key',
            'p.status',
            'p.due_date',
            db.raw('(SELECT COUNT(*)::int FROM project_members pm WHERE pm.project_id = p.project_id AND pm.tenant_id = p.tenant_id) as member_count'),
            db.raw('(SELECT COUNT(*)::int FROM tasks t WHERE t.project_id = p.project_id AND t.tenant_id = p.tenant_id) as total_tasks'),
            db.raw("(SELECT COUNT(*)::int FROM tasks t WHERE t.project_id = p.project_id AND t.tenant_id = p.tenant_id AND t.status = 'done') as completed_tasks"),
          ])
          .orderBy('p.created_at', 'desc')
          .limit(8),
        db('roles as r')
          .where('r.tenant_id', tenantId)
          .select([
            'r.role_id',
            'r.role_name',
            'r.is_system_role',
            db.raw('(SELECT COUNT(*)::int FROM user_roles ur WHERE ur.role_id = r.role_id AND ur.tenant_id = r.tenant_id) as employee_count'),
          ])
          .orderBy('r.is_system_role', 'desc')
          .orderBy('r.role_name', 'asc'),
      ]);

    const tasksByStatus = {
      backlog: 0,
      todo: 0,
      in_progress: 0,
      in_review: 0,
      done: 0,
    };
    for (const row of statusBreakdown) {
      tasksByStatus[row.status] = row.count;
    }

    return {
      company: tenant,
      subscription,
      metrics: {
        totalEmployees: empStats?.total_employees || 0,
        activeEmployees: empStats?.active_employees || 0,
        inactiveEmployees: empStats?.inactive_employees || 0,
        totalProjects: projStats?.total_projects || 0,
        activeProjects: projStats?.active_projects || 0,
        completedProjects: projStats?.completed_projects || 0,
        totalTasks: taskStats?.total_tasks || 0,
        completedTasks: taskStats?.completed_tasks || 0,
        pendingTasks: taskStats?.pending_tasks || 0,
        overdueTasks: taskStats?.overdue_tasks || 0,
      },
      tasksByStatus,
      projectProgress,
      roleDistribution,
    };
  },

  /**
   * Retrieves active tasks assigned directly to the user across accessible tenant projects
   */
  async getMyTasks(userId, { offset, limit }, tenantId = null, canViewAll = false) {
    const baseQuery = db('tasks as t')
      .join('projects as p', 't.project_id', 'p.project_id')
      .where('t.assigned_to', userId);

    if (tenantId) {
      baseQuery.andWhere('t.tenant_id', tenantId).andWhere('p.tenant_id', tenantId);
    }

    if (!canViewAll) {
      baseQuery.whereExists(function () {
        this.select(1)
          .from('project_members as pm')
          .whereRaw('pm.project_id = t.project_id')
          .andWhere('pm.user_id', userId);
        if (tenantId) this.andWhere('pm.tenant_id', tenantId);
      });
    }

    const totalResult = await baseQuery.clone().count('t.task_id as total').first();
    const total = parseInt(totalResult?.total || 0, 10);

    const tasks = await baseQuery
      .clone()
      .select([
        't.task_id',
        't.tenant_id',
        't.project_id',
        'p.name as project_name',
        'p.project_key',
        't.title',
        't.status',
        't.priority',
        't.due_date',
        't.position',
        't.completed_at',
        't.created_at',
      ])
      .orderByRaw("CASE WHEN t.status = 'done' THEN 1 ELSE 0 END ASC, t.due_date ASC NULLS LAST, t.position ASC")
      .offset(offset)
      .limit(limit);

    return { tasks, total };
  },
};

export default dashboardModel;
