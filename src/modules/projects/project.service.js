import projectModel from './project.model.js';
import tenantModel from '../tenants/tenant.model.js';
import employeeModel from '../employees/employee.model.js';
import { ApiError } from '../../utils/ApiError.js';
import { getPaginationParams } from '../../utils/pagination.js';

const ALLOWED_SORT_COLUMNS = ['name', 'project_key', 'status', 'created_at', 'due_date'];

export const projectService = {
  /**
   * Create a new tenant-scoped project (supports both /api/projects and /api/organizations/:id/projects)
   */
  async createProject(organizationId, userId, data, tenantId = null) {
    const projectKey = data.project_key.trim().toUpperCase();

    if (tenantId) {
      // Check subscription project limit
      const [subscription, usage] = await Promise.all([
        tenantModel.getActiveSubscription(tenantId),
        tenantModel.countUsage(tenantId),
      ]);
      if (subscription?.max_projects && usage.projects >= Number(subscription.max_projects)) {
        throw ApiError.forbidden(
          `Project limit (${subscription.max_projects}) reached for your current subscription plan.`
        );
      }

      const existing = await projectModel.findByTenantAndKey(tenantId, projectKey);
      if (existing) {
        throw ApiError.conflict(
          `A project with key '${projectKey}' already exists in this company.`,
          [{ field: 'project_key', message: 'Project key must be unique within the company' }]
        );
      }
    } else if (organizationId) {
      const existing = await projectModel.findByOrgAndKey(organizationId, projectKey);
      if (existing) {
        throw ApiError.conflict(
          `A project with key '${projectKey}' already exists in this organization.`,
          [{ field: 'project_key', message: 'Project key must be unique within the organization' }]
        );
      }
    }

    return projectModel.create({
      tenant_id: tenantId,
      organization_id: organizationId || null,
      name: data.name.trim(),
      description: data.description,
      project_key: projectKey,
      status: data.status || 'active',
      start_date: data.start_date,
      due_date: data.due_date,
      created_by: userId,
    });
  },

  /**
   * List projects for the authenticated tenant accessible to the user
   */
  async listTenantProjects(tenantId, userId, canViewAll, query) {
    const pagination = getPaginationParams(query, {
      defaultLimit: 50,
      maxLimit: 100,
      allowedSortColumns: ALLOWED_SORT_COLUMNS,
      defaultSort: 'created_at',
      defaultOrder: 'desc',
    });

    const { projects, total } = await projectModel.listByTenant(tenantId, userId, {
      canViewAll,
      search: query.search,
      status: query.status,
      ...pagination,
    });

    return {
      projects,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
      },
    };
  },

  /**
   * List projects belonging to an organization (tenant-scoped)
   */
  async listProjects(organizationId, query, tenantId = null) {
    const pagination = getPaginationParams(query, {
      defaultLimit: 20,
      maxLimit: 50,
      allowedSortColumns: ALLOWED_SORT_COLUMNS,
      defaultSort: 'created_at',
      defaultOrder: 'desc',
    });

    const { projects, total } = await projectModel.listByOrganization(
      organizationId,
      pagination,
      tenantId
    );

    return {
      projects,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
      },
    };
  },

  async getProjectById(projectId, tenantId = null) {
    const project = await projectModel.findById(projectId, tenantId);
    if (!project) {
      throw ApiError.notFound('Project not found.');
    }
    return project;
  },

  async updateProject(projectId, updates, tenantId = null) {
    const project = await projectModel.findById(projectId, tenantId);
    if (!project) {
      throw ApiError.notFound('Project not found.');
    }
    return projectModel.update(projectId, updates, tenantId);
  },

  async deleteProject(projectId, tenantId = null) {
    const project = await projectModel.findById(projectId, tenantId);
    if (!project) {
      throw ApiError.notFound('Project not found.');
    }
    await projectModel.delete(projectId, tenantId);
    return { success: true };
  },

  async getProjectMembers(projectId, tenantId = null) {
    return projectModel.getMembers(projectId, tenantId);
  },

  /**
   * Add a member to a project — STRICTLY validates target user belongs to the SAME tenant!
   */
  async addProjectMember(projectId, { user_id, role }, tenantId = null) {
    const project = await projectModel.findById(projectId, tenantId);
    if (!project) {
      throw ApiError.notFound('Project not found.');
    }

    const effectiveTenantId = tenantId || project.tenant_id;

    // CRITICAL: Target employee must belong to the EXACT SAME tenant
    const targetEmployee = await employeeModel.findById(effectiveTenantId, user_id);
    if (!targetEmployee) {
      throw ApiError.badRequest(
        'Target user does not belong to this company workspace and cannot be added to this project.'
      );
    }

    if (!targetEmployee.is_active) {
      throw ApiError.badRequest('Inactive employees cannot be added to a project.');
    }

    const existingMember = await projectModel.getMember(projectId, user_id, effectiveTenantId);
    if (existingMember) {
      throw ApiError.conflict('Employee is already assigned to this project.');
    }

    return projectModel.addMember({
      tenant_id: effectiveTenantId,
      project_id: projectId,
      user_id,
      role: role || 'developer',
    });
  },

  async updateProjectMemberRole(projectId, targetUserId, newRole, tenantId = null) {
    const member = await projectModel.getMember(projectId, targetUserId, tenantId);
    if (!member) {
      throw ApiError.notFound('Project member not found.');
    }

    if (member.role === 'project_manager' && newRole !== 'project_manager') {
      const leadCount = await projectModel.countLeads(projectId, tenantId);
      if (leadCount <= 1) {
        throw ApiError.badRequest(
          'Cannot demote the only project manager. Assign another project_manager first.'
        );
      }
    }

    return projectModel.updateMemberRole(projectId, targetUserId, newRole, tenantId);
  },

  async removeProjectMember(projectId, targetUserId, tenantId = null) {
    const member = await projectModel.getMember(projectId, targetUserId, tenantId);
    if (!member) {
      throw ApiError.notFound('Project member not found.');
    }

    if (member.role === 'project_manager') {
      const leadCount = await projectModel.countLeads(projectId, tenantId);
      if (leadCount <= 1) {
        throw ApiError.badRequest(
          'Cannot remove the only project manager. Reassign the project_manager role first.'
        );
      }
    }

    await projectModel.removeMember(projectId, targetUserId, tenantId);
    return { success: true };
  },
};

export default projectService;
