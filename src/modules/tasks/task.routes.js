import { Router } from 'express';
import taskController from './task.controller.js';
import { authenticate } from '../../middleware/authenticate.js';
import { requireTaskAccess } from '../../middleware/authorize.js';
import { validateRequest } from '../../middleware/validateRequest.js';
import {
  updateTaskSchema,
  updateStatusSchema,
  updateAssigneeSchema,
  updatePositionSchema,
} from './task.validation.js';
import commentController from '../comments/comment.controller.js';
import { createCommentSchema } from '../comments/comment.validation.js';
import labelController from '../labels/label.controller.js';
import attachmentController from '../attachments/attachment.controller.js';
import uploadAttachment from '../attachments/upload.middleware.js';

const router = Router();

// All task routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/v1/tasks/:taskId
 * @desc    Retrieve task details with assignee and creator
 * @access  Private (Project Viewer or higher)
 */
router.get(
  '/:taskId',
  requireTaskAccess('viewer'),
  taskController.getById
);

/**
 * @route   PATCH /api/v1/tasks/:taskId
 * @desc    Update task details (title, description, priority, dates)
 * @access  Private (Project Developer or higher)
 */
router.patch(
  '/:taskId',
  requireTaskAccess('developer'),
  validateRequest({ body: updateTaskSchema }),
  taskController.update
);

/**
 * @route   DELETE /api/v1/tasks/:taskId
 * @desc    Delete a task
 * @access  Private (Project Lead or Org Admin/Owner)
 */
router.delete(
  '/:taskId',
  requireTaskAccess('lead'),
  taskController.delete
);

/**
 * @route   PATCH /api/v1/tasks/:taskId/status
 * @desc    Update task status column and trigger completed_at adjustment
 * @access  Private (Project Developer or higher)
 */
router.patch(
  '/:taskId/status',
  requireTaskAccess('developer'),
  validateRequest({ body: updateStatusSchema }),
  taskController.updateStatus
);

/**
 * @route   PATCH /api/v1/tasks/:taskId/assignee
 * @desc    Assign or unassign task to a verified project member
 * @access  Private (Project Developer or higher)
 */
router.patch(
  '/:taskId/assignee',
  requireTaskAccess('developer'),
  validateRequest({ body: updateAssigneeSchema }),
  taskController.updateAssignee
);

/**
 * @route   PATCH /api/v1/tasks/:taskId/position
 * @desc    Update task vertical position and column for Kanban drag-and-drop
 * @access  Private (Project Developer or higher)
 */
router.patch(
  '/:taskId/position',
  requireTaskAccess('developer'),
  validateRequest({ body: updatePositionSchema }),
  taskController.updatePosition
);

/**
 * @route   POST /api/v1/tasks/:taskId/comments
 * @desc    Add a comment to the task
 * @access  Private (Project Developer or higher)
 */
router.post(
  '/:taskId/comments',
  requireTaskAccess('developer'),
  validateRequest({ body: createCommentSchema }),
  commentController.create
);

/**
 * @route   GET /api/v1/tasks/:taskId/comments
 * @desc    List comments for a task (paginated)
 * @access  Private (Project Viewer or higher)
 */
router.get(
  '/:taskId/comments',
  requireTaskAccess('viewer'),
  commentController.list
);

/**
 * @route   POST /api/v1/tasks/:taskId/labels/:labelId
 * @desc    Assign a project label to task
 * @access  Private (Project Developer or higher)
 */
router.post(
  '/:taskId/labels/:labelId',
  requireTaskAccess('developer'),
  labelController.assignToTask
);

/**
 * @route   DELETE /api/v1/tasks/:taskId/labels/:labelId
 * @desc    Remove a label assignment from task
 * @access  Private (Project Developer or higher)
 */
router.delete(
  '/:taskId/labels/:labelId',
  requireTaskAccess('developer'),
  labelController.removeFromTask
);

/**
 * @route   GET /api/v1/tasks/:taskId/labels
 * @desc    List all labels currently assigned to the task
 * @access  Private (Project Viewer or higher)
 */
router.get(
  '/:taskId/labels',
  requireTaskAccess('viewer'),
  labelController.getTaskLabels
);

/**
 * @route   POST /api/v1/tasks/:taskId/attachments
 * @desc    Upload file attachment to task (Multer: 10MB limit, mime filters)
 * @access  Private (Project Developer or higher)
 */
router.post(
  '/:taskId/attachments',
  requireTaskAccess('developer'),
  uploadAttachment.single('file'),
  attachmentController.upload
);

/**
 * @route   GET /api/v1/tasks/:taskId/attachments
 * @desc    List attachments for a task
 * @access  Private (Project Viewer or higher)
 */
router.get(
  '/:taskId/attachments',
  requireTaskAccess('viewer'),
  attachmentController.list
);

export default router;
