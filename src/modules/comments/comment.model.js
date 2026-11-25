import db from '../../config/database.js';

export const commentModel = {
  async create({ tenant_id, task_id, user_id, comment_text }) {
    const [comment] = await db('task_comments')
      .insert({
        tenant_id,
        task_id,
        user_id,
        comment_text,
      })
      .returning([
        'comment_id',
        'tenant_id',
        'task_id',
        'user_id',
        'comment_text',
        'created_at',
        'updated_at',
      ]);
    return comment;
  },

  async findById(commentId, tenantId = null) {
    const query = db('task_comments as c')
      .join('users as u', 'c.user_id', 'u.user_id')
      .join('tasks as t', 'c.task_id', 't.task_id')
      .select([
        'c.comment_id',
        'c.tenant_id',
        'c.task_id',
        'c.user_id',
        'c.comment_text',
        'c.created_at',
        'c.updated_at',
        'u.full_name as author_name',
        'u.email as author_email',
        'u.avatar_url as author_avatar',
        't.project_id',
      ])
      .where('c.comment_id', commentId);

    if (tenantId) query.andWhere('c.tenant_id', tenantId);
    return query.first();
  },

  async listByTask(taskId, { offset, limit }, tenantId = null) {
    const countQuery = db('task_comments').where('task_id', taskId);
    if (tenantId) countQuery.andWhere('tenant_id', tenantId);
    const totalQuery = countQuery.count('comment_id as total').first();

    const dataQuery = db('task_comments as c')
      .join('users as u', 'c.user_id', 'u.user_id')
      .select([
        'c.comment_id',
        'c.tenant_id',
        'c.task_id',
        'c.user_id',
        'c.comment_text',
        'c.created_at',
        'c.updated_at',
        'u.full_name as author_name',
        'u.email as author_email',
        'u.avatar_url as author_avatar',
      ])
      .where('c.task_id', taskId)
      .orderBy('c.created_at', 'asc')
      .offset(offset)
      .limit(limit);

    if (tenantId) dataQuery.andWhere('c.tenant_id', tenantId);

    const [totalResult, comments] = await Promise.all([totalQuery, dataQuery]);
    const total = parseInt(totalResult?.total || 0, 10);

    return { comments, total };
  },

  async update(commentId, comment_text, tenantId = null) {
    const query = db('task_comments').where('comment_id', commentId);
    if (tenantId) query.andWhere('tenant_id', tenantId);

    const [updated] = await query
      .update({
        comment_text,
        updated_at: db.fn.now(),
      })
      .returning([
        'comment_id',
        'tenant_id',
        'task_id',
        'user_id',
        'comment_text',
        'created_at',
        'updated_at',
      ]);
    return updated;
  },

  async delete(commentId, tenantId = null) {
    const query = db('task_comments').where('comment_id', commentId);
    if (tenantId) query.andWhere('tenant_id', tenantId);
    return query.delete();
  },
};

export default commentModel;
