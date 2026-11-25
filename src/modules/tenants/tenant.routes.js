import { Router } from 'express';
import tenantController from './tenant.controller.js';
import { authenticateSuperAdmin } from '../../middleware/authenticate.js';
import { validateRequest } from '../../middleware/validateRequest.js';
import { uploadCompanyLogo } from './logoUpload.middleware.js';
import {
  createTenantSchema,
  updateTenantSchema,
  updateTenantStatusSchema,
} from './tenant.validation.js';

const router = Router();

/**
 * Public branding lookup by slug (for company login pages)
 */
router.get('/public/:slug', tenantController.getPublicBranding);

// All management routes below require Platform Super Admin authentication
router.use(authenticateSuperAdmin);

router.get('/', tenantController.list);

router.post(
  '/',
  uploadCompanyLogo.single('logo'),
  validateRequest({ body: createTenantSchema }),
  tenantController.create
);

router.get('/:id', tenantController.getById);

router.put(
  '/:id',
  uploadCompanyLogo.single('logo'),
  validateRequest({ body: updateTenantSchema }),
  tenantController.update
);

router.patch(
  '/:id/status',
  validateRequest({ body: updateTenantStatusSchema }),
  tenantController.updateStatus
);

router.post(
  '/:id/logo',
  uploadCompanyLogo.single('logo'),
  tenantController.uploadLogo
);

export default router;
