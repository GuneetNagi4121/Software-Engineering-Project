'use strict';

const express = require('express');
const rentalController = require('../controllers/rentalController');
const { authenticate, authorize } = require('../middleware/auth');
const { ROLES } = require('../utils/constants');

const router = express.Router();

router.use(authenticate);

// Student ride actions.
router.post('/', authorize(ROLES.STUDENT), rentalController.start);
router.get('/active', authorize(ROLES.STUDENT), rentalController.active);
router.get('/me', rentalController.myHistory);

// Admin: list every rental.
router.get('/', authorize(ROLES.ADMIN), rentalController.listAll);

// End a ride: students may end their own, admins may end any (enforced in service).
router.post('/:id/return', rentalController.returnRide);

module.exports = router;
