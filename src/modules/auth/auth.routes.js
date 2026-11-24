import { Router } from 'express';
import authController from './auth.controller.js';
import { validateRequest } from '../../middleware/validateRequest.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authLimiter } from '../../middleware/rateLimiter.js';
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from './auth.validation.js';

const router = Router();

/**
 * @route   POST /api/v1/auth/register
 * @desc    Register a new user account
 * @access  Public (Rate limited)
 */
router.post(
  '/register',
  authLimiter,
  validateRequest({ body: registerSchema }),
  authController.register
);

/**
 * @route   POST /api/v1/auth/login
 * @desc    Authenticate user & issue JWT
 * @access  Public (Rate limited)
 */
router.post(
  '/login',
  authLimiter,
  validateRequest({ body: loginSchema }),
  authController.login
);

/**
 * @route   POST /api/v1/auth/logout
 * @desc    Log out the current user session and clear auth cookie
 * @access  Public (idempotent — clears cookie even if token is already expired)
 */
router.post(
  '/logout',
  authController.logout
);

/**
 * @route   GET /api/v1/auth/me
 * @desc    Get currently authenticated user's profile
 * @access  Private
 */
router.get(
  '/me',
  authenticate,
  authController.getMe
);

/**
 * @route   POST /api/v1/auth/forgot-password
 * @desc    Generate password reset token and dispatch email
 * @access  Public (Rate limited)
 */
router.post(
  '/forgot-password',
  authLimiter,
  validateRequest({ body: forgotPasswordSchema }),
  authController.forgotPassword
);

/**
 * @route   POST /api/v1/auth/reset-password
 * @desc    Verify token and update password atomically
 * @access  Public (Rate limited)
 */
router.post(
  '/reset-password',
  authLimiter,
  validateRequest({ body: resetPasswordSchema }),
  authController.resetPassword
);

export default router;
