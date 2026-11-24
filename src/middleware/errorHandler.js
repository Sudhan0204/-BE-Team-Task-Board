import { ApiError } from '../utils/ApiError.js';
import { sendError } from '../utils/apiResponse.js';
import logger from '../config/logger.js';
import env from '../config/env.js';

/**
 * Maps known PostgreSQL error codes to user-friendly ApiError instances
 */
function handleDatabaseError(err) {
  switch (err.code) {
    case '23505': {
      // Unique violation (e.g., duplicate email, slug, project_key)
      const detail = err.detail || '';
      let field = 'resource';
      const match = detail.match(/Key \((.*?)\)=/);
      if (match && match[1]) {
        field = match[1];
      }
      return ApiError.conflict(`A record with this ${field} already exists.`, [
        { field, message: `This ${field} is already in use.` },
      ]);
    }

    case '23503': {
      // Foreign key violation
      return ApiError.badRequest('Referenced entity does not exist or cannot be modified.');
    }

    case '23502': {
      // Not null violation
      const column = err.column || 'field';
      return ApiError.badRequest(`Missing required field: ${column}`, [
        { field: column, message: `${column} cannot be null` },
      ]);
    }

    case '22P02': {
      // Invalid text representation (e.g., passing invalid characters for BIGINT or UUID)
      return ApiError.badRequest('Invalid parameter format or type supplied.');
    }

    case '22001': {
      // String data right truncation (value exceeds character length)
      return ApiError.badRequest('Supplied text exceeds maximum allowed length.');
    }

    default:
      return null;
  }
}

/**
 * Maps Zod validation errors to standardized 422 errors
 */
function handleZodError(err) {
  const issues = err.issues || err.errors || [];
  const errors = issues.map((e) => ({
    field: e.path.join('.'),
    message: e.message,
  }));
  return ApiError.unprocessable('Validation failed', errors);
}

/**
 * Centralized Express error-handling middleware.
 * Must be registered AFTER all routes.
 */
export function errorHandler(err, req, res, next) {
  // 1. Handle JSON syntax parse error from express.json()
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return sendError(res, 400, 'Invalid JSON payload received.');
  }

  // 2. Map PostgreSQL database errors
  if (err.code && typeof err.code === 'string') {
    const dbMappedError = handleDatabaseError(err);
    if (dbMappedError) {
      return sendError(res, dbMappedError.statusCode, dbMappedError.message, dbMappedError.errors);
    }
  }

  // 3. Map Zod validation errors
  if (err.name === 'ZodError') {
    const zodError = handleZodError(err);
    return sendError(res, zodError.statusCode, zodError.message, zodError.errors);
  }

  // 4. Handle expected operational ApiError instances
  if (err instanceof ApiError) {
    if (!err.isOperational) {
      logger.error(`Non-operational ApiError: ${err.message}`, {
        stack: err.stack,
        url: req.originalUrl,
        method: req.method,
      });
    }
    return sendError(res, err.statusCode, err.message, err.errors);
  }

  // 5. Handle unexpected server errors
  logger.error(`Unhandled Server Error: ${err.message}`, {
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
  });

  const message = env.isProduction ? 'Internal server error' : err.message;
  return sendError(res, 500, message);
}

export default errorHandler;
