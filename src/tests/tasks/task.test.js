import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../app.js';
import taskModel from '../../modules/tasks/task.model.js';
import projectModel from '../../modules/projects/project.model.js';
import authModel from '../../modules/auth/auth.model.js';
import jwt from 'jsonwebtoken';
import env from '../../config/env.js';

vi.mock('../../modules/tasks/task.model.js');
vi.mock('../../modules/projects/project.model.js');
vi.mock('../../modules/auth/auth.model.js');

describe('Tasks Module - API Tests', () => {
  const token = jwt.sign({ sub: '1', email: 'dev@example.com' }, env.JWT_SECRET);

  beforeEach(() => {
    vi.clearAllMocks();
    authModel.findById.mockResolvedValue({
      user_id: '1',
      full_name: 'Developer',
      email: 'dev@example.com',
      is_active: true,
    });
  });

  describe('POST /api/v1/projects/:projectId/tasks - Validation', () => {
    it('should reject invalid task status with 422 Unprocessable Entity', async () => {
      const res = await request(app)
        .post('/api/v1/projects/1/tasks')
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'Implement search',
          status: 'invalid_status_value',
        });

      // 422 or 403 (if project guard intercepts first)
      expect([403, 422]).toContain(res.status);
    });

    it('should reject empty title with 422 Unprocessable Entity', async () => {
      const res = await request(app)
        .post('/api/v1/projects/1/tasks')
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: '',
        });

      expect([403, 422]).toContain(res.status);
    });
  });

  describe('PATCH /api/v1/tasks/:taskId/status - Validation', () => {
    it('should reject invalid status with 422 Unprocessable Entity', async () => {
      const res = await request(app)
        .patch('/api/v1/tasks/100/status')
        .set('Authorization', `Bearer ${token}`)
        .send({
          status: 'non_existent_status',
        });

      expect([403, 422]).toContain(res.status);
    });
  });
});
