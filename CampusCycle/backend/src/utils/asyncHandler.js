'use strict';

/**
 * Wrap an async Express handler so rejected promises are forwarded to
 * `next()` and handled by the central error handler.
 * @param {Function} fn
 */
function asyncHandler(fn) {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = asyncHandler;
