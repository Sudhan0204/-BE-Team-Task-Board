import { Router } from 'express';
import dashboardController from './dashboard.controller.js';
import { authenticate } from '../../middleware/authenticate.js';

const router = Router();

// Dashboard routes require authenticated user
router.use(authenticate);

/**
 * @route   GET /api/v1/dashboard/summary
 * @desc    Get overall workspace summary metrics (projects, assigned tasks, status breakdown, overdue)
 * @access  Private
 */
router.get('/summary', dashboardController.getSummary);

/**
 * @route   GET /api/v1/dashboard/my-tasks
 * @desc    Get tasks assigned to authenticated user across all authorized projects
 * @access  Private
 */
router.get('/my-tasks', dashboardController.getMyTasks);

export default router;
