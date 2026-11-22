import jwt from 'jsonwebtoken';
import env from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import authModel from '../modules/auth/auth.model.js';

/**
 * Authentication middleware that verifies JWT Bearer tokens and attaches the verified user to req.user.
 */
export async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw ApiError.unauthorized('Authentication token is required.');
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      throw ApiError.unauthorized('Authentication token is malformed.');
    }

    let decoded;
    try {
      decoded = jwt.verify(token, env.JWT_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        throw ApiError.unauthorized('Authentication token has expired. Please log in again.');
      }
      throw ApiError.unauthorized('Invalid or forged authentication token.');
    }

    // Verify user still exists in database and remains active
    const user = await authModel.findById(decoded.sub);
    if (!user) {
      throw ApiError.unauthorized('The user belonging to this token no longer exists.');
    }

    if (!user.is_active) {
      throw ApiError.forbidden('Your account is currently inactive. Please contact support.');
    }

    // Attach verified user identity
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

export default authenticate;
