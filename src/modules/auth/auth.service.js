import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import authModel from './auth.model.js';
import { ApiError } from '../../utils/ApiError.js';
import env from '../../config/env.js';
import { sendPasswordResetEmail } from '../../config/email.js';
import logger from '../../config/logger.js';

const BCRYPT_SALT_ROUNDS = 12;

/**
 * Computes a SHA-256 hex digest for reset tokens
 */
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Generates a signed JWT access token containing safe user identity claims
 */
function generateToken(user) {
  return jwt.sign(
    {
      sub: String(user.user_id),
      email: user.email,
    },
    env.JWT_SECRET,
    {
      expiresIn: env.JWT_EXPIRES_IN,
    }
  );
}

export const authService = {
  /**
   * Registers a new user account
   */
  async register({ full_name, email, password, avatar_url }) {
    const normalizedEmail = email.trim().toLowerCase();

    // Check duplicate email
    const existingUser = await authModel.findByEmail(normalizedEmail);
    if (existingUser) {
      throw ApiError.conflict('An account with this email address already exists.', [
        { field: 'email', message: 'Email address is already registered' },
      ]);
    }

    // Hash password securely with bcrypt
    const password_hash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

    // Persist new user
    const newUser = await authModel.create({
      full_name: full_name.trim(),
      email: normalizedEmail,
      password_hash,
      avatar_url: avatar_url || null,
    });

    const token = generateToken(newUser);

    return {
      user: newUser,
      token,
    };
  },

  /**
   * Authenticates user credentials with enumeration-resistant timing
   */
  async login({ email, password }) {
    const normalizedEmail = email.trim().toLowerCase();

    // Fetch user including password_hash for verification
    const user = await authModel.findByEmail(normalizedEmail, true);

    if (!user) {
      // Use generic error message to prevent user enumeration
      throw ApiError.unauthorized('Invalid email or password.');
    }

    if (!user.is_active) {
      throw ApiError.forbidden('Your account is currently inactive. Please contact support.');
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      throw ApiError.unauthorized('Invalid email or password.');
    }

    // Strip password_hash from response payload
    const { password_hash, ...safeUser } = user;
    const token = generateToken(safeUser);

    return {
      user: safeUser,
      token,
    };
  },

  /**
   * Retrieves profile for the authenticated user
   */
  async getCurrentUser(userId) {
    const user = await authModel.findById(userId);
    if (!user) {
      throw ApiError.notFound('User account not found.');
    }
    if (!user.is_active) {
      throw ApiError.forbidden('User account is inactive.');
    }
    return user;
  },

  /**
   * Initiates password recovery workflow
   */
  async requestPasswordReset({ email }) {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await authModel.findByEmail(normalizedEmail);

    // If user does not exist, return silently without disclosing existence to prevent enumeration
    if (!user) {
      logger.info(`Password reset requested for non-existent email: ${normalizedEmail}`);
      return {
        message: 'If an account with that email exists, password reset instructions have been sent.',
      };
    }

    if (!user.is_active) {
      // Do not allow password reset on deactivated accounts
      return {
        message: 'If an account with that email exists, password reset instructions have been sent.',
      };
    }

    // Generate cryptographically random 32-byte hex token (64 hex characters)
    const rawResetToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(rawResetToken);

    // Token expires in 1 hour
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

  /**
   * Consumes a reset token and updates the user's password atomically
   */
  async resetPassword({ token, password }) {
    const tokenHash = hashToken(token.trim());

    // Locate active, unconsumed, non-expired token
    const tokenRecord = await authModel.findValidResetToken(tokenHash);

    if (!tokenRecord) {
      throw ApiError.badRequest('Password reset token is invalid, expired, or has already been used.');
    }

    // Hash the new password securely
    const password_hash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

    // Execute atomic update in Knex transaction
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
