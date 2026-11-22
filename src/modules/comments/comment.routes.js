import { Router } from 'express';
import commentController from './comment.controller.js';
import { authenticate } from '../../middleware/authenticate.js';
import { requireTaskAccess } from '../../middleware/authorize.js';
import { validateRequest } from '../../middleware/validateRequest.js';
import { createCommentSchema, updateCommentSchema } from './comment.validation.js';

const router = Router();

// All comment routes require authentication
router.use(authenticate);

/**
 * @route   PATCH /api/v1/comments/:commentId
 * @desc    Update a comment (author or project lead only)
 * @access  Private
 */
router.patch(
  '/:commentId',
  validateRequest({ body: updateCommentSchema }),
  commentController.update
);

/**
 * @route   DELETE /api/v1/comments/:commentId
 * @desc    Delete a comment (author or project lead only)
 * @access  Private
 */
router.delete(
  '/:commentId',
  commentController.delete
);

export default router;
