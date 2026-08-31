'use strict';

const express = require('express');
const adminController = require('../controllers/adminController');
const { authenticate, authorize } = require('../middleware/auth');
const { ROLES } = require('../utils/constants');

const router = express.Router();

// Aggregate figures for the admin dashboard.
router.get('/overview', authenticate, authorize(ROLES.ADMIN), adminController.overview);

module.exports = router;
