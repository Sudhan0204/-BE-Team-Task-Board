import notificationModel from './notification.model.js';
import { ApiError } from '../../utils/ApiError.js';
import { getPaginationParams } from '../../utils/pagination.js';
import logger from '../../config/logger.js';

export const notificationService = {
  /**
   * Safe asynchronous notification dispatcher (errors do not compromise primary operation)
   */
  async notifyUser({ userId, taskId = null, title, message }) {
    try {
      return await notificationModel.create({
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

  /**
   * List paginated notifications for current user
   */
  async getUserNotifications(userId, query) {
    const pagination = getPaginationParams(query, {
      defaultLimit: 20,
      maxLimit: 50,
    });

    const { notifications, total } = await notificationModel.listByUser(userId, pagination);

    return {
      notifications,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
      },
    };
  },

  /**
   * Get unread notification count
   */
  async getUnreadCount(userId) {
    const count = await notificationModel.countUnread(userId);
    return { unread_count: count };
  },

  /**
   * Mark single notification as read (with ownership validation)
   */
  async markNotificationAsRead(notificationId, userId) {
    const notification = await notificationModel.findById(notificationId);
    if (!notification) {
      throw ApiError.notFound('Notification not found.');
    }

    if (String(notification.user_id) !== String(userId)) {
      throw ApiError.forbidden('You do not have permission to access this notification.');
    }

    return notificationModel.markAsRead(notificationId, userId);
  },

  /**
   * Mark all notifications as read for current user
   */
  async markAllNotificationsAsRead(userId) {
    await notificationModel.markAllAsRead(userId);
    return { success: true };
  },

  /**
   * Delete single notification (with ownership validation)
   */
  async deleteNotification(notificationId, userId) {
    const notification = await notificationModel.findById(notificationId);
    if (!notification) {
      throw ApiError.notFound('Notification not found.');
    }

    if (String(notification.user_id) !== String(userId)) {
      throw ApiError.forbidden('You do not have permission to delete this notification.');
    }

    await notificationModel.delete(notificationId, userId);
    return { success: true };
  },
};

export default notificationService;
