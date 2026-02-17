/**
 * Wraps async route handlers to catch rejections and pass to error middleware.
 * @param {Function} fn - Async route handler (req, res, next)
 * @returns {Function} Express middleware
 */
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

export default asyncHandler;
