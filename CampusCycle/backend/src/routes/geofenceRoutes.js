'use strict';

const express = require('express');
const geofenceController = require('../controllers/geofenceController');
const { authenticate, authorize } = require('../middleware/auth');
const { ROLES } = require('../utils/constants');

const router = express.Router();

router.use(authenticate);

// The boundary itself is readable by any authenticated user so the student
// map can draw the campus outline.
router.get('/', geofenceController.config);

// Everything else is administrator-only.
const admin = authorize(ROLES.ADMIN);

router.put('/', admin, geofenceController.updateConfig);
router.get('/history', admin, geofenceController.history);

// Demonstration location source — simulated updates only.
router.post('/locations', admin, geofenceController.submitLocation);
router.get('/locations', admin, geofenceController.locations);
router.get('/locations/latest', admin, geofenceController.latestLocations);

// Violation alerts. Literal paths before "/events/:id".
router.get('/events/stats', admin, geofenceController.eventStats);
router.get('/events', admin, geofenceController.events);
router.get('/events/:id', admin, geofenceController.getEvent);
router.patch('/events/:id', admin, geofenceController.updateEvent);

module.exports = router;
