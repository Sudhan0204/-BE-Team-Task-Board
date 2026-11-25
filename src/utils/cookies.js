import env from '../config/env.js';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Parses an HTTP Cookie header string into a key-value map.
 * Avoids adding an external cookie-parser dependency.
 *
 * @param {string | undefined} cookieHeader
 * @returns {Record<string, string>}
 */
export function parseCookies(cookieHeader) {
  const cookies = {};
  if (!cookieHeader || typeof cookieHeader !== 'string') {
    return cookies;
  }

  for (const part of cookieHeader.split(';')) {
    const eqIndex = part.indexOf('=');
    if (eqIndex === -1) continue;
    const key = part.slice(0, eqIndex).trim();
    const rawVal = part.slice(eqIndex + 1).trim();
    if (!key) continue;
    try {
      cookies[key] = decodeURIComponent(rawVal);
    } catch {
      cookies[key] = rawVal;
    }
  }

  return cookies;
}

/**
 * Returns base cookie options matching current deployment environment.
 */
function getBaseCookieOptions() {
  return {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: 'lax',
    path: '/',
  };
}

/**
 * Attaches the signed JWT inside an HttpOnly cookie on the HTTP response.
 *
 * @param {import('express').Response} res
 * @param {string} token
 * @param {{ rememberMe?: boolean }} [options]
 */
export function setAuthCookie(res, token, { rememberMe = true } = {}) {
  const options = {
    ...getBaseCookieOptions(),
    ...(rememberMe ? { maxAge: THIRTY_DAYS_MS } : { maxAge: SEVEN_DAYS_MS }),
  };

  res.cookie(env.AUTH_COOKIE_NAME, token, options);
}

/**
 * Clears the authentication cookie on logout or session invalidation.
 *
 * @param {import('express').Response} res
 */
export function clearAuthCookie(res) {
  res.clearCookie(env.AUTH_COOKIE_NAME, getBaseCookieOptions());
}

/**
 * Sets the Platform Super Admin HttpOnly cookie (strictly separate cookie name).
 */
export function setSuperAdminCookie(res, token) {
  res.cookie(env.SUPER_ADMIN_COOKIE_NAME, token, {
    ...getBaseCookieOptions(),
    maxAge: 12 * 60 * 60 * 1000,
  });
}

/**
 * Clears the Platform Super Admin HttpOnly cookie.
 */
export function clearSuperAdminCookie(res) {
  res.clearCookie(env.SUPER_ADMIN_COOKIE_NAME, getBaseCookieOptions());
}

export default {
  parseCookies,
  setAuthCookie,
  clearAuthCookie,
  setSuperAdminCookie,
  clearSuperAdminCookie,
};
