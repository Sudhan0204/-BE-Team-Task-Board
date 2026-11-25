import db from '../../config/database.js';

export const notificationModel = {
  async create({ tenant_id, user_id, task_id = null, title, message }) {
    const [notification] = await db('notifications')
      .insert({
        tenant_id,
        user_id,
        task_id,
        title,
        message,
        is_read: false,
      })
      .returning([
        'notification_id',
        'tenant_id',
        'user_id',
        'task_id',
        'title',
        'message',
        'is_read',
        'created_at',
      ]);
    return notification;
  },

  async findById(notificationId, tenantId = null) {
    const query = db('notifications').where('notification_id', notificationId);
    if (tenantId) query.andWhere('tenant_id', tenantId);
    return query.first();
  },

  async listByUser(userId, { offset, limit }, tenantId = null) {
    const base = db('notifications').where('user_id', userId);
    if (tenantId) base.andWhere('tenant_id', tenantId);

    const totalQuery = base.clone().count('notification_id as total').first();
    const dataQuery = base
      .clone()
      .select([
        'notification_id',
        'tenant_id',
        'user_id',
        'task_id',
        'title',
        'message',
        'is_read',
        'created_at',
      ])
      .orderBy('created_at', 'desc')
      .offset(offset)
      .limit(limit);

    const [totalResult, notifications] = await Promise.all([totalQuery, dataQuery]);
    const total = parseInt(totalResult?.total || 0, 10);

    return { notifications, total };
  },

  async countUnread(userId, tenantId = null) {
    const query = db('notifications').where({
      user_id: userId,
      is_read: false,
    });
    if (tenantId) query.andWhere('tenant_id', tenantId);

    const result = await query.count('notification_id as unread_count').first();
    return parseInt(result?.unread_count || 0, 10);
  },

  async markAsRead(notificationId, userId, tenantId = null) {
    const query = db('notifications').where({
      notification_id: notificationId,
      user_id: userId,
    });
    if (tenantId) query.andWhere('tenant_id', tenantId);

    const [updated] = await query
      .update({ is_read: true })
      .returning([
        'notification_id',
        'tenant_id',
        'user_id',
        'task_id',
        'title',
        'message',
        'is_read',
        'created_at',
      ]);
    return updated;
  },

  async markAllAsRead(userId, tenantId = null) {
    const query = db('notifications').where({
      user_id: userId,
      is_read: false,
    });
    if (tenantId) query.andWhere('tenant_id', tenantId);
    return query.update({ is_read: true });
  },

  async delete(notificationId, userId, tenantId = null) {
    const query = db('notifications').where({
      notification_id: notificationId,
      user_id: userId,
    });
    if (tenantId) query.andWhere('tenant_id', tenantId);
    return query.delete();
  },
};

export default notificationModel;
