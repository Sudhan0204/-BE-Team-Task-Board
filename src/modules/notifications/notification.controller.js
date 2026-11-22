import notificationService from './notification.service.js';
import { sendSuccess, sendNoContent, sendPaginated } from '../../utils/apiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

export const notificationController = {
  list: asyncHandler(async (req, res) => {
    const { notifications, pagination } = await notificationService.getUserNotifications(
      req.user.user_id,
      req.query
    );
    return sendPaginated(res, notifications, pagination, 'Notifications retrieved successfully');
  }),

  unreadCount: asyncHandler(async (req, res) => {
    const result = await notificationService.getUnreadCount(req.user.user_id);
    return sendSuccess(res, 'Unread notification count retrieved', result);
  }),

  markAsRead: asyncHandler(async (req, res) => {
    const notification = await notificationService.markNotificationAsRead(
      req.params.notificationId,
      req.user.user_id
    );
    return sendSuccess(res, 'Notification marked as read', { notification });
  }),

  markAllAsRead: asyncHandler(async (req, res) => {
    await notificationService.markAllNotificationsAsRead(req.user.user_id);
    return sendSuccess(res, 'All notifications marked as read');
  }),

  delete: asyncHandler(async (req, res) => {
    await notificationService.deleteNotification(
      req.params.notificationId,
      req.user.user_id
    );
    return sendNoContent(res);
  }),
};

export default notificationController;
