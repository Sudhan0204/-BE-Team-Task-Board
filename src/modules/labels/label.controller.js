import labelService from './label.service.js';
import { sendSuccess, sendCreated, sendNoContent } from '../../utils/apiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

export const labelController = {
  create: asyncHandler(async (req, res) => {
    const label = await labelService.createLabel(req.params.projectId, req.body);
    return sendCreated(res, 'Label created successfully', { label });
  }),

  list: asyncHandler(async (req, res) => {
    const labels = await labelService.listLabels(req.params.projectId);
    return sendSuccess(res, 'Labels retrieved successfully', { labels });
  }),

  update: asyncHandler(async (req, res) => {
    const label = await labelService.updateLabel(req.params.labelId, req.body);
    return sendSuccess(res, 'Label updated successfully', { label });
  }),

  delete: asyncHandler(async (req, res) => {
    await labelService.deleteLabel(req.params.labelId);
    return sendNoContent(res);
  }),

  assignToTask: asyncHandler(async (req, res) => {
    const result = await labelService.assignLabelToTask(req.params.taskId, req.params.labelId);
    return sendSuccess(res, 'Label assigned to task successfully', result);
  }),

  removeFromTask: asyncHandler(async (req, res) => {
    await labelService.removeLabelFromTask(req.params.taskId, req.params.labelId);
    return sendNoContent(res);
  }),

  getTaskLabels: asyncHandler(async (req, res) => {
    const labels = await labelService.getTaskLabels(req.params.taskId);
    return sendSuccess(res, 'Task labels retrieved successfully', { labels });
  }),
};

export default labelController;
