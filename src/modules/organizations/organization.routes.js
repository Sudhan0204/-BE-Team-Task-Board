import { Router } from 'express';
import organizationController from './organization.controller.js';
import { authenticate } from '../../middleware/authenticate.js';
import { requireOrgMember } from '../../middleware/authorize.js';
import { validateRequest } from '../../middleware/validateRequest.js';
import {
  createOrganizationSchema,
  updateOrganizationSchema,
  addMemberSchema,
  updateMemberRoleSchema,
} from './organization.validation.js';
import projectController from '../projects/project.controller.js';
import { createProjectSchema } from '../projects/project.validation.js';

const router = Router();

// All organization routes require authenticated users
router.use(authenticate);

/**
 * @route   POST /api/v1/organizations
 * @desc    Create a new organization
 * @access  Private
 */
router.post(
  '/',
  validateRequest({ body: createOrganizationSchema }),
  organizationController.create
);

/**
 * @route   GET /api/v1/organizations
 * @desc    List organizations belonging to the authenticated user
 * @access  Private
 */
router.get('/', organizationController.list);

/**
 * @route   GET /api/v1/organizations/:organizationId
 * @desc    Retrieve organization details
 * @access  Private (Org Member)
 */
router.get(
  '/:organizationId',
  requireOrgMember('member'),
  organizationController.getById
);

/**
 * @route   PATCH /api/v1/organizations/:organizationId
 * @desc    Update organization settings
 * @access  Private (Org Admin or Owner)
 */
router.patch(
  '/:organizationId',
  requireOrgMember('admin'),
  validateRequest({ body: updateOrganizationSchema }),
  organizationController.update
);

/**
 * @route   GET /api/v1/organizations/:organizationId/members
 * @desc    List organization members
 * @access  Private (Org Member)
 */
router.get(
  '/:organizationId/members',
  requireOrgMember('member'),
  organizationController.getMembers
);

/**
 * @route   POST /api/v1/organizations/:organizationId/members
 * @desc    Add a member to the organization
 * @access  Private (Org Admin or Owner)
 */
router.post(
  '/:organizationId/members',
  requireOrgMember('admin'),
  validateRequest({ body: addMemberSchema }),
  organizationController.addMember
);

/**
 * @route   PATCH /api/v1/organizations/:organizationId/members/:userId
 * @desc    Update an organization member's role
 * @access  Private (Org Admin or Owner)
 */
router.patch(
  '/:organizationId/members/:userId',
  requireOrgMember('admin'),
  validateRequest({ body: updateMemberRoleSchema }),
  organizationController.updateMemberRole
);

/**
 * @route   DELETE /api/v1/organizations/:organizationId/members/:userId
 * @desc    Remove a member from the organization
 * @access  Private (Org Admin or Owner)
 */
router.delete(
  '/:organizationId/members/:userId',
  requireOrgMember('admin'),
  organizationController.removeMember
);

/**
 * @route   POST /api/v1/organizations/:organizationId/projects
 * @desc    Create a project within an organization
 * @access  Private (Org Admin or Owner)
 */
router.post(
  '/:organizationId/projects',
  requireOrgMember('admin'),
  validateRequest({ body: createProjectSchema }),
  projectController.create
);

/**
 * @route   GET /api/v1/organizations/:organizationId/projects
 * @desc    List projects within an organization (with pagination)
 * @access  Private (Org Member)
 */
router.get(
  '/:organizationId/projects',
  requireOrgMember('member'),
  projectController.listByOrg
);

export default router;
