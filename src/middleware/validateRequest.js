import { ApiError } from '../utils/ApiError.js';

/**
 * Higher-order middleware factory that validates request parts using Zod schemas.
 *
 * @param {Object} schemas - Schema mapping
 * @param {import('zod').ZodTypeAny} [schemas.body] - Schema for req.body
 * @param {import('zod').ZodTypeAny} [schemas.query] - Schema for req.query
 * @param {import('zod').ZodTypeAny} [schemas.params] - Schema for req.params
 */
export function validateRequest(schemas) {
  return (req, res, next) => {
    try {
      if (schemas.body) {
        req.body = schemas.body.parse(req.body);
      }

      if (schemas.query) {
        // req.query is a getter-only property in Express — cannot reassign directly.
        // Parse and merge validated values back into the existing query object.
        const parsed = schemas.query.parse(req.query);
        Object.assign(req.query, parsed);
      }

      if (schemas.params) {
        req.params = schemas.params.parse(req.params);
      }

      next();
    } catch (err) {
      if (err.name === 'ZodError') {
        const issues = err.issues || err.errors || [];
        const validationErrors = issues.map((e) => ({
          field: e.path.join('.') || 'request',
          message: e.message,
        }));
        return next(ApiError.unprocessable('Validation failed', validationErrors));
      }
      next(err);
    }
  };
}

export default validateRequest;
