import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../app.js';
import dashboardModel from '../../modules/dashboard/dashboard.model.js';
import authModel from '../../modules/auth/auth.model.js';
import jwt from 'jsonwebtoken';
import env from '../../config/env.js';

vi.mock('../../modules/dashboard/dashboard.model.js');
vi.mock('../../modules/auth/auth.model.js');

describe('Dashboard Module - API Tests', () => {
  const token = jwt.sign({ sub: '1', email: 'dev@example.com' }, env.JWT_SECRET);

  beforeEach(() => {
    vi.clearAllMocks();
    authModel.findById.mockResolvedValue({
      user_id: '1',
      full_name: 'Lead Engineer',
      email: 'dev@example.com',
      is_active: true,
    });
  });

  describe('GET /api/v1/dashboard/summary', () => {
    it('should return aggregated workspace metrics', async () => {
      dashboardModel.getSummary.mockResolvedValueOnce({
        totalProjects: 4,
        totalTasks: 42,
        myAssignedTasks: 12,
        completedTasks: 18,
        overdueTasks: 2,
        urgentTasks: 3,
        tasksByStatus: {
          backlog: 5,
          todo: 8,
          in_progress: 7,
          in_review: 4,
          done: 18,
          cancelled: 0,
        },
      });

      const res = await request(app)
        .get('/api/v1/dashboard/summary')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totalProjects).toBe(4);
      expect(res.body.data.myAssignedTasks).toBe(12);
      expect(res.body.data.tasksByStatus.done).toBe(18);
    });
  });

  describe('GET /api/v1/dashboard/my-tasks', () => {
    it('should return paginated tasks assigned to authenticated user', async () => {
      dashboardModel.getMyTasks.mockResolvedValueOnce({
        tasks: [
          {
            task_id: '101',
            project_id: '1',
            project_name: 'Core Platform',
            project_key: 'DEV',
            title: 'Implement database connection pool',
            status: 'in_progress',
            priority: 'urgent',
          },
        ],
        total: 1,
      });

      const res = await request(app)
        .get('/api/v1/dashboard/my-tasks')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].project_key).toBe('DEV');
    });
  });
});
