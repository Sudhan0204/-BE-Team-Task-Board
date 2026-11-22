import taskService from './task.service.js';
import { sendSuccess, sendCreated, sendNoContent, sendPaginated } from '../../utils/apiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

export const taskController = {
  create: asyncHandler(async (req, res) => {
    const task = await taskService.createTask(
      req.params.projectId,
      req.user.user_id,
      req.body
    );
    return sendCreated(res, 'Task created successfully', { task });
  }),

  getById: asyncHandler(async (req, res) => {
    const task = await taskService.getTaskById(req.params.taskId);
    return sendSuccess(res, 'Task retrieved successfully', { task });
  }),

  list: asyncHandler(async (req, res) => {
    const { tasks, pagination } = await taskService.listTasks(
      req.params.projectId,
      req.query
    );
    return sendPaginated(res, tasks, pagination, 'Tasks retrieved successfully');
  }),

  getBoard: asyncHandler(async (req, res) => {
    const board = await taskService.getKanbanBoard(req.params.projectId);
    return sendSuccess(res, 'Kanban board retrieved successfully', board);
  }),

  update: asyncHandler(async (req, res) => {
    const updated = await taskService.updateTask(
      req.params.taskId,
      req.task,
      req.user.user_id,
      req.body
    );
    return sendSuccess(res, 'Task updated successfully', { task: updated });
  }),

  updateStatus: asyncHandler(async (req, res) => {
    const updated = await taskService.updateStatus(
      req.params.taskId,
      req.task,
      req.user.user_id,
      req.body.status
    );
    return sendSuccess(res, 'Task status updated successfully', { task: updated });
  }),

  updateAssignee: asyncHandler(async (req, res) => {
    const updated = await taskService.updateAssignee(
      req.params.taskId,
      req.task,
      req.user.user_id,
      req.body.assigned_to
    );
    return sendSuccess(res, 'Task assignee updated successfully', { task: updated });
  }),

  updatePosition: asyncHandler(async (req, res) => {
    const updated = await taskService.updatePosition(
      req.params.taskId,
      req.task,
      req.user.user_id,
      req.body.position,
      req.body.status
    );
    return sendSuccess(res, 'Task position updated successfully', { task: updated });
  }),

  delete: asyncHandler(async (req, res) => {
    await taskService.deleteTask(req.params.taskId);
    return sendNoContent(res);
  }),

  getActivity: asyncHandler(async (req, res) => {
    const activity = await taskService.getProjectActivity(req.params.projectId);
    return sendSuccess(res, 'Project activity logs retrieved successfully', { activity });
  }),
};

export default taskController;
