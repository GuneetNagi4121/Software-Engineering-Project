'use strict';

const { verifyToken } = require('../utils/jwt');
const ApiError = require('../utils/ApiError');

/**
 * Authentication middleware.
 * Reads a Bearer token, verifies it, and attaches `req.user = { id, role }`.
 */
function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return next(ApiError.unauthorized('Missing or malformed Authorization header'));
  }

  try {
    const payload = verifyToken(token);
    req.user = { id: payload.id, role: payload.role };
    return next();
  } catch (err) {
    return next(ApiError.unauthorized('Invalid or expired token'));
  }
}

/**
 * Role-based authorization middleware factory.
 * Must run after `authenticate`.
 *
 *   router.post('/', authenticate, authorize('ADMIN'), handler)
 *
 * @param {...string} allowedRoles
 */
function authorize(...allowedRoles) {
  return function authorizeRole(req, res, next) {
    if (!req.user) {
      return next(ApiError.unauthorized());
    }
    if (!allowedRoles.includes(req.user.role)) {
      return next(ApiError.forbidden('This action requires one of the roles: ' + allowedRoles.join(', ')));
    }
    return next();
  };
}

module.exports = { authenticate, authorize };
