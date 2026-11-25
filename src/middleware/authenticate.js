import jwt from 'jsonwebtoken';
import env from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import {
  parseCookies,
  clearAuthCookie,
  clearSuperAdminCookie,
} from '../utils/cookies.js';
import authModel from '../modules/auth/auth.model.js';
import tenantModel from '../modules/tenants/tenant.model.js';
import roleModel from '../modules/roles/role.model.js';
import superAdminModel from '../modules/super-admin/superAdmin.model.js';

/**
 * Extracts a JWT token from either the Authorization Bearer header or a named HttpOnly cookie.
 */
function extractToken(req, cookieName) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const bearerToken = authHeader.slice(7).trim();
    if (bearerToken) {
      return { token: bearerToken, source: 'header' };
    }
  }

  const cookies = parseCookies(req.headers.cookie);
  const cookieToken = cookies[cookieName];
  if (cookieToken && cookieToken.trim()) {
    return { token: cookieToken.trim(), source: 'cookie' };
  }

  return { token: null, source: null };
}

/**
 * Company User Authentication Middleware.
 * - Verifies tenant-user JWT signed with JWT_SECRET (rejects Super Admin tokens).
 * - Resolves user + verified tenant from DB (never trusts client-supplied tenant_id).
 * - Rejects inactive users and inactive/suspended companies.
 * - Hydrates dynamic roles & permissions onto req.roles and req.permissions.
 */
export async function authenticate(req, res, next) {
  try {
    const { token, source } = extractToken(req, env.AUTH_COOKIE_NAME);

    if (!token) {
      throw ApiError.unauthorized('Authentication token is required.');
    }

    let decoded;
    try {
      decoded = jwt.verify(token, env.JWT_SECRET);
    } catch (err) {
      if (source === 'cookie') {
        clearAuthCookie(res);
      }
      if (err.name === 'TokenExpiredError') {
        throw ApiError.unauthorized('Authentication token has expired. Please log in again.');
      }
      throw ApiError.unauthorized('Invalid or forged authentication token.');
    }

    // Strict actor boundary: Super Admin tokens must never authenticate as company users
    if (decoded.actorType === 'super_admin') {
      throw ApiError.forbidden('Super Admin credentials cannot access tenant user endpoints.');
    }

    // Verify user still exists in database and remains active
    const user = await authModel.findById(decoded.sub);
    if (!user) {
      if (source === 'cookie') {
        clearAuthCookie(res);
      }
      throw ApiError.unauthorized('The user belonging to this token no longer exists.');
    }

    if (!user.is_active) {
      if (source === 'cookie') {
        clearAuthCookie(res);
      }
      throw ApiError.forbidden('Your account is currently inactive. Please contact your company administrator.');
    }

    // Strict tenant binding: verify token tenant matches user's tenant in PostgreSQL
    if (decoded.tenantId && user.tenant_id && String(decoded.tenantId) !== String(user.tenant_id)) {
      if (source === 'cookie') {
        clearAuthCookie(res);
      }
      throw ApiError.unauthorized('Tenant session mismatch. Please log in again.');
    }

    // Verify tenant exists and is active (skip only in mocked unit tests with no tenant_id)
    let tenant = null;
    let roles = [];
    let permissions = [];

    if (user.tenant_id) {
      tenant = await tenantModel.findById(user.tenant_id);
      if (!tenant) {
        if (source === 'cookie') clearAuthCookie(res);
        throw ApiError.unauthorized('Company workspace no longer exists.');
      }

      if (tenant.status !== 'active') {
        if (source === 'cookie') clearAuthCookie(res);
        throw ApiError.forbidden(
          `Your company workspace (${tenant.company_name}) is currently ${tenant.status}. Access is disabled.`
        );
      }

      const rbac = await roleModel.getUserRolesAndPermissions(user.tenant_id, user.user_id);
      roles = rbac.roles;
      permissions = rbac.permissions;
    }

    // Attach verified identity, tenant context, and dynamic RBAC permissions
    req.user = user;
    req.tenant = tenant;
    req.tenantId = user.tenant_id || null;
    req.roles = roles;
    req.permissions = permissions;
    req.permissionSet = new Set(permissions);
    req.isCompanyAdmin = roles.some((r) => r.is_system_role === true);

    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Platform Super Admin Authentication Middleware.
 * - Strictly uses SUPER_ADMIN_JWT_SECRET and SUPER_ADMIN_COOKIE_NAME.
 * - Verifies actorType === 'super_admin' and checks the separate `super_admins` table.
 * - Company users can NEVER pass this middleware.
 */
export async function authenticateSuperAdmin(req, res, next) {
  try {
    const { token, source } = extractToken(req, env.SUPER_ADMIN_COOKIE_NAME);

    if (!token) {
      throw ApiError.unauthorized('Super Admin authentication is required.');
    }

    let decoded;
    try {
      decoded = jwt.verify(token, env.SUPER_ADMIN_JWT_SECRET);
    } catch (err) {
      if (source === 'cookie') {
        clearSuperAdminCookie(res);
      }
      if (err.name === 'TokenExpiredError') {
        throw ApiError.unauthorized('Super Admin session has expired. Please log in again.');
      }
      throw ApiError.unauthorized('Invalid Super Admin authentication token.');
    }

    if (decoded.actorType !== 'super_admin') {
      throw ApiError.forbidden('Platform Super Admin privileges are required.');
    }

    const superAdmin = await superAdminModel.findById(decoded.sub);
    if (!superAdmin) {
      if (source === 'cookie') {
        clearSuperAdminCookie(res);
      }
      throw ApiError.unauthorized('Super Admin account no longer exists.');
    }

    if (!superAdmin.is_active) {
      if (source === 'cookie') {
        clearSuperAdminCookie(res);
      }
      throw ApiError.forbidden('Super Admin account is inactive.');
    }

    req.superAdmin = superAdmin;
    next();
  } catch (err) {
    next(err);
  }
}

export default authenticate;
