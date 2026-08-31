'use strict';

const bcrypt = require('bcryptjs');
const env = require('../config/env');

/**
 * Hash a plain-text password with bcrypt.
 * @param {string} plain
 * @returns {Promise<string>}
 */
function hashPassword(plain) {
  return bcrypt.hash(plain, env.bcryptRounds);
}

/**
 * Compare a plain-text password against a stored bcrypt hash.
 * @param {string} plain
 * @param {string} hash
 * @returns {Promise<boolean>}
 */
function comparePassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

module.exports = { hashPassword, comparePassword };
