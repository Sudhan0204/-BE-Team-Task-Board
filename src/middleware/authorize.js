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
  project_manager: 3,
};

/**
 * Dynamic RBAC Permission Authorization Middleware.
 * Grants access if the authenticated company user has AT LEAST ONE of the required permissions.
 *
 * @param {...string} requiredPermissions
 */
export function requirePermission(...requiredPermissions) {
  return (req, res, next) => {
    if (!req.user) {
      return next(ApiError.unauthorized('Authentication required.'));
    }

    if (!req.tenantId) {
      return next(ApiError.forbidden('Valid company tenant context is required.'));
    }

    const permSet = req.permissionSet || new Set(req.permissions || []);
    const hasAny = requiredPermissions.some((perm) => permSet.has(perm));

    if (!hasAny) {
      return next(
        ApiError.forbidden(
          `Access denied. Required permission: ${requiredPermissions.join(' or ')}.`
        )
      );
    }

    return next();
  };
}

/**
 * Dynamic RBAC middleware requiring ALL specified permissions.
 */
export function requireAllPermissions(...requiredPermissions) {
  return (req, res, next) => {
    if (!req.user) {
      return next(ApiError.unauthorized('Authentication required.'));
    }

    const permSet = req.permissionSet || new Set(req.permissions || []);
    const missing = requiredPermissions.filter((perm) => !permSet.has(perm));

    if (missing.length > 0) {
      return next(
        ApiError.forbidden(`Access denied. Missing required permissions: ${missing.join(', ')}.`)
      );
    }

    return next();
  };
}

/**
 * Helper checking whether the authenticated user has a specific RBAC permission.
 */
function hasPerm(req, key) {
  if (!key) return true;
  const set = req.permissionSet || new Set(req.permissions || []);
  return set.has(key);
}

/**
 * Middleware enforcing organization membership and role requirements (tenant-scoped).
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

      // Enforce tenant isolation on legacy organizations
      if (req.tenantId) {
        const org = await db('organizations')
          .where({ organization_id: organizationId, tenant_id: req.tenantId })
          .first();
        if (!org) {
          throw ApiError.notFound('Organization not found.');
        }
      }

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

      req.orgMembership = membership;
      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Tenant-Isolated & RBAC-Aware Project Authorization Middleware.
 * 1. Verifies project exists AND belongs strictly to req.tenantId (returns 404 on cross-tenant ID).
 * 2. Enforces dynamic RBAC permission if provided (e.g. 'projects.view', 'projects.update', 'tasks.create').
 * 3. Verifies project membership (or company admin / project management authority).
 *
 * @param {'viewer' | 'developer' | 'lead'} [minProjectRole='viewer']
 * @param {string | string[] | null} [requiredPermission=null]
 */
