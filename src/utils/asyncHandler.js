/**
 * Wraps an asynchronous Express route handler or middleware to automatically
 * forward any unhandled rejections/exceptions to the centralized error middleware.
 *
 * @param {Function} fn - Async controller function (req, res, next)
 * @returns {Function} Express middleware function
 */
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

export default asyncHandler;
