'use strict';

const asyncHandler = require('../utils/asyncHandler');
const analyticsService = require('../services/analyticsService');

/** GET /api/analytics?from=&to= — admin usage analytics. */
const overview = asyncHandler(async (req, res) => {
  res.json(await analyticsService.overview(req.query));
});

module.exports = { overview };
