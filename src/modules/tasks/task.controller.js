import taskService from './task.service.js';
import { sendSuccess, sendCreated, sendNoContent, sendPaginated } from '../../utils/apiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

export const taskController = {
  /**
   * GET /api/tasks (Tenant-scoped tasks across accessible projects)
   */
  listAll: asyncHandler(async (req, res) => {
    const permSet = req.permissionSet || new Set();
    const canViewAll =
      req.isCompanyAdmin || permSet.has('projects.update') || permSet.has('reports.view');

    const { tasks, pagination } = await taskService.listTenantTasks(
      req.tenantId,
      req.user.user_id,
      canViewAll,
      req.query
    );
    return sendPaginated(res, tasks, pagination, 'Tasks retrieved successfully');
  }),

  /**
   * POST /api/tasks (or POST /api/projects/:projectId/tasks)
   */
  create: asyncHandler(async (req, res) => {
    const projectId = req.params.projectId || req.body.project_id;
    const task = await taskService.createTask(
      projectId,
      req.user.user_id,
      req.body,
      req.tenantId
    );
    return sendCreated(res, 'Task created successfully', { task });
  }),

  getById: asyncHandler(async (req, res) => {
    const task = await taskService.getTaskById(req.params.taskId, req.tenantId);
    return sendSuccess(res, 'Task retrieved successfully', { task });
  }),

  list: asyncHandler(async (req, res) => {
    const { tasks, pagination } = await taskService.listTasks(
      req.params.projectId,
      req.query,
      req.tenantId
    );
    return sendPaginated(res, tasks, pagination, 'Tasks retrieved successfully');
  }),

  getBoard: asyncHandler(async (req, res) => {
    const board = await taskService.getKanbanBoard(req.params.projectId, req.tenantId);
    return sendSuccess(res, 'Kanban board retrieved successfully', board);
  }),

  update: asyncHandler(async (req, res) => {
    const updated = await taskService.updateTask(
      req.params.taskId,
      req.task,
      req.user.user_id,
      req.body,
      req.tenantId
    );
    return sendSuccess(res, 'Task updated successfully', { task: updated });
  }),

  updateStatus: asyncHandler(async (req, res) => {
    const updated = await taskService.updateStatus(
      req.params.taskId,
      req.task,
      req.user.user_id,
      req.body.status,
      req.tenantId
    );
    return sendSuccess(res, 'Task status updated successfully', { task: updated });
  }),

  updateAssignee: asyncHandler(async (req, res) => {
    const updated = await taskService.updateAssignee(
      req.params.taskId,
      req.task,
      req.user.user_id,
      req.body.assigned_to,
      req.tenantId
    );
    return sendSuccess(res, 'Task assignee updated successfully', { task: updated });
  }),

  updatePosition: asyncHandler(async (req, res) => {
    const updated = await taskService.updatePosition(
      req.params.taskId,
      req.task,
      req.user.user_id,
      req.body.position,
      req.body.status,
      req.tenantId
    );
    return sendSuccess(res, 'Task position updated successfully', { task: updated });
  }),

  delete: asyncHandler(async (req, res) => {
    await taskService.deleteTask(req.params.taskId, req.tenantId);
    return sendNoContent(res);
  }),

  getActivity: asyncHandler(async (req, res) => {
    const activity = await taskService.getProjectActivity(req.params.projectId, req.tenantId);
    return sendSuccess(res, 'Project activity logs retrieved successfully', { activity });
  }),
};

export default taskController;
