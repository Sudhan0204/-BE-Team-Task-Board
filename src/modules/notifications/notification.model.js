import db from '../../config/database.js';

export const notificationModel = {
  /**
   * Create a new notification record
   */
  async create({ user_id, task_id = null, title, message }) {
    const [notification] = await db('notifications')
      .insert({
        user_id,
        task_id,
        title,
        message,
        is_read: false,
      })
      .returning(['notification_id', 'user_id', 'task_id', 'title', 'message', 'is_read', 'created_at']);
    return notification;
  },

  /**
   * Find notification by ID
   */
  async findById(notificationId) {
    return db('notifications')
      .where('notification_id', notificationId)
      .first();
  },

  /**
   * List paginated notifications belonging exclusively to a user
   */
  async listByUser(userId, { offset, limit }) {
    const totalQuery = db('notifications')
      .where('user_id', userId)
      .count('notification_id as total')
      .first();

    const dataQuery = db('notifications')
      .where('user_id', userId)
      .select(['notification_id', 'user_id', 'task_id', 'title', 'message', 'is_read', 'created_at'])
      .orderBy('created_at', 'desc')
      .offset(offset)
      .limit(limit);

    const [totalResult, notifications] = await Promise.all([totalQuery, dataQuery]);
    const total = parseInt(totalResult?.total || 0, 10);

    return { notifications, total };
  },

  /**
   * Count unread notifications for a user
   */
  async countUnread(userId) {
    const result = await db('notifications')
      .where({
        user_id: userId,
        is_read: false,
      })
      .count('notification_id as unread_count')
      .first();

    return parseInt(result?.unread_count || 0, 10);
  },

  /**
   * Mark a specific notification as read (scoped to owner user)
   */
  async markAsRead(notificationId, userId) {
    const [updated] = await db('notifications')
      .where({
        notification_id: notificationId,
        user_id: userId,
      })
      .update({ is_read: true })
      .returning(['notification_id', 'user_id', 'task_id', 'title', 'message', 'is_read', 'created_at']);
    return updated;
  },

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId) {
    return db('notifications')
      .where({
        user_id: userId,
        is_read: false,
      })
      .update({ is_read: true });
  },

  /**
   * Delete notification (scoped to owner user)
   */
  async delete(notificationId, userId) {
    return db('notifications')
      .where({
        notification_id: notificationId,
        user_id: userId,
      })
      .delete();
  },
};

export default notificationModel;
