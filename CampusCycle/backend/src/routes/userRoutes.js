'use strict';

const express = require('express');
const adminController = require('../controllers/adminController');
const { authenticate, authorize } = require('../middleware/auth');
const { ROLES } = require('../utils/constants');

const router = express.Router();

// User directory — admin only.
router.get('/', authenticate, authorize(ROLES.ADMIN), adminController.list);

module.exports = router;
