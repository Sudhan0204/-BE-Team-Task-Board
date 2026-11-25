import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../app.js';
import authModel from '../../modules/auth/auth.model.js';
import jwt from 'jsonwebtoken';
import env from '../../config/env.js';

vi.mock('../../modules/tasks/task.model.js');
vi.mock('../../modules/projects/project.model.js');
vi.mock('../../modules/auth/auth.model.js');
vi.mock('../../middleware/authorize.js', () => ({
  requirePermission: () => (req, res, next) => next(),
  requireAllPermissions: () => (req, res, next) => next(),
  requireOrgMember: () => (req, res, next) => next(),
  requireProjectAccess: () => (req, res, next) => {
    req.project = { project_id: req.params.projectId, organization_id: '1' };
    next();
  },
  requireTaskAccess: () => (req, res, next) => {
    req.task = { task_id: req.params.taskId, project_id: '1', status: 'todo' };
    req.project = { project_id: '1', organization_id: '1' };
    next();
  },
  default: {},
}));

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

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
    });

    it('should reject empty title with 422 Unprocessable Entity', async () => {
      const res = await request(app)
        .post('/api/v1/projects/1/tasks')
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: '',
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
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

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
    });
  });
});
