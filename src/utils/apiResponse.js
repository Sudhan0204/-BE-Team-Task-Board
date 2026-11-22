/**
 * Sends a standardized success response.
 *
 * @param {import('express').Response} res
 * @param {string} message
 * @param {any} [data=null]
 * @param {number} [statusCode=200]
 */
export function sendSuccess(res, message = 'Success', data = null, statusCode = 200) {
  const payload = {
    success: true,
    message,
  };

  if (data !== null && data !== undefined) {
    payload.data = data;
  }

  return res.status(statusCode).json(payload);
}

/**
 * Sends a 201 Created response.
 */
export function sendCreated(res, message = 'Resource created successfully', data = null) {
  return sendSuccess(res, message, data, 201);
}

/**
 * Sends a 204 No Content response.
 */
export function sendNoContent(res) {
  return res.status(204).send();
}

/**
 * Sends a paginated response adhering to the specification.
 *
 * @param {import('express').Response} res
 * @param {any[]} data
 * @param {{ page: number, limit: number, total: number }} paginationInfo
 * @param {string} [message='Data retrieved successfully']
 */
export function sendPaginated(res, data, { page, limit, total }, message = 'Data retrieved successfully') {
  const totalPages = Math.ceil(total / limit) || 1;

  return res.status(200).json({
    success: true,
    message,
    data,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total: Number(total),
      totalPages,
    },
  });
}

/**
 * Sends a standardized error response.
 *
 * @param {import('express').Response} res
 * @param {number} statusCode
 * @param {string} message
 * @param {Array<{ field?: string, message: string }>} [errors=[]]
 */
export function sendError(res, statusCode = 500, message = 'An unexpected error occurred', errors = []) {
  const payload = {
    success: false,
    message,
  };

  if (errors && errors.length > 0) {
    payload.errors = errors;
  }

  return res.status(statusCode).json(payload);
}

export default {
  sendSuccess,
  sendCreated,
  sendNoContent,
  sendPaginated,
  sendError,
};
