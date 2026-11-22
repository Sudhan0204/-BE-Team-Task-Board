/**
 * Parses and sanitizes pagination and sorting query parameters.
 *
 * @param {Object} query - Express req.query object
 * @param {Object} options - Configuration options
 * @param {number} [options.defaultLimit=20] - Default records per page
 * @param {number} [options.maxLimit=100] - Hard cap on page size
 * @param {string[]} [options.allowedSortColumns=['created_at']] - Allowlist of sortable columns
 * @param {string} [options.defaultSort='created_at'] - Default sort column
 * @param {'asc'|'desc'} [options.defaultOrder='desc'] - Default sort order
 */
export function getPaginationParams(query = {}, options = {}) {
  const defaultLimit = options.defaultLimit || 20;
  const maxLimit = options.maxLimit || 100;
  const allowedSortColumns = options.allowedSortColumns || ['created_at'];
  const defaultSort = options.defaultSort || 'created_at';
  const defaultOrder = (options.defaultOrder || 'desc').toLowerCase();

  let page = parseInt(query.page, 10);
  if (isNaN(page) || page < 1) {
    page = 1;
  }

  let limit = parseInt(query.limit, 10);
  if (isNaN(limit) || limit < 1) {
    limit = defaultLimit;
  } else if (limit > maxLimit) {
    limit = maxLimit;
  }

  const offset = (page - 1) * limit;

  // Validate sort column against strict allowlist to prevent SQL injection
  let sortBy = defaultSort;
  if (query.sortBy && allowedSortColumns.includes(query.sortBy)) {
    sortBy = query.sortBy;
  }

  // Validate sort direction
  let sortOrder = defaultOrder;
  if (query.sortOrder) {
    const orderLower = String(query.sortOrder).toLowerCase();
    if (orderLower === 'asc' || orderLower === 'desc') {
      sortOrder = orderLower;
    }
  }

  return {
    page,
    limit,
    offset,
    sortBy,
    sortOrder,
  };
}

export default {
  getPaginationParams,
};
