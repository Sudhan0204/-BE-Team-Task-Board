import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import authModel from './auth.model.js';
import tenantModel from '../tenants/tenant.model.js';
import roleModel from '../roles/role.model.js';
import { ApiError } from '../../utils/ApiError.js';
import env from '../../config/env.js';
import { sendPasswordResetEmail } from '../../config/email.js';
import logger from '../../config/logger.js';

const BCRYPT_SALT_ROUNDS = 12;

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Generates a signed JWT access token bound to both user_id and tenant_id.
 */
function generateToken(user, expiresIn = env.JWT_EXPIRES_IN) {
  return jwt.sign(
    {
      sub: String(user.user_id),
      email: user.email,
      ...(user.tenant_id ? { tenantId: String(user.tenant_id) } : {}),
      actorType: 'company_user',
    },
    env.JWT_SECRET,
    {
      expiresIn,
    }
  );
}

export const authService = {
  /**
   * Registers a new user account (attaches to resolved tenant or default workspace).
   */
  async register({ full_name, email, password, avatar_url, tenant_slug }) {
    const normalizedEmail = email.trim().toLowerCase();

    // Resolve tenant when DB is active (gracefully handles mocked unit tests)
    let tenant = null;
    if (tenant_slug) {
      tenant = await tenantModel.findBySlug(tenant_slug);
      if (!tenant) {
        throw ApiError.notFound(`Company workspace '${tenant_slug}' was not found.`);
      }
      if (tenant.status !== 'active') {
        throw ApiError.forbidden(`Company workspace '${tenant.company_name}' is not active.`);
      }
    } else if (!env.isTest) {
      tenant = await tenantModel.getDefaultTenant();
    }

    const existingUser = tenant
      ? await authModel.findByTenantAndEmail(tenant.tenant_id, normalizedEmail)
      : await authModel.findByEmail(normalizedEmail);

    if (existingUser) {
      throw ApiError.conflict('An account with this email address already exists.', [
        { field: 'email', message: 'Email address is already registered' },
      ]);
    }

    const password_hash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

    const newUser = await authModel.create({
      tenant_id: tenant?.tenant_id,
      full_name: full_name.trim(),
      email: normalizedEmail,
      password_hash,
      avatar_url: avatar_url || null,
    });

    // Assign default Employee role on the tenant if available
    let roles = [];
    let permissions = [];
    if (tenant && newUser?.user_id) {
      const employeeRole = await roleModel.findByName(tenant.tenant_id, 'Employee');
      if (employeeRole) {
        await roleModel.setUserRoles(tenant.tenant_id, newUser.user_id, [employeeRole.role_id]);
      }
      const rbac = await roleModel.getUserRolesAndPermissions(tenant.tenant_id, newUser.user_id);
      roles = rbac.roles;
      permissions = rbac.permissions;
    }

    const token = generateToken(newUser);

    return {
      user: newUser,
      tenant,
      roles,
      permissions,
      token,
    };
  },

  /**
   * Authenticates company user / company admin within a verified active tenant context.
   */
  async login({ email, password, remember_me, tenant_slug, requireAdmin = false }) {
    const normalizedEmail = email.trim().toLowerCase();
    const resolvedSlug = tenant_slug?.trim().toLowerCase() || null;

    let tenant = null;
    let user = null;

    if (resolvedSlug) {
      tenant = await tenantModel.findBySlug(resolvedSlug);
      if (!tenant) {
        throw ApiError.notFound(`Company workspace '${resolvedSlug}' was not found.`);
      }
      if (tenant.status !== 'active') {
        throw ApiError.forbidden(
          `The company workspace '${tenant.company_name}' is currently ${tenant.status}. Login is disabled.`
        );
      }

      user = await authModel.findByTenantAndEmail(tenant.tenant_id, normalizedEmail, true);
    } else {
      // Auto-resolve when tenant slug wasn't explicitly supplied
      const matches = typeof authModel.findAllByEmail === 'function'
        ? await authModel.findAllByEmail(normalizedEmail, true)
        : null;

      if (Array.isArray(matches) && matches.length > 1) {
        throw ApiError.badRequest(
          'This email exists in multiple companies. Please specify your company workspace slug (e.g. ?tenant=kovai).'
        );
      }

      user = Array.isArray(matches) && matches.length === 1
        ? matches[0]
        : await authModel.findByEmail(normalizedEmail, true);

      if (user?.tenant_id) {
        tenant = await tenantModel.findById(user.tenant_id);
      }
    }

    if (!user) {
      throw ApiError.unauthorized('Invalid email or password.');
    }

    if (tenant && tenant.status !== 'active') {
      throw ApiError.forbidden(
        `Your company workspace (${tenant.company_name}) is currently ${tenant.status}. Please contact your administrator.`
      );
    }

    if (!user.is_active) {
      throw ApiError.forbidden('Your account is currently inactive. Please contact your company administrator.');
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      throw ApiError.unauthorized('Invalid email or password.');
    }

    let roles = [];
    let permissions = [];

    if (user.tenant_id) {
      const rbac = await roleModel.getUserRolesAndPermissions(user.tenant_id, user.user_id);
      roles = rbac.roles;
      permissions = rbac.permissions;
    }

    if (requireAdmin) {
      const permSet = new Set(permissions);
      const hasAdminAccess =
        roles.some((r) => r.is_system_role) ||
        permSet.has('employees.view') ||
        permSet.has('roles.view') ||
        permSet.has('settings.view');

      if (!hasAdminAccess) {
        throw ApiError.forbidden(
          'Company Administrator access is required to sign in to the Admin Portal. Please use the Employee Login.'
        );
      }
    }

    const { password_hash, ...safeUser } = user;
    const expiresIn = remember_me ? env.JWT_REMEMBER_EXPIRES_IN : env.JWT_EXPIRES_IN;
    const token = generateToken(safeUser, expiresIn);

    return {
      user: safeUser,
      tenant,
      roles,
      permissions,
      token,
    };
  },

  /**
   * Retrieves profile, company branding, roles, and dynamic permissions for authenticated user.
   */
  async getCurrentUser(userId) {
    const user = await authModel.findById(userId);
    if (!user) {
      throw ApiError.notFound('User account not found.');
    }
    if (!user.is_active) {
      throw ApiError.forbidden('User account is inactive.');
    }

    let tenant = null;
    let roles = [];
    let permissions = [];

    if (user.tenant_id) {
      [tenant, { roles, permissions }] = await Promise.all([
        tenantModel.findById(user.tenant_id),
        roleModel.getUserRolesAndPermissions(user.tenant_id, user.user_id),
      ]);
    }

    return { user, tenant, roles, permissions };
  },

  async requestPasswordReset({ email }) {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await authModel.findByEmail(normalizedEmail);

    if (!user || !user.is_active) {
      logger.info(`Password reset requested for email: ${normalizedEmail}`);
      return {
        message: 'If an account with that email exists, password reset instructions have been sent.',
      };
    }

    const rawResetToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(rawResetToken);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await authModel.createResetToken({
      user_id: user.user_id,
      token_hash: tokenHash,
      expires_at: expiresAt,
    });

    const resetUrl = `${env.FRONTEND_URL}/reset-password?token=${rawResetToken}`;

    try {
      await sendPasswordResetEmail({
        to: user.email,
        userName: user.full_name,
        resetUrl,
      });
    } catch (err) {
      logger.error('Failed to deliver password reset email', { error: err.message });
      throw ApiError.internal('Unable to send password recovery email. Please try again later.');
    }

    return {
      message: 'If an account with that email exists, password reset instructions have been sent.',
    };
  },

  async resetPassword({ token, password }) {
    const tokenHash = hashToken(token.trim());
    const tokenRecord = await authModel.findValidResetToken(tokenHash);

    if (!tokenRecord) {
      throw ApiError.badRequest('Password reset token is invalid, expired, or has already been used.');
    }

    const password_hash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
    const updatedUser = await authModel.consumeResetTokenAndUpdatePassword({
      token_id: tokenRecord.token_id,
      user_id: tokenRecord.user_id,
      password_hash,
    });

    logger.info(`Password successfully reset for user_id: ${tokenRecord.user_id}`);

    return {
      message: 'Password has been reset successfully. You can now log in with your new password.',
      user: updatedUser,
    };
  },
};

export default authService;
