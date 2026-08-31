'use strict';

const asyncHandler = require('../utils/asyncHandler');
const userModel = require('../models/userModel');
const statsService = require('../services/statsService');

/** GET /api/users — list all users (admin only). */
const list = asyncHandler(async (req, res) => {
  res.json({ users: await userModel.listAll() });
});

/** GET /api/admin/overview — aggregate figures for the admin dashboard. */
const overview = asyncHandler(async (req, res) => {
  res.json(await statsService.overview());
});

module.exports = { list, overview };
