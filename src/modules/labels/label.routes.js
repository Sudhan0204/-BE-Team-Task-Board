import { Router } from 'express';
import labelController from './label.controller.js';
import { authenticate } from '../../middleware/authenticate.js';
import { validateRequest } from '../../middleware/validateRequest.js';
import { updateLabelSchema } from './label.validation.js';

const router = Router();

// Label routes require authentication
router.use(authenticate);

/**
 * @route   PATCH /api/v1/labels/:labelId
 * @desc    Update label name or color
 * @access  Private
 */
router.patch(
  '/:labelId',
  validateRequest({ body: updateLabelSchema }),
  labelController.update
);

/**
 * @route   DELETE /api/v1/labels/:labelId
 * @desc    Delete label and its task assignments
 * @access  Private
 */
router.delete(
  '/:labelId',
  labelController.delete
);

export default router;
