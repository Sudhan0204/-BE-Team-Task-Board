import dashboardModel from './dashboard.model.js';
import { getPaginationParams } from '../../utils/pagination.js';

export const dashboardService = {
  async getSummary(userId, tenantId = null, canViewAll = false) {
    return dashboardModel.getSummary(userId, tenantId, canViewAll);
  },

  async getCompanyDashboard(tenantId) {
    return dashboardModel.getCompanyDashboard(tenantId);
  },

  async getMyTasks(userId, query, tenantId = null, canViewAll = false) {
    const pagination = getPaginationParams(query, {
      defaultLimit: 20,
      maxLimit: 100,
    });

    const { tasks, total } = await dashboardModel.getMyTasks(
      userId,
      pagination,
      tenantId,
      canViewAll
    );

    return {
      tasks,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
      },
    };
  },
};

export default dashboardService;
