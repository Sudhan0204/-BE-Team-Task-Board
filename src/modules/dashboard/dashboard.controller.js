import dashboardService from './dashboard.service.js';
import { sendSuccess, sendPaginated } from '../../utils/apiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

export const dashboardController = {
  getSummary: asyncHandler(async (req, res) => {
    const canViewAll = req.isCompanyAdmin || req.permissionSet?.has('reports.view');
    const summary = await dashboardService.getSummary(req.user.user_id, req.tenantId, canViewAll);
    return sendSuccess(res, 'Dashboard summary retrieved successfully', summary);
  }),

  getCompanyDashboard: asyncHandler(async (req, res) => {
    const data = await dashboardService.getCompanyDashboard(req.tenantId);
    return sendSuccess(res, 'Company dashboard retrieved successfully', data);
  }),

  getMyTasks: asyncHandler(async (req, res) => {
    const canViewAll = req.isCompanyAdmin || req.permissionSet?.has('reports.view');
    const { tasks, pagination } = await dashboardService.getMyTasks(
      req.user.user_id,
      req.query,
      req.tenantId,
      canViewAll
    );
    return sendPaginated(res, tasks, pagination, 'User tasks retrieved successfully');
  }),
};

export default dashboardController;
