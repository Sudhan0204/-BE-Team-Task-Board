import { Router } from 'express';
import taskController from './task.controller.js';
import { authenticate } from '../../middleware/authenticate.js';
import {
  requirePermission,
  requireProjectAccess,
  requireTaskAccess,
} from '../../middleware/authorize.js';
import { validateRequest } from '../../middleware/validateRequest.js';
import {
  createTaskSchema,
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

router.use(authenticate);

/**
 * Top-level tenant-scoped task listing & creation
 */
router.get('/', requirePermission('tasks.view', 'projects.view'), taskController.listAll);

router.post(
  '/',
  requireProjectAccess('developer', 'tasks.create'),
  validateRequest({ body: createTaskSchema }),
  taskController.create
);

router.get(
  '/:taskId',
  requireTaskAccess('viewer', ['tasks.view', 'projects.view']),
  taskController.getById
);

router.patch(
  '/:taskId',
  requireTaskAccess('developer', 'tasks.update'),
  validateRequest({ body: updateTaskSchema }),
  taskController.update
);

router.put(
  '/:taskId',
  requireTaskAccess('developer', 'tasks.update'),
  validateRequest({ body: updateTaskSchema }),
  taskController.update
);

router.delete(
  '/:taskId',
  requireTaskAccess('lead', 'tasks.delete'),
  taskController.delete
);

router.patch(
  '/:taskId/status',
  requireTaskAccess('developer', 'tasks.update'),
  validateRequest({ body: updateStatusSchema }),
  taskController.updateStatus
);

router.patch(
  '/:taskId/assignee',
  requireTaskAccess('developer', ['tasks.assign', 'tasks.update']),
  validateRequest({ body: updateAssigneeSchema }),
  taskController.updateAssignee
);

router.patch(
  '/:taskId/position',
  requireTaskAccess('developer', 'tasks.update'),
  validateRequest({ body: updatePositionSchema }),
  taskController.updatePosition
);

router.post(
  '/:taskId/comments',
  requireTaskAccess('developer', 'comments.create'),
  validateRequest({ body: createCommentSchema }),
  commentController.create
);

router.get(
  '/:taskId/comments',
  requireTaskAccess('viewer', ['tasks.view', 'projects.view']),
  commentController.list
);

router.post(
  '/:taskId/labels/:labelId',
  requireTaskAccess('developer', 'tasks.update'),
  labelController.assignToTask
);

router.delete(
  '/:taskId/labels/:labelId',
  requireTaskAccess('developer', 'tasks.update'),
  labelController.removeFromTask
);

router.get(
  '/:taskId/labels',
  requireTaskAccess('viewer', ['tasks.view', 'projects.view']),
  labelController.getTaskLabels
);

router.post(
  '/:taskId/attachments',
  requireTaskAccess('developer', 'tasks.update'),
  uploadAttachment.single('file'),
  attachmentController.upload
);

router.get(
  '/:taskId/attachments',
  requireTaskAccess('viewer', ['tasks.view', 'projects.view']),
  attachmentController.list
);

export default router;
