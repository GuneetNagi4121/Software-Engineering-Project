'use strict';

const userModel = require('../models/userModel');
const { hashPassword, comparePassword } = require('../utils/password');
const { signToken } = require('../utils/jwt');
const ApiError = require('../utils/ApiError');
const { ROLES } = require('../utils/constants');
const { isEmail, isNonEmptyString, isStrongPassword, FieldErrors } = require('../utils/validators');

function publicUser(row) {
  return { id: row.id, name: row.name, email: row.email, role: row.role };
}

/**
 * Register a new account. Public registration always creates a STUDENT;
 * admin accounts are provisioned via seed data / the database directly to
 * prevent privilege escalation.
 */
async function register({ name, email, password }) {
  const v = new FieldErrors();
  v.check(isNonEmptyString(name), 'name', 'Name is required');
  v.check(isEmail(email), 'email', 'A valid email address is required');
  v.check(
    isStrongPassword(password),
    'password',
    'Password must be at least 8 characters and include a letter and a number'
  );
  v.throwIfAny();

  const normalizedEmail = email.trim().toLowerCase();
  if (await userModel.emailExists(normalizedEmail)) {
    throw ApiError.conflict('An account with this email already exists', { email: 'Email already registered' });
  }

  const passwordHash = await hashPassword(password);
  const user = await userModel.create({
    name: name.trim(),
    email: normalizedEmail,
    passwordHash,
    role: ROLES.STUDENT,
  });

  const token = signToken({ id: user.id, role: user.role });
  return { user: publicUser(user), token };
}

async function login({ email, password }) {
  const v = new FieldErrors();
  v.check(isEmail(email), 'email', 'A valid email address is required');
  v.check(isNonEmptyString(password), 'password', 'Password is required');
  v.throwIfAny();

  const normalizedEmail = email.trim().toLowerCase();
  const user = await userModel.findByEmail(normalizedEmail);

  // Use a uniform error so we don't leak which emails exist.
  if (!user || !(await comparePassword(password, user.password_hash))) {
    throw ApiError.unauthorized('Invalid email or password');
  }

  const token = signToken({ id: user.id, role: user.role });
  return { user: publicUser(user), token };
}

async function getCurrentUser(userId) {
  const user = await userModel.findById(userId);
  if (!user) throw ApiError.notFound('User not found');
  return publicUser(user);
}

module.exports = { register, login, getCurrentUser, publicUser };
