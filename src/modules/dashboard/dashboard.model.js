import db from '../../config/database.js';

export const dashboardModel = {
  /**
   * Retrieves summary metrics across all projects the user has access to.
   * Utilizes single high-performance SQL aggregation queries instead of loading rows into memory.
   */
  async getSummary(userId) {
    // 1. Find all project IDs accessible to the user (either directly via project_members or via org owner/admin)
    const accessibleProjectsQuery = db('projects as p')
      .leftJoin('project_members as pm', function () {
        this.on('p.project_id', '=', 'pm.project_id').andOn('pm.user_id', '=', db.raw('?', [userId]));
      })
      .leftJoin('organization_members as om', function () {
        this.on('p.organization_id', '=', 'om.organization_id').andOn('om.user_id', '=', db.raw('?', [userId]));
      })
      .where(function () {
        this.whereNotNull('pm.project_member_id')
          .orWhereIn('om.role', ['owner', 'admin']);
      })
      .distinct('p.project_id')
      .select('p.project_id');

    // 2. Count total accessible projects
    const totalProjectsResult = await db('projects')
      .whereIn('project_id', accessibleProjectsQuery)
      .count('project_id as total_projects')
      .first();

    const totalProjects = parseInt(totalProjectsResult?.total_projects || 0, 10);

    // 3. Aggregate task statistics scoped strictly to accessible projects
    // Uses conditional SQL aggregation: FILTER (WHERE ...)
    const taskAggregates = await db('tasks as t')
      .whereIn('t.project_id', accessibleProjectsQuery)
      .select([
        db.raw('COUNT(t.task_id) as total_tasks'),
        db.raw('COUNT(t.task_id) FILTER (WHERE t.assigned_to = ?) as my_assigned_tasks', [userId]),
        db.raw("COUNT(t.task_id) FILTER (WHERE t.status = 'done') as completed_tasks"),
        db.raw("COUNT(t.task_id) FILTER (WHERE t.due_date < CURRENT_DATE AND t.status != 'done') as overdue_tasks"),
        db.raw("COUNT(t.task_id) FILTER (WHERE t.priority = 'urgent' AND t.status != 'done') as urgent_tasks"),
      ])
      .first();

    // 4. Tasks grouped by status across accessible projects
    const statusCountsResult = await db('tasks as t')
      .whereIn('t.project_id', accessibleProjectsQuery)
      .groupBy('t.status')
      .select([
        't.status',
        db.raw('COUNT(t.task_id) as count'),
      ]);

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
   * Retrieves active tasks assigned directly to the user across all accessible projects
   */
  async getMyTasks(userId, { offset, limit }) {
    const accessibleProjectsQuery = db('projects as p')
      .leftJoin('project_members as pm', function () {
        this.on('p.project_id', '=', 'pm.project_id').andOn('pm.user_id', '=', db.raw('?', [userId]));
      })
      .leftJoin('organization_members as om', function () {
        this.on('p.organization_id', '=', 'om.organization_id').andOn('om.user_id', '=', db.raw('?', [userId]));
      })
      .where(function () {
        this.whereNotNull('pm.project_member_id').orWhereIn('om.role', ['owner', 'admin']);
      })
      .select('p.project_id');

    const baseQuery = db('tasks as t')
      .join('projects as p', 't.project_id', 'p.project_id')
      .where('t.assigned_to', userId)
      .whereIn('t.project_id', accessibleProjectsQuery);

    const totalResult = await baseQuery.clone().count('t.task_id as total').first();
    const total = parseInt(totalResult?.total || 0, 10);

    const tasks = await baseQuery
      .clone()
      .select([
        't.task_id',
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
