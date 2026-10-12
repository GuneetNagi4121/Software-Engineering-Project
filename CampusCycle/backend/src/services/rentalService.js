'use strict';

const { withTransaction } = require('../config/db');
const rentalModel = require('../models/rentalModel');
const bicycleModel = require('../models/bicycleModel');
const stationModel = require('../models/stationModel');
const maintenanceService = require('./maintenanceService');
const ApiError = require('../utils/ApiError');
const {
  BICYCLE_STATUS,
  STATION_STATUS,
  ROLES,
  RENTAL_STATUS_VALUES,
} = require('../utils/constants');
const { isNonEmptyString, toPositiveInt } = require('../utils/validators');

const UNAVAILABLE_REASON = {
  [BICYCLE_STATUS.IN_USE]: 'This bicycle is already in use',
  [BICYCLE_STATUS.RESERVED]: 'This bicycle is reserved',
  [BICYCLE_STATUS.MAINTENANCE]: 'This bicycle is under maintenance',
};

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

/**
 * Start a rental for `userId` by scanning/entering a bicycle QR code.
 *
 * Concurrency safety:
 *  - The bicycle row is locked with SELECT ... FOR UPDATE, so two students
 *    scanning the same QR are serialised; the second sees IN_USE and fails.
 *    The same lock serialises against a maintenance report being filed and
 *    against an admin status change.
 *  - A partial unique index (uq_active_rental_per_user) guarantees a student
 *    can never hold two ACTIVE rentals, even under a race.
 *  - A partial unique index (uq_active_rental_per_bicycle) is a second guard
 *    against two ACTIVE rentals on one bike.
 *  - A bicycle on SAFETY HOLD (an unresolved HIGH/CRITICAL maintenance
 *    report) is refused even if its status still says AVAILABLE.
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

      // 4) ...and must not be on safety hold from a reported issue.
      const holds = await maintenanceService.getSafetyHolds(bike.id, client);
      if (holds.length > 0) {
        throw ApiError.conflict(
          'This bicycle has an unresolved safety issue reported against it and cannot be rented',
          { safety_issues: holds.length }
        );
      }

      // 5) Create the ACTIVE rental; start station is where the bike was parked.
      const rental = await rentalModel.createActive(
        { userId, bicycleId: bike.id, startStationId: bike.station_id },
        client
      );

      // 6) Take the bike out of its station and mark it IN_USE.
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
 *
 * If a safety issue was reported while the bicycle was out, it is parked as
 * MAINTENANCE rather than AVAILABLE, so it cannot be rented again before it
 * has been inspected.
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

    const holds = await maintenanceService.getSafetyHolds(rental.bicycle_id, client);
    const parkedStatus =
      holds.length > 0 ? BICYCLE_STATUS.MAINTENANCE : BICYCLE_STATUS.AVAILABLE;

    await bicycleModel.setStatusAndStation(rental.bicycle_id, parkedStatus, endStationId, client);

    return {
      ...completed,
      bicycle_status: parkedStatus,
      held_for_maintenance: holds.length > 0,
      maintenance_notice:
        holds.length > 0
          ? 'This cycle has been parked for maintenance because of a reported safety issue.'
          : null,
    };
  });
}

async function getActiveForUser(userId) {
  return rentalModel.findActiveDetailByUser(userId);
}

function assertValidStatus(status) {
  if (status && !RENTAL_STATUS_VALUES.includes(status)) {
    throw ApiError.badRequest('Invalid status filter');
  }
}

/**
 * One student's ride history. The user id always comes from the authenticated
 * token — never from the request — so a student can only ever see their own.
 */
async function getHistoryForUser(userId, { status } = {}) {
  assertValidStatus(status);
  return rentalModel.listByUser(userId, { status });
}

/**
 * A single ride. Students may only open their own rides; admins may open any.
 */
async function getRideById(rentalId, { userId, role }) {
  const rental = await rentalModel.findDetailById(rentalId);
  if (!rental) throw ApiError.notFound('Ride not found');
  if (role !== ROLES.ADMIN && rental.user_id !== userId) {
    throw ApiError.forbidden('You can only view your own rides');
  }
  return rental;
}

/** Normalise pagination query parameters. */
function resolvePagination({ limit, offset, page } = {}) {
  let size = toPositiveInt(limit) || DEFAULT_PAGE_SIZE;
  if (size > MAX_PAGE_SIZE) size = MAX_PAGE_SIZE;

  let skip = 0;
  if (offset !== undefined && offset !== null && offset !== '') {
    const n = Number(offset);
    skip = Number.isInteger(n) && n >= 0 ? n : 0;
  } else {
    const p = toPositiveInt(page);
    if (p) skip = (p - 1) * size;
  }
  return { limit: size, offset: skip };
}

/**
 * Admin ride history across all users, with filters and pagination.
 * Never returns an unbounded result set.
 */
async function listPaged(filters = {}, pagination = {}) {
  assertValidStatus(filters.status);
  const { limit, offset } = resolvePagination(pagination);
  const { rentals, total } = await rentalModel.listPaged(filters, { limit, offset });
  return {
    rentals,
    pagination: {
      limit,
      offset,
      total,
      page: Math.floor(offset / limit) + 1,
      pages: Math.max(1, Math.ceil(total / limit)),
      has_more: offset + rentals.length < total,
    },
  };
}

/** Legacy helper kept for the Phase 1 dashboard (bounded by `limit`). */
async function listAll(filters) {
  assertValidStatus(filters && filters.status);
  return rentalModel.listAll(filters);
}

module.exports = {
  startRental,
  returnRental,
  getActiveForUser,
  getHistoryForUser,
  getRideById,
  listPaged,
  listAll,
  resolvePagination,
};
