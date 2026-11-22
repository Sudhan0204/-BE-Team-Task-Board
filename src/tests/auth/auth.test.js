import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../app.js';
import authModel from '../../modules/auth/auth.model.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import env from '../../config/env.js';

// Mock database operations to allow fast and reliable test execution
vi.mock('../../modules/auth/auth.model.js');
vi.mock('../../config/email.js', () => ({
  sendPasswordResetEmail: vi.fn().mockResolvedValue({ messageId: 'test-msg-id' }),
}));

describe('Auth Module - API Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/v1/auth/register', () => {
    it('should reject registration with missing fields with status 422', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'not-an-email',
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.errors).toBeDefined();
    });

    it('should reject registration if password does not meet complexity requirements', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          full_name: 'John Doe',
          email: 'john@example.com',
          password: 'simplepassword', // missing upper, number, special char
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
    });

    it('should reject registration when email already exists with status 409', async () => {
      authModel.findByEmail.mockResolvedValueOnce({
        user_id: '1',
        email: 'john@example.com',
      });

      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          full_name: 'John Doe',
          email: 'john@example.com',
          password: 'Password123!',
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('already exists');
    });

    it('should successfully register a new user and return status 201 with token', async () => {
      authModel.findByEmail.mockResolvedValueOnce(null);
      authModel.create.mockResolvedValueOnce({
        user_id: '101',
        full_name: 'Jane Doe',
        email: 'jane@example.com',
        avatar_url: null,
        is_active: true,
        email_verified: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          full_name: 'Jane Doe',
          email: 'jane@example.com',
          password: 'Password123!',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.user.email).toBe('jane@example.com');
      expect(res.body.data.user.password_hash).toBeUndefined();
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('should fail when user does not exist with status 401', async () => {
      authModel.findByEmail.mockResolvedValueOnce(null);

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'Password123!',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Invalid email or password.');
    });

    it('should fail when password is incorrect with status 401', async () => {
      const hashedPassword = await bcrypt.hash('CorrectPassword123!', 10);
      authModel.findByEmail.mockResolvedValueOnce({
        user_id: '101',
        email: 'user@example.com',
        password_hash: hashedPassword,
        is_active: true,
      });

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'user@example.com',
          password: 'WrongPassword123!',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Invalid email or password.');
    });

    it('should succeed with valid credentials and return token and safe user profile', async () => {
      const password = 'CorrectPassword123!';
      const hashedPassword = await bcrypt.hash(password, 10);
      authModel.findByEmail.mockResolvedValueOnce({
        user_id: '101',
        full_name: 'Alex Developer',
        email: 'alex@example.com',
        password_hash: hashedPassword,
        is_active: true,
        email_verified: true,
        avatar_url: null,
      });

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'alex@example.com',
          password,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.user.email).toBe('alex@example.com');
      expect(res.body.data.user.password_hash).toBeUndefined();
    });
  });

  describe('GET /api/v1/auth/me', () => {
    it('should reject access without Authorization header with status 401', async () => {
      const res = await request(app).get('/api/v1/auth/me');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should return the current user profile when valid bearer token is provided', async () => {
      const token = jwt.sign({ sub: '101', email: 'alex@example.com' }, env.JWT_SECRET, {
        expiresIn: '1h',
      });

      authModel.findById.mockResolvedValue({
        user_id: '101',
        full_name: 'Alex Developer',
        email: 'alex@example.com',
        is_active: true,
        email_verified: true,
      });

      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.user_id).toBe('101');
    });
  });
});
