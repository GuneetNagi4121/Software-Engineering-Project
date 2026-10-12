'use strict';

const express = require('express');
const maintenanceController = require('../controllers/maintenanceController');
const { authenticate, authorize } = require('../middleware/auth');
const { ROLES } = require('../utils/constants');

const router = express.Router();

router.use(authenticate);

// --- student ---------------------------------------------------------------
// Any authenticated user can report a problem and read their own reports.
router.post('/', maintenanceController.create);
router.get('/me', maintenanceController.mine);

// --- admin -----------------------------------------------------------------
// Literal paths before "/:id" so they are not shadowed.
router.get('/stats', authorize(ROLES.ADMIN), maintenanceController.stats);
router.get('/', authorize(ROLES.ADMIN), maintenanceController.list);

// Own report for a student, any report for an admin (enforced in the service).
router.get('/:id', maintenanceController.getOne);

// Only an administrator can move a report along its lifecycle.
router.patch('/:id/status', authorize(ROLES.ADMIN), maintenanceController.updateStatus);

module.exports = router;
