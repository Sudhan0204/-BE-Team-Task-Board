import projectService from './project.service.js';
import { sendSuccess, sendCreated, sendNoContent, sendPaginated } from '../../utils/apiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

export const projectController = {
  create: asyncHandler(async (req, res) => {
    const project = await projectService.createProject(
      req.params.organizationId,
      req.user.user_id,
      req.body
    );
    return sendCreated(res, 'Project created successfully', { project });
  }),

  listByOrg: asyncHandler(async (req, res) => {
    const { projects, pagination } = await projectService.listProjects(
      req.params.organizationId,
      req.query
    );
    return sendPaginated(res, projects, pagination, 'Projects retrieved successfully');
  }),

  getById: asyncHandler(async (req, res) => {
    const project = await projectService.getProjectById(req.params.projectId);
    return sendSuccess(res, 'Project retrieved successfully', { project });
  }),

  update: asyncHandler(async (req, res) => {
    const project = await projectService.updateProject(req.params.projectId, req.body);
    return sendSuccess(res, 'Project updated successfully', { project });
  }),

  delete: asyncHandler(async (req, res) => {
    await projectService.deleteProject(req.params.projectId);
    return sendNoContent(res);
  }),

  getMembers: asyncHandler(async (req, res) => {
    const members = await projectService.getProjectMembers(req.params.projectId);
    return sendSuccess(res, 'Project members retrieved successfully', { members });
  }),

  addMember: asyncHandler(async (req, res) => {
    const member = await projectService.addProjectMember(req.params.projectId, req.body);
    return sendCreated(res, 'Member added to project successfully', { member });
  }),

  updateMemberRole: asyncHandler(async (req, res) => {
    const member = await projectService.updateProjectMemberRole(
      req.params.projectId,
      req.params.userId,
      req.body.role
    );
    return sendSuccess(res, 'Project member role updated successfully', { member });
  }),

  removeMember: asyncHandler(async (req, res) => {
    await projectService.removeProjectMember(req.params.projectId, req.params.userId);
    return sendNoContent(res);
  }),
};

export default projectController;
