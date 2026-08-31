'use strict';

const ApiError = require('./ApiError');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

function isEmail(v) {
  return typeof v === 'string' && EMAIL_RE.test(v.trim());
}

/**
 * Password policy: at least 8 characters, containing at least one letter
 * and one digit. Kept intentionally simple but non-trivial.
 */
function isStrongPassword(v) {
  return (
    typeof v === 'string' &&
    v.length >= 8 &&
    /[A-Za-z]/.test(v) &&
    /[0-9]/.test(v)
  );
}

function isPositiveInt(v) {
  return Number.isInteger(v) && v > 0;
}

/**
 * Coerce a value to a positive integer or return null.
 */
function toPositiveInt(v) {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * Collect field errors and throw a single 422 ApiError if any exist.
 * Usage:
 *   const v = new FieldErrors();
 *   v.check(isEmail(email), 'email', 'A valid email is required');
 *   v.throwIfAny();
 */
class FieldErrors {
  constructor() {
    this.errors = {};
  }
  add(field, message) {
    if (!this.errors[field]) this.errors[field] = message;
    return this;
  }
  /** Add an error only when `condition` is falsy. */
  check(condition, field, message) {
    if (!condition) this.add(field, message);
    return this;
  }
  hasErrors() {
    return Object.keys(this.errors).length > 0;
  }
  throwIfAny(message = 'Validation failed') {
    if (this.hasErrors()) {
      throw ApiError.unprocessable(message, this.errors);
    }
  }
}

module.exports = {
  isNonEmptyString,
  isEmail,
  isStrongPassword,
  isPositiveInt,
  toPositiveInt,
  FieldErrors,
};
