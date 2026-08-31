'use strict';

const express = require('express');

const authRoutes = require('./authRoutes');
const stationRoutes = require('./stationRoutes');
const bicycleRoutes = require('./bicycleRoutes');
const rentalRoutes = require('./rentalRoutes');
const userRoutes = require('./userRoutes');
const adminRoutes = require('./adminRoutes');

const router = express.Router();

router.get('/health', (req, res) => res.json({ status: 'ok', service: 'campuscycle-api' }));

router.use('/auth', authRoutes);
router.use('/stations', stationRoutes);
router.use('/bicycles', bicycleRoutes);
router.use('/rentals', rentalRoutes);
router.use('/users', userRoutes);
router.use('/admin', adminRoutes);

module.exports = router;
