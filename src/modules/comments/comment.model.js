import db from '../../config/database.js';

export const commentModel = {
  /**
   * Insert a new comment on a task
   */
  async create({ task_id, user_id, comment_text }) {
    const [comment] = await db('task_comments')
      .insert({
        task_id,
        user_id,
        comment_text,
      })
      .returning(['comment_id', 'task_id', 'user_id', 'comment_text', 'created_at', 'updated_at']);
    return comment;
  },

  /**
   * Find comment by ID with author details
   */
  async findById(commentId) {
    return db('task_comments as c')
      .join('users as u', 'c.user_id', 'u.user_id')
      .join('tasks as t', 'c.task_id', 't.task_id')
      .select([
        'c.comment_id',
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
      .where('c.comment_id', commentId)
      .first();
  },

  /**
   * List paginated comments for a task
   */
  async listByTask(taskId, { offset, limit }) {
    const totalQuery = db('task_comments')
      .where('task_id', taskId)
      .count('comment_id as total')
      .first();

    const dataQuery = db('task_comments as c')
      .join('users as u', 'c.user_id', 'u.user_id')
      .select([
        'c.comment_id',
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

    const [totalResult, comments] = await Promise.all([totalQuery, dataQuery]);
    const total = parseInt(totalResult?.total || 0, 10);

    return { comments, total };
  },

  /**
   * Update comment text
   */
  async update(commentId, comment_text) {
    const [updated] = await db('task_comments')
      .where('comment_id', commentId)
      .update({
        comment_text,
        updated_at: db.fn.now(),
      })
      .returning(['comment_id', 'task_id', 'user_id', 'comment_text', 'created_at', 'updated_at']);
    return updated;
  },

  /**
   * Delete comment
   */
  async delete(commentId) {
    return db('task_comments').where('comment_id', commentId).delete();
  },
};

export default commentModel;
