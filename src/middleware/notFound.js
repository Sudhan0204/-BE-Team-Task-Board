import { ApiError } from '../utils/ApiError.js';

/**
 * 404 Not Found middleware for catching unregistered routes
 */
export function notFound(req, res, next) {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
}

export default notFound;
