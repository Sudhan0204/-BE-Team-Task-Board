import db from '../../config/database.js';

export const taskModel = {
  /**
   * Atomically creates a task and writes the initial activity log inside a transaction.
   */
  async create({ project_id, title, description, status, priority, created_by, assigned_to, due_date, position }) {
    return db.transaction(async (trx) => {
      // 1. Insert task
      const [task] = await trx('tasks')
        .insert({
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
        .returning([
          'task_id',
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
        ]);

      // 2. Record creation activity log
      await trx('task_activity_logs').insert({
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
   * Retrieves single task by ID with assigned user and creator profiles.
   */
  async findById(taskId) {
    return db('tasks as t')
      .leftJoin('users as a', 't.assigned_to', 'a.user_id')
      .join('users as c', 't.created_by', 'c.user_id')
      .select([
        't.task_id',
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
        'c.email as creator_email',
      ])
      .where('t.task_id', taskId)
      .first();
  },

  /**
   * Retrieves paginated tasks for a project with dynamic parameterized filtering and search.
   */
  async list({ projectId, filters, pagination }) {
    const query = db('tasks as t')
      .leftJoin('users as a', 't.assigned_to', 'a.user_id')
      .join('users as c', 't.created_by', 'c.user_id')
      .where('t.project_id', projectId);

    if (filters.status) {
      query.where('t.status', filters.status);
    }
    if (filters.priority) {
      query.where('t.priority', filters.priority);
    }
    if (filters.assigned_to) {
      query.where('t.assigned_to', filters.assigned_to);
    }
    if (filters.due_date) {
      query.where('t.due_date', filters.due_date);
    }
    if (filters.search) {
      query.whereILike('t.title', `%${filters.search}%`);
    }

    const totalQuery = query.clone().count('t.task_id as total').first();

    const dataQuery = query
      .clone()
      .select([
        't.task_id',
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
   * Retrieves all project tasks ordered by position for Kanban Board view.
   */
  async getBoardTasks(projectId) {
    return db('tasks as t')
      .leftJoin('users as a', 't.assigned_to', 'a.user_id')
      .select([
        't.task_id',
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
  },

  /**
   * Atomically updates a task and writes the corresponding diff into task_activity_logs.
   */
  async updateWithActivity(taskId, updates, userId, action, oldValue, newValue) {
    return db.transaction(async (trx) => {
      // 1. Update task
      const [updatedTask] = await trx('tasks')
        .where('task_id', taskId)
        .update({
          ...updates,
          updated_at: trx.fn.now(),
        })
        .returning([
          'task_id',
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
        ]);

      // 2. Insert audit activity log
      await trx('task_activity_logs').insert({
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
   * Deletes a task
   */
  async delete(taskId) {
    return db('tasks').where('task_id', taskId).delete();
  },

  /**
   * Lists activity logs for a project or specific task
   */
  async getActivityLogs(projectId, taskId = null) {
    const query = db('task_activity_logs as l')
      .join('tasks as t', 'l.task_id', 't.task_id')
      .leftJoin('users as u', 'l.user_id', 'u.user_id')
      .select([
        'l.activity_id',
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

    if (taskId) {
      query.where('l.task_id', taskId);
    }

    return query;
  },
};

export default taskModel;
