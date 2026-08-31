'use strict';

const ApiError = require('../utils/ApiError');
const env = require('../config/env');

/**
 * 404 handler for unmatched routes.
 */
function notFoundHandler(req, res, next) {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
}

/**
 * Central error handler. Translates ApiError and known PostgreSQL errors
 * into consistent JSON responses.
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // Known application errors.
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      error: err.message,
      ...(err.details ? { details: err.details } : {}),
    });
  }

  // PostgreSQL unique-violation -> 409 Conflict.
  if (err && err.code === '23505') {
    return res.status(409).json({
      error: 'A record with these details already exists',
      ...(err.constraint ? { details: { constraint: err.constraint } } : {}),
    });
  }

  // PostgreSQL foreign-key violation -> 409 Conflict.
  if (err && err.code === '23503') {
    return res.status(409).json({
      error: 'Operation violates a reference to another record',
      ...(err.constraint ? { details: { constraint: err.constraint } } : {}),
    });
  }

  // Malformed JSON body.
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON in request body' });
  }

  // Fallback: unexpected server error.
  console.error('Unhandled error:', err);
  return res.status(500).json({
    error: 'Internal server error',
    ...(env.nodeEnv === 'development' ? { detail: err.message } : {}),
  });
}

module.exports = { notFoundHandler, errorHandler };
