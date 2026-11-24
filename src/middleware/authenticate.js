import jwt from 'jsonwebtoken';
import env from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { parseCookies, clearAuthCookie } from '../utils/cookies.js';
import authModel from '../modules/auth/auth.model.js';

/**
 * Extracts a JWT token from either the Authorization Bearer header or the HttpOnly auth cookie.
 */
function extractToken(req) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const bearerToken = authHeader.slice(7).trim();
    if (bearerToken) {
      return { token: bearerToken, source: 'header' };
    }
  }

  const cookies = parseCookies(req.headers.cookie);
  const cookieToken = cookies[env.AUTH_COOKIE_NAME];
  if (cookieToken && cookieToken.trim()) {
    return { token: cookieToken.trim(), source: 'cookie' };
  }

  return { token: null, source: null };
}

/**
 * Authentication middleware that verifies JWT tokens (from Bearer header or HttpOnly cookie)
 * and attaches the verified user to req.user.
 */
export async function authenticate(req, res, next) {
  try {
    const { token, source } = extractToken(req);

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

    // Verify user still exists in database and remains active
    const user = await authModel.findById(decoded.sub);
    if (!user) {
      if (source === 'cookie') {
        clearAuthCookie(res);
      }
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
