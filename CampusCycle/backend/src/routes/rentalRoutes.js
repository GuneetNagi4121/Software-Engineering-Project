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

// Admin: list every rental (filtered + paginated).
router.get('/', authorize(ROLES.ADMIN), rentalController.listAll);

// A single ride. Students may only open their own; enforced in the service
// from the authenticated user, never from a client-supplied user id.
// Declared after the literal routes above so "/active" and "/me" win.
router.get('/:id', rentalController.getOne);

// End a ride: students may end their own, admins may end any (enforced in service).
router.post('/:id/return', rentalController.returnRide);

module.exports = router;
