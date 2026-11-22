import { Router } from 'express';
import notificationController from './notification.controller.js';
import { authenticate } from '../../middleware/authenticate.js';

const router = Router();

// All notification endpoints require authenticated user
router.use(authenticate);

/**
 * @route   GET /api/v1/notifications
 * @desc    List notifications belonging to current user (paginated)
 * @access  Private
 */
router.get('/', notificationController.list);

/**
 * @route   GET /api/v1/notifications/unread-count
 * @desc    Get count of unread notifications
 * @access  Private
 */
router.get('/unread-count', notificationController.unreadCount);

/**
 * @route   PATCH /api/v1/notifications/read-all
 * @desc    Mark all user notifications as read
 * @access  Private
 */
router.patch('/read-all', notificationController.markAllAsRead);

/**
 * @route   PATCH /api/v1/notifications/:notificationId/read
 * @desc    Mark single notification as read
 * @access  Private
 */
router.patch('/:notificationId/read', notificationController.markAsRead);

/**
 * @route   DELETE /api/v1/notifications/:notificationId
 * @desc    Delete notification
 * @access  Private
 */
router.delete('/:notificationId', notificationController.delete);

export default router;
