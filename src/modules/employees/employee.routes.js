import { Router } from 'express';
import employeeController from './employee.controller.js';
import { authenticate } from '../../middleware/authenticate.js';
import { requirePermission } from '../../middleware/authorize.js';
import { validateRequest } from '../../middleware/validateRequest.js';
import {
  createEmployeeSchema,
  updateEmployeeSchema,
  updateEmployeeStatusSchema,
  resetEmployeePasswordSchema,
  assignEmployeeRolesSchema,
} from './employee.validation.js';

const router = Router();

router.use(authenticate);

// Allow viewing employee directory if user has employees.view OR projects.update (to add project members)
router.get(
  '/',
  requirePermission('employees.view', 'projects.update', 'projects.create'),
  employeeController.list
);

router.post(
  '/',
  requirePermission('employees.create'),
  validateRequest({ body: createEmployeeSchema }),
  employeeController.create
);

router.get('/:id', requirePermission('employees.view'), employeeController.getById);

router.put(
  '/:id',
  requirePermission('employees.update'),
  validateRequest({ body: updateEmployeeSchema }),
  employeeController.update
);

router.patch(
  '/:id/status',
  requirePermission('employees.update'),
  validateRequest({ body: updateEmployeeStatusSchema }),
  employeeController.updateStatus
);

router.post(
  '/:id/reset-password',
  requirePermission('employees.update'),
  validateRequest({ body: resetEmployeePasswordSchema }),
  employeeController.resetPassword
);

router.delete('/:id', requirePermission('employees.delete'), employeeController.delete);

router.get(
  '/:id/roles',
  requirePermission('roles.view', 'employees.view'),
  employeeController.getRoles
);

router.put(
  '/:id/roles',
  requirePermission('roles.update'),
  validateRequest({ body: assignEmployeeRolesSchema }),
  employeeController.assignRoles
);

export default router;
