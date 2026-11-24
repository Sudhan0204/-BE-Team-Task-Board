import authService from './auth.service.js';
import { sendSuccess, sendCreated } from '../../utils/apiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { setAuthCookie, clearAuthCookie } from '../../utils/cookies.js';

export const authController = {
  /**
   * POST /api/v1/auth/register
   */
  register: asyncHandler(async (req, res) => {
    const result = await authService.register(req.body);
    setAuthCookie(res, result.token, { rememberMe: true });
    return sendCreated(res, 'User registered successfully', result);
  }),

  /**
   * POST /api/v1/auth/login
   */
  login: asyncHandler(async (req, res) => {
    const result = await authService.login(req.body);
    setAuthCookie(res, result.token, { rememberMe: req.body.remember_me !== false });
    return sendSuccess(res, 'Login successful', result);
  }),

  /**
   * POST /api/v1/auth/logout
   */
  logout: asyncHandler(async (req, res) => {
    clearAuthCookie(res);
    return sendSuccess(res, 'Logged out successfully.');
  }),

  /**
   * GET /api/v1/auth/me
   */
  getMe: asyncHandler(async (req, res) => {
    const user = await authService.getCurrentUser(req.user.user_id);
    return sendSuccess(res, 'Current user profile retrieved successfully', { user });
  }),

  /**
   * POST /api/v1/auth/forgot-password
   */
  forgotPassword: asyncHandler(async (req, res) => {
    const result = await authService.requestPasswordReset(req.body);
    return sendSuccess(res, result.message);
  }),

  /**
   * POST /api/v1/auth/reset-password
   */
  resetPassword: asyncHandler(async (req, res) => {
    const result = await authService.resetPassword(req.body);
    return sendSuccess(res, result.message, { user: result.user });
  }),
};

export default authController;
