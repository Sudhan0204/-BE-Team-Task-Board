import dashboardModel from './dashboard.model.js';
import { getPaginationParams } from '../../utils/pagination.js';

export const dashboardService = {
  /**
   * Retrieves high-level metrics summary scoped to user's permissions
   */
  async getSummary(userId) {
    return dashboardModel.getSummary(userId);
  },

  /**
   * Retrieves tasks assigned to current user across all projects with pagination
   */
  async getMyTasks(userId, query) {
    const pagination = getPaginationParams(query, {
      defaultLimit: 20,
      maxLimit: 100,
    });

    const { tasks, total } = await dashboardModel.getMyTasks(userId, pagination);

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
