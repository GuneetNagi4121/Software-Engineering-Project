'use strict';

const bicycleModel = require('../models/bicycleModel');
const stationModel = require('../models/stationModel');
const rentalModel = require('../models/rentalModel');
const maintenanceModel = require('../models/maintenanceModel');
const geofenceModel = require('../models/geofenceModel');
const { STATION_STATUS } = require('../utils/constants');

/**
 * Aggregate figures for the admin dashboard "Campus Overview".
 * Phase 2 adds maintenance and geofence counts; the Phase 1 keys are
 * unchanged so the existing dashboard keeps working.
 */
async function overview() {
  const [bicycles, stations, activeRentals, recentRentals, maintenance, geofence] =
    await Promise.all([
      bicycleModel.countByStatus(),
      stationModel.listWithCounts(),
      rentalModel.countActive(),
      rentalModel.listAll({ limit: 8 }),
      maintenanceModel.countByStatus(),
      geofenceModel.countEventsByStatus(),
    ]);

  return {
    bicycles, // { AVAILABLE, RESERVED, IN_USE, MAINTENANCE, TOTAL }
    stations: {
      total: stations.length,
      active: stations.filter((s) => s.status === STATION_STATUS.ACTIVE).length,
      mapped: stations.filter((s) => s.has_coordinates).length,
    },
    activeRentals,
    recentRentals,
    maintenance, // { OPEN, IN_PROGRESS, RESOLVED, CLOSED, TOTAL }
    geofence, // { OPEN, ACKNOWLEDGED, RESOLVED, TOTAL }
  };
}

module.exports = { overview };