export function requireProjectAccess(minProjectRole = 'viewer', requiredPermission = null) {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        throw ApiError.unauthorized('Authentication required');
      }

      const projectId = req.params.projectId || req.params.id || req.body.project_id || req.query.project_id;
      if (!projectId) {
        throw ApiError.badRequest('Project identifier is required');
      }

      // 1. Fetch project STRICTLY scoped to authenticated tenant
      const projectQuery = db('projects').where('project_id', projectId);
      if (req.tenantId) {
        projectQuery.andWhere('tenant_id', req.tenantId);
      }
      const project = await projectQuery.first();

      if (!project) {
        throw ApiError.notFound('Project not found');
      }

      // 2. Enforce dynamic RBAC permission when specified
      if (requiredPermission && req.tenantId) {
        const requiredList = Array.isArray(requiredPermission)
          ? requiredPermission
          : [requiredPermission];
        const allowedByRbac = requiredList.some((perm) => hasPerm(req, perm));
        if (!allowedByRbac) {
          throw ApiError.forbidden(
            `Access denied. Required permission: ${requiredList.join(' or ')}.`
          );
        }
      }

      // 3. Company Admins (system role) have full tenant-wide project oversight
      if (req.isCompanyAdmin) {
        req.project = project;
        req.projectMembership = {
          role: 'project_manager',
          isInheritedFromTenantAdmin: true,
        };
        return next();
      }

      // 4. Legacy org owner/admin inheritance (within same tenant)
      if (project.organization_id) {
        const orgMember = await db('organization_members')
          .where({
            organization_id: project.organization_id,
            user_id: req.user.user_id,
          })
          .first();

        if (orgMember && (orgMember.role === 'owner' || orgMember.role === 'admin')) {
          req.project = project;
          req.projectMembership = {
            role: 'lead',
            isInheritedFromOrg: true,
            orgRole: orgMember.role,
          };
          return next();
        }
      }

      // 5. Direct project membership check (tenant-scoped)
      const memberQuery = db('project_members').where({
        project_id: projectId,
        user_id: req.user.user_id,
      });
      if (req.tenantId) {
        memberQuery.andWhere('tenant_id', req.tenantId);
      }
      const projectMember = await memberQuery.first();

      // Users with company-wide project update/delete permissions can manage projects in their tenant
      if (!projectMember) {
        if (hasPerm(req, 'projects.update') || hasPerm(req, 'projects.delete') || hasPerm(req, 'reports.view')) {
          req.project = project;
          req.projectMembership = {
            role: hasPerm(req, 'projects.update') ? 'project_manager' : 'viewer',
            isInheritedFromPermission: true,
          };
          return next();
        }
        throw ApiError.forbidden('You are not a member of this project');
      }

      // If an explicit RBAC permission was checked & passed, honor dynamic RBAC!
      // Otherwise fall back to project role level.
      if (!requiredPermission) {
        const userLevel = PROJECT_ROLE_LEVELS[projectMember.role] || 0;
        const requiredLevel = PROJECT_ROLE_LEVELS[minProjectRole] || 1;
        if (userLevel < requiredLevel) {
          throw ApiError.forbidden(
            `Insufficient permissions. Requires '${minProjectRole}' project role or higher.`
          );
        }
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
 * Tenant-Isolated & RBAC-Aware Task Authorization Middleware.
 * 1. Verifies task & parent project belong strictly to req.tenantId.
 * 2. Enforces dynamic RBAC permission (e.g. 'tasks.view', 'tasks.update', 'tasks.delete', 'tasks.assign').
 * 3. Verifies project membership (or tenant admin / project manager authority).
 *
 * @param {'viewer' | 'developer' | 'lead'} [minProjectRole='viewer']
 * @param {string | string[] | null} [requiredPermission=null]
 */
export function requireTaskAccess(minProjectRole = 'viewer', requiredPermission = null) {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        throw ApiError.unauthorized('Authentication required');
      }

      const taskId = req.params.taskId || req.params.id;
      if (!taskId) {
        throw ApiError.badRequest('Task identifier is required');
      }

      // 1. Fetch task STRICTLY scoped to authenticated tenant
      const taskQuery = db('tasks').where('task_id', taskId);
      if (req.tenantId) {
        taskQuery.andWhere('tenant_id', req.tenantId);
      }
      const task = await taskQuery.first();

      if (!task) {
        throw ApiError.notFound('Task not found');
      }

      // 2. Fetch parent project scoped to authenticated tenant
      const projectQuery = db('projects').where('project_id', task.project_id);
      if (req.tenantId) {
        projectQuery.andWhere('tenant_id', req.tenantId);
      }
      const project = await projectQuery.first();
      if (!project) {
        throw ApiError.notFound('Parent project not found');
      }

      // 3. Enforce dynamic RBAC permission when specified
      if (requiredPermission && req.tenantId) {
        const requiredList = Array.isArray(requiredPermission)
          ? requiredPermission
          : [requiredPermission];
        const allowedByRbac = requiredList.some((perm) => hasPerm(req, perm));
        if (!allowedByRbac) {
          throw ApiError.forbidden(
            `Access denied. Required permission: ${requiredList.join(' or ')}.`
          );
        }
      }

      // 4. Company Admin oversight
      if (req.isCompanyAdmin) {
        req.task = task;
        req.project = project;
        req.projectMembership = { role: 'project_manager', isInheritedFromTenantAdmin: true };
        return next();
      }

      // 5. Legacy org owner/admin inheritance
      if (project.organization_id) {
        const orgMember = await db('organization_members')
          .where({
            organization_id: project.organization_id,
            user_id: req.user.user_id,
          })
          .first();
        if (orgMember && (orgMember.role === 'owner' || orgMember.role === 'admin')) {
          req.task = task;
          req.project = project;
          req.projectMembership = { role: 'lead', isInherited: true };
          return next();
        }
      }

      // 6. Direct project membership verification (tenant-scoped)
      const memberQuery = db('project_members').where({
        project_id: task.project_id,
        user_id: req.user.user_id,
      });
      if (req.tenantId) {
        memberQuery.andWhere('tenant_id', req.tenantId);
      }
      const projectMember = await memberQuery.first();

      if (!projectMember) {
        if (hasPerm(req, 'projects.update') || hasPerm(req, 'reports.view')) {
          req.task = task;
          req.project = project;
          req.projectMembership = { role: 'project_manager', isInheritedFromPermission: true };
          return next();
        }
        throw ApiError.forbidden('You are not a member of the project this task belongs to');
      }

      if (!requiredPermission) {
        const userLevel = PROJECT_ROLE_LEVELS[projectMember.role] || 0;
        const requiredLevel = PROJECT_ROLE_LEVELS[minProjectRole] || 1;
        if (userLevel < requiredLevel) {
          throw ApiError.forbidden(
            `Insufficient permissions. Requires '${minProjectRole}' project role or higher to perform this action.`
          );
        }
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
  requirePermission,
  requireAllPermissions,
  requireOrgMember,
  requireProjectAccess,
  requireTaskAccess,
};
