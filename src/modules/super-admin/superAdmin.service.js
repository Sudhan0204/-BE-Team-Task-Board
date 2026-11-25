import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import superAdminModel from './superAdmin.model.js';
import { ApiError } from '../../utils/ApiError.js';
import env from '../../config/env.js';

function generateSuperAdminToken(superAdmin) {
  return jwt.sign(
    {
      sub: String(superAdmin.super_admin_id),
      email: superAdmin.email,
      actorType: 'super_admin',
    },
    env.SUPER_ADMIN_JWT_SECRET,
    {
      expiresIn: env.SUPER_ADMIN_JWT_EXPIRES_IN,
    }
  );
}

export const superAdminService = {
  async login({ email, password }) {
    const normalizedEmail = email.trim().toLowerCase();
    const superAdmin = await superAdminModel.findByEmail(normalizedEmail, true);

    if (!superAdmin) {
      throw ApiError.unauthorized('Invalid Super Admin credentials.');
    }

    if (!superAdmin.is_active) {
      throw ApiError.forbidden('Super Admin account is inactive.');
    }

    const isMatch = await bcrypt.compare(password, superAdmin.password_hash);
    if (!isMatch) {
      throw ApiError.unauthorized('Invalid Super Admin credentials.');
    }

    const { password_hash, ...safeSuperAdmin } = superAdmin;
    const token = generateSuperAdminToken(safeSuperAdmin);

    return {
      superAdmin: safeSuperAdmin,
      token,
    };
  },

  async getMe(superAdminId) {
    const superAdmin = await superAdminModel.findById(superAdminId);
    if (!superAdmin) {
      throw ApiError.notFound('Super Admin account not found.');
    }
    return superAdmin;
  },

  async getDashboard() {
    return superAdminModel.getPlatformMetrics();
  },

  async listPlans() {
    return superAdminModel.listPlans();
  },

  async createPlan(data) {
    return superAdminModel.createPlan(data);
  },

  async updatePlan(planId, updates) {
    const existing = await superAdminModel.findPlanById(planId);
    if (!existing) {
      throw ApiError.notFound('Subscription plan not found.');
    }
    return superAdminModel.updatePlan(planId, updates);
  },
};

export default superAdminService;
