import { Router } from 'express';
import attachmentController from './attachment.controller.js';
import { authenticate } from '../../middleware/authenticate.js';

const router = Router();

// Attachment routes require authentication
router.use(authenticate);

/**
 * @route   DELETE /api/v1/attachments/:attachmentId
 * @desc    Delete attachment record and physical file
 * @access  Private (Uploader or Project Lead)
 */
router.delete(
  '/:attachmentId',
  attachmentController.delete
);

export default router;
