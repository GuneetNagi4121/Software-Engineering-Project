'use strict';

const bicycleModel = require('../models/bicycleModel');
const stationModel = require('../models/stationModel');
const rentalModel = require('../models/rentalModel');
const { STATION_STATUS } = require('../utils/constants');

/**
 * Aggregate figures for the admin dashboard "Campus Overview".
 */
async function overview() {
  const [bicycles, stations, activeRentals, recentRentals] = await Promise.all([
    bicycleModel.countByStatus(),
    stationModel.listWithCounts(),
    rentalModel.countActive(),
    rentalModel.listAll({ limit: 8 }),
  ]);

  return {
    bicycles, // { AVAILABLE, RESERVED, IN_USE, MAINTENANCE, TOTAL }
    stations: {
      total: stations.length,
      active: stations.filter((s) => s.status === STATION_STATUS.ACTIVE).length,
    },
    activeRentals,
    recentRentals,
  };
}

module.exports = { overview };
