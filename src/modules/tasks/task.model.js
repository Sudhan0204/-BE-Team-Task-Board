import db from '../../config/database.js';

const TASK_RETURNING = [
  'task_id',
  'tenant_id',
  'project_id',
  'title',
  'description',
  'status',
  'priority',
  'created_by',
  'assigned_to',
  'due_date',
  'position',
  'completed_at',
  'created_at',
  'updated_at',
];

export const taskModel = {
  /**
   * Atomically creates a tenant-scoped task and writes the initial activity log.
   */
  async create({
    tenant_id,
    project_id,
    title,
    description,
    status,
    priority,
    created_by,
    assigned_to,
    due_date,
    position,
  }) {
    return db.transaction(async (trx) => {
      const [task] = await trx('tasks')
        .insert({
          tenant_id,
          project_id,
          title,
          description: description || null,
          status: status || 'backlog',
          priority: priority || 'medium',
          created_by,
          assigned_to: assigned_to || null,
          due_date: due_date || null,
          position: position ?? 1000,
        })
        .returning(TASK_RETURNING);

      await trx('task_activity_logs').insert({
        tenant_id,
        task_id: task.task_id,
        user_id: created_by,
        action: 'created',
        old_value: null,
        new_value: {
          title: task.title,
          status: task.status,
          priority: task.priority,
          assigned_to: task.assigned_to,
        },
      });

      return task;
    });
  },

  /**
   * Retrieves single task by ID (tenant-scoped) with assigned user and creator profiles.
   */
  async findById(taskId, tenantId = null) {
    const query = db('tasks as t')
      .leftJoin('users as a', 't.assigned_to', 'a.user_id')
      .join('users as c', 't.created_by', 'c.user_id')
      .join('projects as p', 't.project_id', 'p.project_id')
      .select([
        't.task_id',
        't.tenant_id',
        't.project_id',
        'p.name as project_name',
        'p.project_key',
        't.title',
        't.description',
        't.status',
        't.priority',
        't.created_by',
        't.assigned_to',
        't.due_date',
        't.position',
        't.completed_at',
        't.created_at',
        't.updated_at',
        'a.full_name as assignee_name',
        'a.email as assignee_email',
        'a.avatar_url as assignee_avatar',
        'c.full_name as creator_name',
        'c.email as creator_email',
      ])
      .where('t.task_id', taskId);

    if (tenantId) query.andWhere('t.tenant_id', tenantId);
    return query.first();
  },

  /**
   * Lists tasks across accessible tenant projects (top-level GET /api/tasks).
   */
  async listByTenant(tenantId, userId, { canViewAll = false, filters = {}, pagination }) {
    const query = db('tasks as t')
      .join('projects as p', function () {
        this.on('t.project_id', '=', 'p.project_id').andOn('t.tenant_id', '=', 'p.tenant_id');
      })
      .leftJoin('users as a', 't.assigned_to', 'a.user_id')
      .join('users as c', 't.created_by', 'c.user_id')
      .where('t.tenant_id', tenantId);

    if (!canViewAll) {
      query.whereExists(function () {
        this.select(1)
          .from('project_members as pm')
          .whereRaw('pm.project_id = t.project_id')
          .andWhere('pm.tenant_id', tenantId)
          .andWhere('pm.user_id', userId);
      });
    }

    if (filters.project_id) query.andWhere('t.project_id', filters.project_id);
    if (filters.status) query.andWhere('t.status', filters.status);
    if (filters.priority) query.andWhere('t.priority', filters.priority);
    if (filters.assigned_to) query.andWhere('t.assigned_to', filters.assigned_to);
    if (filters.search) query.andWhereILike('t.title', `%${filters.search}%`);

    const totalQuery = query.clone().count('t.task_id as total').first();
    const dataQuery = query
      .clone()
      .select([
        't.task_id',
        't.tenant_id',
        't.project_id',
        'p.name as project_name',
        'p.project_key',
        't.title',
        't.description',
        't.status',
        't.priority',
        't.created_by',
        't.assigned_to',
        't.due_date',
        't.position',
        't.completed_at',
        't.created_at',
        't.updated_at',
        'a.full_name as assignee_name',
        'a.email as assignee_email',
        'a.avatar_url as assignee_avatar',
        'c.full_name as creator_name',
      ])
      .orderBy(`t.${pagination.sortBy}`, pagination.sortOrder)
      .offset(pagination.offset)
      .limit(pagination.limit);

    const [totalResult, tasks] = await Promise.all([totalQuery, dataQuery]);
    return { tasks, total: parseInt(totalResult?.total || 0, 10) };
  },

  /**
   * Retrieves paginated tasks for a project with dynamic filtering and search (tenant-scoped).
   */
  async list({ projectId, tenantId = null, filters, pagination }) {
    const query = db('tasks as t')
      .leftJoin('users as a', 't.assigned_to', 'a.user_id')
      .join('users as c', 't.created_by', 'c.user_id')
      .where('t.project_id', projectId);

    if (tenantId) query.andWhere('t.tenant_id', tenantId);

    if (filters.status) query.andWhere('t.status', filters.status);
    if (filters.priority) query.andWhere('t.priority', filters.priority);
    if (filters.assigned_to) query.andWhere('t.assigned_to', filters.assigned_to);
    if (filters.due_date) query.andWhere('t.due_date', filters.due_date);
    if (filters.search) query.andWhereILike('t.title', `%${filters.search}%`);

    const totalQuery = query.clone().count('t.task_id as total').first();

    const dataQuery = query
      .clone()
      .select([
        't.task_id',
        't.tenant_id',
        't.project_id',
        't.title',
        't.description',
        't.status',
        't.priority',
        't.created_by',
        't.assigned_to',
        't.due_date',
        't.position',
        't.completed_at',
        't.created_at',
        't.updated_at',
        'a.full_name as assignee_name',
        'a.email as assignee_email',
        'a.avatar_url as assignee_avatar',
        'c.full_name as creator_name',
      ])
      .orderBy(`t.${pagination.sortBy}`, pagination.sortOrder)
      .offset(pagination.offset)
      .limit(pagination.limit);

    const [totalResult, tasks] = await Promise.all([totalQuery, dataQuery]);
    const total = parseInt(totalResult?.total || 0, 10);

    return { tasks, total };
  },

  /**
   * Retrieves all project tasks ordered by position for Kanban Board view (tenant-scoped).
   */
  async getBoardTasks(projectId, tenantId = null) {
    const query = db('tasks as t')
      .leftJoin('users as a', 't.assigned_to', 'a.user_id')
      .select([
        't.task_id',
        't.tenant_id',
        't.project_id',
        't.title',
        't.description',
        't.status',
        't.priority',
        't.created_by',
        't.assigned_to',
        't.due_date',
        't.position',
        't.completed_at',
        't.created_at',
        't.updated_at',
        'a.full_name as assignee_name',
        'a.avatar_url as assignee_avatar',
      ])
      .where('t.project_id', projectId)
      .orderBy('t.position', 'asc');

    if (tenantId) query.andWhere('t.tenant_id', tenantId);
    return query;
  },

  /**
   * Atomically updates a task and writes the corresponding diff into task_activity_logs.
   */
  async updateWithActivity(taskId, updates, userId, action, oldValue, newValue, tenantId = null) {
    return db.transaction(async (trx) => {
      const updateQuery = trx('tasks').where('task_id', taskId);
      if (tenantId) updateQuery.andWhere('tenant_id', tenantId);

      const [updatedTask] = await updateQuery
        .update({
          ...updates,
          updated_at: trx.fn.now(),
        })
        .returning(TASK_RETURNING);

      await trx('task_activity_logs').insert({
        tenant_id: updatedTask?.tenant_id || tenantId,
        task_id: taskId,
        user_id: userId,
        action,
        old_value: oldValue ? JSON.stringify(oldValue) : null,
        new_value: newValue ? JSON.stringify(newValue) : null,
      });

      return updatedTask;
    });
  },

  /**
   * Deletes a task (tenant-scoped)
   */
  async delete(taskId, tenantId = null) {
    const query = db('tasks').where('task_id', taskId);
    if (tenantId) query.andWhere('tenant_id', tenantId);
    return query.delete();
  },

  /**
   * Lists activity logs for a project or specific task (tenant-scoped)
   */
  async getActivityLogs(projectId, taskId = null, tenantId = null) {
    const query = db('task_activity_logs as l')
      .join('tasks as t', 'l.task_id', 't.task_id')
      .leftJoin('users as u', 'l.user_id', 'u.user_id')
      .select([
        'l.activity_id',
        'l.tenant_id',
        'l.task_id',
        'l.user_id',
        'l.action',
        'l.old_value',
        'l.new_value',
        'l.created_at',
        't.title as task_title',
        'u.full_name as user_name',
        'u.email as user_email',
        'u.avatar_url as user_avatar',
      ])
      .where('t.project_id', projectId)
      .orderBy('l.created_at', 'desc')
      .limit(100);

    if (tenantId) query.andWhere('l.tenant_id', tenantId);
    if (taskId) query.andWhere('l.task_id', taskId);

    return query;
  },
};

export default taskModel;
