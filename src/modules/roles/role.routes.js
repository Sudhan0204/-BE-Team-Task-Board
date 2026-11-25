import { Router } from 'express';
import roleController from './role.controller.js';
import { authenticate } from '../../middleware/authenticate.js';
import { requirePermission } from '../../middleware/authorize.js';
import { validateRequest } from '../../middleware/validateRequest.js';
import {
  createRoleSchema,
  updateRoleSchema,
  updateRolePermissionsSchema,
} from './role.validation.js';

const router = Router();

router.use(authenticate);

router.get('/', requirePermission('roles.view', 'employees.create', 'employees.update'), roleController.list);
router.post('/', requirePermission('roles.create'), validateRequest({ body: createRoleSchema }), roleController.create);
router.get('/:id', requirePermission('roles.view'), roleController.getById);
router.put('/:id', requirePermission('roles.update'), validateRequest({ body: updateRoleSchema }), roleController.update);
router.delete('/:id', requirePermission('roles.delete'), roleController.delete);

router.get('/:id/permissions', requirePermission('roles.view'), roleController.getPermissions);
router.put(
  '/:id/permissions',
  requirePermission('roles.update'),
  validateRequest({ body: updateRolePermissionsSchema }),
  roleController.updatePermissions
);
router.get('/:id/employees', requirePermission('roles.view'), roleController.getEmployees);

export default router;
