import { Router } from 'express';
import projectController from './project.controller.js';
import { authenticate } from '../../middleware/authenticate.js';
import { requirePermission, requireProjectAccess } from '../../middleware/authorize.js';
import { validateRequest } from '../../middleware/validateRequest.js';
import {
  createProjectSchema,
  updateProjectSchema,
  addProjectMemberSchema,
  updateProjectMemberRoleSchema,
} from './project.validation.js';
import taskController from '../tasks/task.controller.js';
import { createTaskSchema, listTasksQuerySchema } from '../tasks/task.validation.js';
import labelController from '../labels/label.controller.js';
import { createLabelSchema } from '../labels/label.validation.js';

const router = Router();

// All project routes require authentication
router.use(authenticate);

/**
 * Top-level tenant-scoped Project routes
 */
router.get(
  '/',
  requirePermission('projects.view', 'tasks.view', 'dashboard.view'),
  projectController.list
);

router.post(
  '/',
  requirePermission('projects.create'),
  validateRequest({ body: createProjectSchema }),
  projectController.createDirect
);

router.get(
  '/:projectId',
  requireProjectAccess('viewer', ['projects.view', 'tasks.view']),
  projectController.getById
);

router.patch(
  '/:projectId',
  requireProjectAccess('lead', 'projects.update'),
  validateRequest({ body: updateProjectSchema }),
  projectController.update
);

router.put(
  '/:projectId',
  requireProjectAccess('lead', 'projects.update'),
  validateRequest({ body: updateProjectSchema }),
  projectController.update
);

router.delete(
  '/:projectId',
  requireProjectAccess('lead', 'projects.delete'),
  projectController.delete
);

router.get(
  '/:projectId/members',
  requireProjectAccess('viewer', ['projects.view', 'tasks.view']),
  projectController.getMembers
);

router.post(
  '/:projectId/members',
  requireProjectAccess('lead', 'projects.update'),
  validateRequest({ body: addProjectMemberSchema }),
  projectController.addMember
);

router.patch(
  '/:projectId/members/:userId',
  requireProjectAccess('lead', 'projects.update'),
  validateRequest({ body: updateProjectMemberRoleSchema }),
  projectController.updateMemberRole
);

router.delete(
  '/:projectId/members/:userId',
  requireProjectAccess('lead', 'projects.update'),
  projectController.removeMember
);

router.post(
  '/:projectId/tasks',
  requireProjectAccess('developer', 'tasks.create'),
  validateRequest({ body: createTaskSchema }),
  taskController.create
);

router.get(
  '/:projectId/tasks',
  requireProjectAccess('viewer', ['tasks.view', 'projects.view']),
  validateRequest({ query: listTasksQuerySchema }),
  taskController.list
);

router.get(
  '/:projectId/board',
  requireProjectAccess('viewer', ['tasks.view', 'projects.view']),
  taskController.getBoard
);

router.get(
  '/:projectId/activity',
  requireProjectAccess('viewer', ['tasks.view', 'projects.view']),
  taskController.getActivity
);

router.post(
  '/:projectId/labels',
  requireProjectAccess('lead', ['projects.update', 'tasks.update']),
  validateRequest({ body: createLabelSchema }),
  labelController.create
);

router.get(
  '/:projectId/labels',
  requireProjectAccess('viewer', ['tasks.view', 'projects.view']),
  labelController.list
);

export default router;
