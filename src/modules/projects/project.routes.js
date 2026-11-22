import { Router } from 'express';
import projectController from './project.controller.js';
import { authenticate } from '../../middleware/authenticate.js';
import { requireProjectAccess } from '../../middleware/authorize.js';
import { validateRequest } from '../../middleware/validateRequest.js';
import {
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
 * @route   GET /api/v1/projects/:projectId
 * @desc    Retrieve project by ID
 * @access  Private (Project Member: viewer or higher, or Org Admin/Owner)
 */
router.get(
  '/:projectId',
  requireProjectAccess('viewer'),
  projectController.getById
);

/**
 * @route   PATCH /api/v1/projects/:projectId
 * @desc    Update project settings
 * @access  Private (Project Lead or Org Admin/Owner)
 */
router.patch(
  '/:projectId',
  requireProjectAccess('lead'),
  validateRequest({ body: updateProjectSchema }),
  projectController.update
);

/**
 * @route   DELETE /api/v1/projects/:projectId
 * @desc    Delete a project
 * @access  Private (Project Lead or Org Admin/Owner)
 */
router.delete(
  '/:projectId',
  requireProjectAccess('lead'),
  projectController.delete
);

/**
 * @route   GET /api/v1/projects/:projectId/members
 * @desc    List members of a project
 * @access  Private (Project Member: viewer or higher, or Org Admin/Owner)
 */
router.get(
  '/:projectId/members',
  requireProjectAccess('viewer'),
  projectController.getMembers
);

/**
 * @route   POST /api/v1/projects/:projectId/members
 * @desc    Add a member to the project (must be member of parent organization)
 * @access  Private (Project Lead or Org Admin/Owner)
 */
router.post(
  '/:projectId/members',
  requireProjectAccess('lead'),
  validateRequest({ body: addProjectMemberSchema }),
  projectController.addMember
);

/**
 * @route   PATCH /api/v1/projects/:projectId/members/:userId
 * @desc    Update project member's role
 * @access  Private (Project Lead or Org Admin/Owner)
 */
router.patch(
  '/:projectId/members/:userId',
  requireProjectAccess('lead'),
  validateRequest({ body: updateProjectMemberRoleSchema }),
  projectController.updateMemberRole
);

/**
 * @route   DELETE /api/v1/projects/:projectId/members/:userId
 * @desc    Remove member from project
 * @access  Private (Project Lead or Org Admin/Owner)
 */
router.delete(
  '/:projectId/members/:userId',
  requireProjectAccess('lead'),
  projectController.removeMember
);

/**
 * @route   POST /api/v1/projects/:projectId/tasks
 * @desc    Create a new task in the project
 * @access  Private (Project Developer or higher)
 */
router.post(
  '/:projectId/tasks',
  requireProjectAccess('developer'),
  validateRequest({ body: createTaskSchema }),
  taskController.create
);

/**
 * @route   GET /api/v1/projects/:projectId/tasks
 * @desc    List tasks with filtering, search, and pagination
 * @access  Private (Project Viewer or higher)
 */
router.get(
  '/:projectId/tasks',
  requireProjectAccess('viewer'),
  validateRequest({ query: listTasksQuerySchema }),
  taskController.list
);

/**
 * @route   GET /api/v1/projects/:projectId/board
 * @desc    Get Kanban board tasks grouped by status columns ordered by position
 * @access  Private (Project Viewer or higher)
 */
router.get(
  '/:projectId/board',
  requireProjectAccess('viewer'),
  taskController.getBoard
);

/**
 * @route   GET /api/v1/projects/:projectId/activity
 * @desc    Get activity logs for the project
 * @access  Private (Project Viewer or higher)
 */
router.get(
  '/:projectId/activity',
  requireProjectAccess('viewer'),
  taskController.getActivity
);

/**
 * @route   POST /api/v1/projects/:projectId/labels
 * @desc    Create a project label
 * @access  Private (Project Lead or Org Admin/Owner)
 */
router.post(
  '/:projectId/labels',
  requireProjectAccess('lead'),
  validateRequest({ body: createLabelSchema }),
  labelController.create
);

/**
 * @route   GET /api/v1/projects/:projectId/labels
 * @desc    List all labels defined in project
 * @access  Private (Project Viewer or higher)
 */
router.get(
  '/:projectId/labels',
  requireProjectAccess('viewer'),
  labelController.list
);

export default router;
