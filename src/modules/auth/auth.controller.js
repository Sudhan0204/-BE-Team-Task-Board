import authService from './auth.service.js';
import { sendSuccess, sendCreated } from '../../utils/apiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { setAuthCookie, clearAuthCookie } from '../../utils/cookies.js';
import { extractTenantSlug } from '../../middleware/resolveTenant.js';

export const authController = {
  /**
   * POST /api/auth/register
   */
  register: asyncHandler(async (req, res) => {
    const tenant_slug = extractTenantSlug(req);
    const result = await authService.register({ ...req.body, tenant_slug });
    setAuthCookie(res, result.token, { rememberMe: true });
    return sendCreated(res, 'User registered successfully', result);
  }),

  /**
   * POST /api/auth/login (Employee & Company User Login)
   */
  login: asyncHandler(async (req, res) => {
    const tenant_slug = extractTenantSlug(req);
    const result = await authService.login({
      ...req.body,
      tenant_slug,
      requireAdmin: false,
    });
    setAuthCookie(res, result.token, { rememberMe: req.body.remember_me !== false });
    return sendSuccess(res, 'Login successful', result);
  }),

  /**
   * POST /api/admin/login (Company Admin Portal Login)
   */
  adminLogin: asyncHandler(async (req, res) => {
    const tenant_slug = extractTenantSlug(req);
    const result = await authService.login({
      ...req.body,
      tenant_slug,
      requireAdmin: true,
    });
    setAuthCookie(res, result.token, { rememberMe: req.body.remember_me !== false });
    return sendSuccess(res, 'Company Admin login successful', result);
  }),

  /**
   * POST /api/auth/logout
   */
  logout: asyncHandler(async (req, res) => {
    clearAuthCookie(res);
    return sendSuccess(res, 'Logged out successfully.');
  }),

  /**
   * GET /api/auth/me
   */
  getMe: asyncHandler(async (req, res) => {
    const profile = await authService.getCurrentUser(req.user.user_id);
    return sendSuccess(res, 'Current user profile retrieved successfully', profile);
  }),

  /**
   * POST /api/auth/forgot-password
   */
  forgotPassword: asyncHandler(async (req, res) => {
    const result = await authService.requestPasswordReset(req.body);
    return sendSuccess(res, result.message);
  }),

  /**
   * POST /api/auth/reset-password
   */
  resetPassword: asyncHandler(async (req, res) => {
    const result = await authService.resetPassword(req.body);
    return sendSuccess(res, result.message, { user: result.user });
  }),
};

export default authController;
