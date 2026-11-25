import projectService from './project.service.js';
import { sendSuccess, sendCreated, sendNoContent, sendPaginated } from '../../utils/apiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

export const projectController = {
  /**
   * GET /api/projects (Tenant-scoped project listing)
   */
  list: asyncHandler(async (req, res) => {
    const permSet = req.permissionSet || new Set();
    const canViewAll =
      req.isCompanyAdmin ||
      permSet.has('projects.update') ||
      permSet.has('projects.delete') ||
      permSet.has('reports.view');

    const { projects, pagination } = await projectService.listTenantProjects(
      req.tenantId,
      req.user.user_id,
      canViewAll,
      req.query
    );
    return sendPaginated(res, projects, pagination, 'Projects retrieved successfully');
  }),

  /**
   * POST /api/projects (Tenant-scoped project creation)
   */
  createDirect: asyncHandler(async (req, res) => {
    const project = await projectService.createProject(
      req.body.organization_id || null,
      req.user.user_id,
      req.body,
      req.tenantId
    );
    return sendCreated(res, 'Project created successfully', { project });
  }),

  /**
   * POST /api/organizations/:organizationId/projects (Legacy compatibility)
   */
  create: asyncHandler(async (req, res) => {
    const project = await projectService.createProject(
      req.params.organizationId,
      req.user.user_id,
      req.body,
      req.tenantId
    );
    return sendCreated(res, 'Project created successfully', { project });
  }),

  /**
   * GET /api/organizations/:organizationId/projects (Legacy compatibility)
   */
  listByOrg: asyncHandler(async (req, res) => {
    const { projects, pagination } = await projectService.listProjects(
      req.params.organizationId,
      req.query,
      req.tenantId
    );
    return sendPaginated(res, projects, pagination, 'Projects retrieved successfully');
  }),

  getById: asyncHandler(async (req, res) => {
    const project = await projectService.getProjectById(req.params.projectId, req.tenantId);
    return sendSuccess(res, 'Project retrieved successfully', { project });
  }),

  update: asyncHandler(async (req, res) => {
    const project = await projectService.updateProject(
      req.params.projectId,
      req.body,
      req.tenantId
    );
    return sendSuccess(res, 'Project updated successfully', { project });
  }),

  delete: asyncHandler(async (req, res) => {
    await projectService.deleteProject(req.params.projectId, req.tenantId);
    return sendNoContent(res);
  }),

  getMembers: asyncHandler(async (req, res) => {
    const members = await projectService.getProjectMembers(req.params.projectId, req.tenantId);
    return sendSuccess(res, 'Project members retrieved successfully', { members });
  }),

  addMember: asyncHandler(async (req, res) => {
    const member = await projectService.addProjectMember(
      req.params.projectId,
      req.body,
      req.tenantId
    );
    return sendCreated(res, 'Member added to project successfully', { member });
  }),

  updateMemberRole: asyncHandler(async (req, res) => {
    const member = await projectService.updateProjectMemberRole(
      req.params.projectId,
      req.params.userId,
      req.body.role,
      req.tenantId
    );
    return sendSuccess(res, 'Project member role updated successfully', { member });
  }),

  removeMember: asyncHandler(async (req, res) => {
    await projectService.removeProjectMember(
      req.params.projectId,
      req.params.userId,
      req.tenantId
    );
    return sendNoContent(res);
  }),
};

export default projectController;
