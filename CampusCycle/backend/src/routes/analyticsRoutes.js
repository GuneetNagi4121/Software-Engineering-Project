'use strict';

const express = require('express');
const analyticsController = require('../controllers/analyticsController');
const { authenticate, authorize } = require('../middleware/auth');
const { ROLES } = require('../utils/constants');

const router = express.Router();

// Analytics are administrator-only.
router.get('/', authenticate, authorize(ROLES.ADMIN), analyticsController.overview);

module.exports = router;
