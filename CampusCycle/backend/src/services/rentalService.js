'use strict';

const { withTransaction } = require('../config/db');
const rentalModel = require('../models/rentalModel');
const bicycleModel = require('../models/bicycleModel');
const stationModel = require('../models/stationModel');
const ApiError = require('../utils/ApiError');
const { BICYCLE_STATUS, STATION_STATUS, ROLES } = require('../utils/constants');
const { isNonEmptyString, toPositiveInt } = require('../utils/validators');

const UNAVAILABLE_REASON = {
  [BICYCLE_STATUS.IN_USE]: 'This bicycle is already in use',
  [BICYCLE_STATUS.RESERVED]: 'This bicycle is reserved',
  [BICYCLE_STATUS.MAINTENANCE]: 'This bicycle is under maintenance',
};

/**
 * Start a rental for `userId` by scanning/entering a bicycle QR code.
 *
 * Concurrency safety:
 *  - The bicycle row is locked with SELECT ... FOR UPDATE, so two students
 *    scanning the same QR are serialised; the second sees IN_USE and fails.
 *  - A partial unique index (uq_active_rental_per_user) guarantees a student
 *    can never hold two ACTIVE rentals, even under a race.
 *  - A partial unique index (uq_active_rental_per_bicycle) is a second guard
 *    against two ACTIVE rentals on one bike.
 */
async function startRental(userId, qrCodeRaw) {
  const qrCode = typeof qrCodeRaw === 'string' ? qrCodeRaw.trim() : '';
  if (!isNonEmptyString(qrCode)) {
    throw ApiError.unprocessable('A QR code is required to start a ride', { qr_code: 'Required' });
  }

  try {
    return await withTransaction(async (client) => {
      // 1) One active ride per student.
      const active = await rentalModel.findActiveByUserForUpdate(userId, client);
      if (active) {
        throw ApiError.conflict('You already have an active ride. End it before starting another.');
      }

      // 2) Lock and load the bicycle by QR.
      const bike = await bicycleModel.findByQrForUpdate(qrCode, client);
      if (!bike) {
        throw ApiError.notFound('No bicycle matches that QR code');
      }

      // 3) The bicycle must be available.
      if (bike.status !== BICYCLE_STATUS.AVAILABLE) {
        throw ApiError.conflict(UNAVAILABLE_REASON[bike.status] || 'This bicycle is not available');
      }

      // 4) Create the ACTIVE rental; start station is where the bike was parked.
      const rental = await rentalModel.createActive(
        { userId, bicycleId: bike.id, startStationId: bike.station_id },
        client
      );

      // 5) Take the bike out of its station and mark it IN_USE.
      await bicycleModel.setStatusAndStation(bike.id, BICYCLE_STATUS.IN_USE, null, client);

      return rental;
    });
  } catch (err) {
    // Translate the safety-net unique violations into friendly messages.
    if (err && err.code === '23505') {
      if (err.constraint === 'uq_active_rental_per_user') {
        throw ApiError.conflict('You already have an active ride. End it before starting another.');
      }
      if (err.constraint === 'uq_active_rental_per_bicycle') {
        throw ApiError.conflict('This bicycle was just taken by someone else');
      }
    }
    throw err;
  }
}

/**
 * End a rental (return the bicycle) to a chosen station.
 * Students may only end their own ride; admins may end any ride.
 * Runs in a transaction so the rental and bicycle state stay consistent.
 */
async function returnRental({ rentalId, userId, role, endStationIdRaw }) {
  const endStationId = toPositiveInt(endStationIdRaw);
  if (!endStationId) {
    throw ApiError.unprocessable('A valid return station is required', { end_station_id: 'Required' });
  }

  return withTransaction(async (client) => {
    // 1) Lock the rental.
    const rental = await rentalModel.findByIdForUpdate(rentalId, client);
    if (!rental) {
      throw ApiError.notFound('Rental not found');
    }
    if (rental.status !== 'ACTIVE') {
      throw ApiError.conflict('This ride is not active');
    }
    if (role !== ROLES.ADMIN && rental.user_id !== userId) {
      throw ApiError.forbidden('You can only end your own ride');
    }

    // 2) Validate the return station (must exist and be registered/active).
    const station = await stationModel.findById(endStationId, client);
    if (!station) {
      throw ApiError.unprocessable('Return station does not exist', { end_station_id: 'Unknown station' });
    }
    if (station.status !== STATION_STATUS.ACTIVE) {
      throw ApiError.conflict('That station is not currently active. Choose another return station.');
    }

    // 3) Lock the bike, complete the rental, and park the bike.
    await bicycleModel.findByIdForUpdate(rental.bicycle_id, client);
    const completed = await rentalModel.complete({ id: rentalId, endStationId }, client);
    await bicycleModel.setStatusAndStation(
      rental.bicycle_id,
      BICYCLE_STATUS.AVAILABLE,
      endStationId,
      client
    );

    return completed;
  });
}

async function getActiveForUser(userId) {
  return rentalModel.findActiveDetailByUser(userId);
}

async function getHistoryForUser(userId) {
  return rentalModel.listByUser(userId);
}

async function listAll(filters) {
  return rentalModel.listAll(filters);
}

module.exports = {
  startRental,
  returnRental,
  getActiveForUser,
  getHistoryForUser,
  listAll,
};
