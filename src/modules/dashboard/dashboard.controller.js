import dashboardService from './dashboard.service.js';
import { sendSuccess, sendPaginated } from '../../utils/apiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

export const dashboardController = {
  getSummary: asyncHandler(async (req, res) => {
    const summary = await dashboardService.getSummary(req.user.user_id);
    return sendSuccess(res, 'Dashboard summary retrieved successfully', summary);
  }),

  getMyTasks: asyncHandler(async (req, res) => {
    const { tasks, pagination } = await dashboardService.getMyTasks(
      req.user.user_id,
      req.query
    );
    return sendPaginated(res, tasks, pagination, 'User tasks retrieved successfully');
  }),
};

export default dashboardController;
