import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../app.js';
import notificationModel from '../../modules/notifications/notification.model.js';
import authModel from '../../modules/auth/auth.model.js';
import jwt from 'jsonwebtoken';
import env from '../../config/env.js';

vi.mock('../../modules/notifications/notification.model.js');
vi.mock('../../modules/auth/auth.model.js');

describe('Notifications Module - API Tests', () => {
  const token = jwt.sign({ sub: '1', email: 'user@example.com' }, env.JWT_SECRET);

  beforeEach(() => {
    vi.clearAllMocks();
    authModel.findById.mockResolvedValue({
      user_id: '1',
      full_name: 'Regular User',
      email: 'user@example.com',
      is_active: true,
    });
  });

  describe('GET /api/v1/notifications', () => {
    it('should return paginated notifications for current user', async () => {
      notificationModel.listByUser.mockResolvedValueOnce({
        notifications: [
          {
            notification_id: '10',
            user_id: '1',
            title: 'Task Assigned',
            message: 'You were assigned to task: Core auth',
            is_read: false,
          },
        ],
        total: 1,
      });

      const res = await request(app)
        .get('/api/v1/notifications')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(1);
      expect(res.body.pagination.total).toBe(1);
    });
  });

  describe('PATCH /api/v1/notifications/:notificationId/read', () => {
    it('should forbid marking another user notification as read with 403', async () => {
      notificationModel.findById.mockResolvedValueOnce({
        notification_id: '10',
        user_id: '999', // Different user!
        title: 'Secret Alert',
      });

      const res = await request(app)
        .patch('/api/v1/notifications/10/read')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });
});
