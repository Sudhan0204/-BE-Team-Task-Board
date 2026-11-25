import notificationModel from './notification.model.js';
import { ApiError } from '../../utils/ApiError.js';
import { getPaginationParams } from '../../utils/pagination.js';
import logger from '../../config/logger.js';

export const notificationService = {
  async notifyUser({ tenantId, userId, taskId = null, title, message }) {
    try {
      return await notificationModel.create({
        tenant_id: tenantId,
        user_id: userId,
        task_id: taskId,
        title,
        message,
      });
    } catch (err) {
      logger.warn('Failed to deliver background in-app notification', {
        userId,
        error: err.message,
      });
      return null;
    }
  },

  async getUserNotifications(userId, query, tenantId = null) {
    const pagination = getPaginationParams(query, {
      defaultLimit: 20,
      maxLimit: 50,
    });

    const { notifications, total } = await notificationModel.listByUser(
      userId,
      pagination,
      tenantId
    );

    return {
      notifications,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
      },
    };
  },

  async getUnreadCount(userId, tenantId = null) {
    const count = await notificationModel.countUnread(userId, tenantId);
    return { unread_count: count };
  },

  async markNotificationAsRead(notificationId, userId, tenantId = null) {
    const notification = await notificationModel.findById(notificationId, tenantId);
    if (!notification) {
      throw ApiError.notFound('Notification not found.');
    }

    if (String(notification.user_id) !== String(userId)) {
      throw ApiError.forbidden('You do not have permission to access this notification.');
    }

    return notificationModel.markAsRead(notificationId, userId, tenantId);
  },

  async markAllNotificationsAsRead(userId, tenantId = null) {
    await notificationModel.markAllAsRead(userId, tenantId);
    return { success: true };
  },

  async deleteNotification(notificationId, userId, tenantId = null) {
    const notification = await notificationModel.findById(notificationId, tenantId);
    if (!notification) {
      throw ApiError.notFound('Notification not found.');
    }

    if (String(notification.user_id) !== String(userId)) {
      throw ApiError.forbidden('You do not have permission to delete this notification.');
    }

    await notificationModel.delete(notificationId, userId, tenantId);
    return { success: true };
  },
};

export default notificationService;
