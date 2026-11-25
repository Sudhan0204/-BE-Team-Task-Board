import { Router } from 'express';
import roleController from './role.controller.js';
import { authenticate } from '../../middleware/authenticate.js';
import { requirePermission } from '../../middleware/authorize.js';

const router = Router();

router.use(authenticate);
router.get('/', requirePermission('roles.view'), roleController.listPermissions);

export default router;
