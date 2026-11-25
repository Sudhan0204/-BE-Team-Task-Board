import { Router } from 'express';
import superAdminController from './superAdmin.controller.js';
import { authenticateSuperAdmin } from '../../middleware/authenticate.js';
import { validateRequest } from '../../middleware/validateRequest.js';
import { authLimiter } from '../../middleware/rateLimiter.js';
import {
  superAdminLoginSchema,
  createPlanSchema,
  updatePlanSchema,
} from './superAdmin.validation.js';

const router = Router();

router.post(
  '/login',
  authLimiter,
  validateRequest({ body: superAdminLoginSchema }),
  superAdminController.login
);

router.post('/logout', superAdminController.logout);

router.get('/me', authenticateSuperAdmin, superAdminController.getMe);
router.get('/dashboard', authenticateSuperAdmin, superAdminController.getDashboard);

router.get('/plans', authenticateSuperAdmin, superAdminController.listPlans);
router.post(
  '/plans',
  authenticateSuperAdmin,
  validateRequest({ body: createPlanSchema }),
  superAdminController.createPlan
);
router.put(
  '/plans/:id',
  authenticateSuperAdmin,
  validateRequest({ body: updatePlanSchema }),
  superAdminController.updatePlan
);

export default router;
