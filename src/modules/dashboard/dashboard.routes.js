import { Router } from 'express';
import dashboardController from './dashboard.controller.js';
import { authenticate } from '../../middleware/authenticate.js';
import { requirePermission } from '../../middleware/authorize.js';

const router = Router();

router.use(authenticate);

router.get('/summary', dashboardController.getSummary);
router.get(
  '/company',
  requirePermission('dashboard.view', 'reports.view', 'employees.view'),
  dashboardController.getCompanyDashboard
);
router.get('/my-tasks', dashboardController.getMyTasks);

export default router;
