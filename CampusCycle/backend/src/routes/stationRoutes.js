'use strict';

const express = require('express');
const stationController = require('../controllers/stationController');
const { authenticate, authorize } = require('../middleware/auth');
const { ROLES } = require('../utils/constants');

const router = express.Router();

// All station routes require authentication.
router.use(authenticate);

// Readable by any authenticated user (students + admins).
router.get('/', stationController.list);
router.get('/:id', stationController.getOne);

// Management is admin-only.
router.post('/', authorize(ROLES.ADMIN), stationController.create);
router.put('/:id', authorize(ROLES.ADMIN), stationController.update);
router.patch('/:id/status', authorize(ROLES.ADMIN), stationController.setStatus);
router.delete('/:id', authorize(ROLES.ADMIN), stationController.remove);

module.exports = router;
