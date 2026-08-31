'use strict';

const express = require('express');
const bicycleController = require('../controllers/bicycleController');
const { authenticate, authorize } = require('../middleware/auth');
const { ROLES } = require('../utils/constants');

const router = express.Router();

router.use(authenticate);

// Admin-only aggregate — declared before "/:id" so it is not shadowed.
router.get('/stats', authorize(ROLES.ADMIN), bicycleController.stats);

// Readable by any authenticated user.
router.get('/', bicycleController.list);
router.get('/:id', bicycleController.getOne);

// Management is admin-only.
router.post('/', authorize(ROLES.ADMIN), bicycleController.create);
router.put('/:id', authorize(ROLES.ADMIN), bicycleController.update);
router.patch('/:id/status', authorize(ROLES.ADMIN), bicycleController.changeStatus);
router.delete('/:id', authorize(ROLES.ADMIN), bicycleController.remove);

module.exports = router;
