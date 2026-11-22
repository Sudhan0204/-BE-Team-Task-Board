import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../app.js';
import organizationModel from '../../modules/organizations/organization.model.js';
import authModel from '../../modules/auth/auth.model.js';
import jwt from 'jsonwebtoken';
import env from '../../config/env.js';

vi.mock('../../modules/organizations/organization.model.js');
vi.mock('../../modules/auth/auth.model.js');

describe('Organization Module - API Tests', () => {
  const token = jwt.sign({ sub: '1', email: 'owner@example.com' }, env.JWT_SECRET);

  beforeEach(() => {
    vi.clearAllMocks();
    authModel.findById.mockResolvedValue({
      user_id: '1',
      full_name: 'Org Owner',
      email: 'owner@example.com',
      is_active: true,
    });
  });

  describe('POST /api/v1/organizations', () => {
    it('should create an organization and return 201 Created', async () => {
      organizationModel.findBySlug.mockResolvedValueOnce(null);
      organizationModel.create.mockResolvedValueOnce({
        organization_id: '10',
        name: 'Acme Corp',
        slug: 'acme-corp',
        created_by: '1',
      });

      const res = await request(app)
        .post('/api/v1/organizations')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Acme Corp',
          slug: 'acme-corp',
          description: 'Acme software products',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.organization.slug).toBe('acme-corp');
    });

    it('should reject duplicate organization slug with 409 Conflict', async () => {
      organizationModel.findBySlug.mockResolvedValueOnce({ organization_id: '5', slug: 'acme-corp' });

      const res = await request(app)
        .post('/api/v1/organizations')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Acme Duplicate',
          slug: 'acme-corp',
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('already exists');
    });
  });

  describe('GET /api/v1/organizations/:organizationId', () => {
    it('should forbid user if they are not a member of the organization (403 Forbidden)', async () => {
      // Mock db query inside authorize.js returning null membership
      organizationModel.findById.mockResolvedValueOnce({ organization_id: '99', name: 'Secret Org' });

      const res = await request(app)
        .get('/api/v1/organizations/99')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
    });
  });
});
