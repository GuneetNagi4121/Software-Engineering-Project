'use strict';

const asyncHandler = require('../utils/asyncHandler');
const authService = require('../services/authService');
const userModel = require('../models/userModel');
const ApiError = require('../utils/ApiError');
const { isNonEmptyString } = require('../utils/validators');

const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;
  const result = await authService.register({ name, email, password });
  res.status(201).json(result);
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const result = await authService.login({ email, password });
  res.json(result);
});

const me = asyncHandler(async (req, res) => {
  const user = await authService.getCurrentUser(req.user.id);
  res.json({ user });
});

const updateMe = asyncHandler(async (req, res) => {
  const { name } = req.body;
  if (!isNonEmptyString(name)) {
    throw ApiError.unprocessable('Validation failed', { name: 'Name is required' });
  }
  const updated = await userModel.updateProfile(req.user.id, { name: name.trim() });
  res.json({ user: authService.publicUser(updated) });
});

module.exports = { register, login, me, updateMe };
