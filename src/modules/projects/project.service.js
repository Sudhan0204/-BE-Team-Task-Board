import projectModel from './project.model.js';
import organizationModel from '../organizations/organization.model.js';
import authModel from '../auth/auth.model.js';
import { ApiError } from '../../utils/ApiError.js';
import { getPaginationParams } from '../../utils/pagination.js';

const ALLOWED_SORT_COLUMNS = ['name', 'project_key', 'status', 'created_at', 'due_date'];

export const projectService = {
  /**
   * Create a new project within an organization
   */
  async createProject(organizationId, userId, data) {
    const projectKey = data.project_key.trim().toUpperCase();

    // Check project key uniqueness within the organization
    const existing = await projectModel.findByOrgAndKey(organizationId, projectKey);
    if (existing) {
      throw ApiError.conflict(
        `A project with key '${projectKey}' already exists in this organization.`,
        [{ field: 'project_key', message: 'Project key must be unique within the organization' }]
      );
    }

    return projectModel.create({
      organization_id: organizationId,
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
   * List projects belonging to an organization with pagination
   */
  async listProjects(organizationId, query) {
    const pagination = getPaginationParams(query, {
      defaultLimit: 20,
      maxLimit: 50,
      allowedSortColumns: ALLOWED_SORT_COLUMNS,
      defaultSort: 'created_at',
      defaultOrder: 'desc',
    });

    const { projects, total } = await projectModel.listByOrganization(organizationId, pagination);

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
   * Retrieve project by ID
   */
  async getProjectById(projectId) {
    const project = await projectModel.findById(projectId);
    if (!project) {
      throw ApiError.notFound('Project not found.');
    }
    return project;
  },

  /**
   * Update project details
   */
  async updateProject(projectId, updates) {
    const project = await projectModel.findById(projectId);
    if (!project) {
      throw ApiError.notFound('Project not found.');
    }

    const updated = await projectModel.update(projectId, updates);
    return updated;
  },

  /**
   * Delete a project
   */
  async deleteProject(projectId) {
    const project = await projectModel.findById(projectId);
    if (!project) {
      throw ApiError.notFound('Project not found.');
    }

    await projectModel.delete(projectId);
    return { success: true };
  },

  /**
   * List members of a project
   */
  async getProjectMembers(projectId) {
    return projectModel.getMembers(projectId);
  },

  /**
   * Add a member to a project with organization membership validation
   */
  async addProjectMember(projectId, { user_id, role }) {
    const project = await projectModel.findById(projectId);
    if (!project) {
      throw ApiError.notFound('Project not found.');
    }

    // 1. Verify user exists
    const targetUser = await authModel.findById(user_id);
    if (!targetUser) {
      throw ApiError.notFound('Target user was not found.');
    }

    // 2. CRITICAL: Verify user belongs to parent organization
    const orgMembership = await organizationModel.getMember(project.organization_id, user_id);
    if (!orgMembership) {
      throw ApiError.badRequest(
        'User must be a member of the parent organization before being added to a project.'
      );
    }

    // 3. Verify user is not already a project member
    const existingMember = await projectModel.getMember(projectId, user_id);
    if (existingMember) {
      throw ApiError.conflict('User is already assigned to this project.');
    }

    return projectModel.addMember({
      project_id: projectId,
      user_id,
      role: role || 'developer',
    });
  },

  /**
   * Update a project member's role
   */
  async updateProjectMemberRole(projectId, targetUserId, newRole) {
    const member = await projectModel.getMember(projectId, targetUserId);
    if (!member) {
      throw ApiError.notFound('Project member not found.');
    }

    // If demoting project_manager, ensure another project_manager remains
    if (member.role === 'project_manager' && newRole !== 'project_manager') {
      const leadCount = await projectModel.countLeads(projectId);
      if (leadCount <= 1) {
        throw ApiError.badRequest(
          'Cannot demote the only project manager. Assign another project_manager first.'
        );
      }
    }

    return projectModel.updateMemberRole(projectId, targetUserId, newRole);
  },

  /**
   * Remove a member from a project
   */
  async removeProjectMember(projectId, targetUserId) {
    const member = await projectModel.getMember(projectId, targetUserId);
    if (!member) {
      throw ApiError.notFound('Project member not found.');
    }

    if (member.role === 'project_manager') {
      const leadCount = await projectModel.countLeads(projectId);
      if (leadCount <= 1) {
        throw ApiError.badRequest(
          'Cannot remove the only project manager. Reassign the project_manager role first.'
        );
      }
    }

    await projectModel.removeMember(projectId, targetUserId);
    return { success: true };
  },
};

export default projectService;
