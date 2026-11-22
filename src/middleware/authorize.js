import { ApiError } from '../utils/ApiError.js';
import db from '../config/database.js';

const ORG_ROLE_LEVELS = {
  member: 1,
  admin: 2,
  owner: 3,
};

const PROJECT_ROLE_LEVELS = {
  viewer: 1,
  developer: 2,
  lead: 3,
  project_manager: 3, // DB stores 'project_manager' as the highest project role
};

/**
 * Middleware enforcing organization membership and role requirements.
 * Resolves organizationId from req.params.organizationId or req.body.organization_id.
 *
 * @param {'member' | 'admin' | 'owner'} [minRole='member']
 */
export function requireOrgMember(minRole = 'member') {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        throw ApiError.unauthorized('Authentication required');
      }

      const organizationId =
        req.params.organizationId ||
        req.body.organization_id ||
        req.query.organization_id;

      if (!organizationId) {
        throw ApiError.badRequest('Organization identifier is required');
      }

      // Query organization membership
      const membership = await db('organization_members')
        .where({
          organization_id: organizationId,
          user_id: req.user.user_id,
        })
        .first();

      if (!membership) {
        throw ApiError.forbidden('You are not a member of this organization');
      }

      const userLevel = ORG_ROLE_LEVELS[membership.role] || 0;
      const requiredLevel = ORG_ROLE_LEVELS[minRole] || 1;

      if (userLevel < requiredLevel) {
        throw ApiError.forbidden(
          `Insufficient permissions. Requires '${minRole}' role or higher in this organization.`
        );
      }

      // Attach verified membership to request context
      req.orgMembership = membership;
      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Middleware enforcing project access and role permissions.
 * Grants access if:
 * 1. User is directly a member of project_members with at least minRole, OR
 * 2. User is an organization owner or admin in the parent organization.
 *
 * @param {'viewer' | 'developer' | 'lead'} [minProjectRole='viewer']
 */
export function requireProjectAccess(minProjectRole = 'viewer') {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        throw ApiError.unauthorized('Authentication required');
      }

      const projectId = req.params.projectId || req.body.project_id || req.query.project_id;
      if (!projectId) {
        throw ApiError.badRequest('Project identifier is required');
      }

      // 1. Fetch project to know parent organization
      const project = await db('projects').where('project_id', projectId).first();
      if (!project) {
        throw ApiError.notFound('Project not found');
      }

      // 2. Check parent organization membership
      const orgMember = await db('organization_members')
        .where({
          organization_id: project.organization_id,
          user_id: req.user.user_id,
        })
        .first();

      if (!orgMember) {
        throw ApiError.forbidden('You do not belong to the organization that owns this project');
      }

      // If user is Org Owner or Admin, they inherit full project lead permissions
      if (orgMember.role === 'owner' || orgMember.role === 'admin') {
        req.project = project;
        req.projectMembership = {
          role: 'lead',
          isInheritedFromOrg: true,
          orgRole: orgMember.role,
        };
        return next();
      }

      // 3. Check direct project membership
      const projectMember = await db('project_members')
        .where({
          project_id: projectId,
          user_id: req.user.user_id,
        })
        .first();

      if (!projectMember) {
        throw ApiError.forbidden('You are not a member of this project');
      }

      const userLevel = PROJECT_ROLE_LEVELS[projectMember.role] || 0;
      const requiredLevel = PROJECT_ROLE_LEVELS[minProjectRole] || 1;

      if (userLevel < requiredLevel) {
        throw ApiError.forbidden(
          `Insufficient permissions. Requires '${minProjectRole}' project role or higher.`
        );
      }

      req.project = project;
      req.projectMembership = projectMember;
      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Middleware enforcing task access and role permissions.
 * Resolves taskId from req.params.taskId, verifies project access, and attaches req.task and req.project.
 *
 * @param {'viewer' | 'developer' | 'lead'} [minProjectRole='viewer']
 */
export function requireTaskAccess(minProjectRole = 'viewer') {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        throw ApiError.unauthorized('Authentication required');
      }

      const taskId = req.params.taskId;
      if (!taskId) {
        throw ApiError.badRequest('Task identifier is required');
      }

      // 1. Fetch task
      const task = await db('tasks').where('task_id', taskId).first();
      if (!task) {
        throw ApiError.notFound('Task not found');
      }

      // 2. Fetch project
      const project = await db('projects').where('project_id', task.project_id).first();
      if (!project) {
        throw ApiError.notFound('Parent project not found');
      }

      // 3. Verify organization membership
      const orgMember = await db('organization_members')
        .where({
          organization_id: project.organization_id,
          user_id: req.user.user_id,
        })
        .first();

      if (!orgMember) {
        throw ApiError.forbidden('You do not have access to this task');
      }

      // Org owner or admin inherits lead permissions
      if (orgMember.role === 'owner' || orgMember.role === 'admin') {
        req.task = task;
        req.project = project;
        req.projectMembership = { role: 'lead', isInherited: true };
        return next();
      }

      // 4. Check project membership
      const projectMember = await db('project_members')
        .where({
          project_id: task.project_id,
          user_id: req.user.user_id,
        })
        .first();

      if (!projectMember) {
        throw ApiError.forbidden('You are not a member of the project this task belongs to');
      }

      const userLevel = PROJECT_ROLE_LEVELS[projectMember.role] || 0;
      const requiredLevel = PROJECT_ROLE_LEVELS[minProjectRole] || 1;

      if (userLevel < requiredLevel) {
        throw ApiError.forbidden(
          `Insufficient permissions. Requires '${minProjectRole}' project role or higher to perform this action.`
        );
      }

      req.task = task;
      req.project = project;
      req.projectMembership = projectMember;
      next();
    } catch (err) {
      next(err);
    }
  };
}

export default {
  requireOrgMember,
  requireProjectAccess,
  requireTaskAccess,
};
