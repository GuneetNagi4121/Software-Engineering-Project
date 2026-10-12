'use strict';

const asyncHandler = require('../utils/asyncHandler');
const rentalService = require('../services/rentalService');
const { toPositiveInt } = require('../utils/validators');
const ApiError = require('../utils/ApiError');
const { RENTAL_STATUS_VALUES } = require('../utils/constants');

function idParam(req) {
  const id = toPositiveInt(req.params.id);
  if (!id) throw ApiError.badRequest('Invalid rental id');
  return id;
}

/** POST /api/rentals — start a ride by scanning/entering a QR code. */
const start = asyncHandler(async (req, res) => {
  const rental = await rentalService.startRental(req.user.id, req.body.qr_code);
  res.status(201).json({ rental });
});

/** POST /api/rentals/:id/return — end a ride at a chosen station. */
const returnRide = asyncHandler(async (req, res) => {
  const rental = await rentalService.returnRental({
    rentalId: idParam(req),
    userId: req.user.id,
    role: req.user.role,
    endStationIdRaw: req.body.end_station_id,
  });
  res.json({ rental });
});

/** GET /api/rentals/active — the current user's active ride (or null). */
const active = asyncHandler(async (req, res) => {
  const rental = await rentalService.getActiveForUser(req.user.id);
  res.json({ rental: rental || null });
});

/**
 * GET /api/rentals/me — the signed-in user's ride history.
 * The user id comes from the verified token, never from the request, so a
 * student cannot read another student's rides by passing an id.
 */
const myHistory = asyncHandler(async (req, res) => {
  const { status } = req.query;
  res.json({
    rentals: await rentalService.getHistoryForUser(req.user.id, { status }),
  });
});

/**
 * GET /api/rentals — all rides (admin), with filters and pagination.
 * Filters: status, bicycle_id, station_id, from, to. Paging: limit/offset
 * or page. Never unbounded.
 */
const listAll = asyncHandler(async (req, res) => {
  const {
    status,
    bicycle_id: bicycleId,
    station_id: stationId,
    from,
    to,
    limit,
    offset,
    page,
  } = req.query;

  if (status && !RENTAL_STATUS_VALUES.includes(status)) {
    throw ApiError.badRequest('Invalid status filter');
  }

  const result = await rentalService.listPaged(
    {
      status,
      bicycleId: bicycleId ? toPositiveInt(bicycleId) : undefined,
      stationId: stationId ? toPositiveInt(stationId) : undefined,
      from: from || undefined,
      to: to || undefined,
    },
    { limit, offset, page }
  );

  res.json(result);
});

/** GET /api/rentals/:id — one ride (own ride, or any ride for an admin). */
const getOne = asyncHandler(async (req, res) => {
  const rental = await rentalService.getRideById(idParam(req), {
    userId: req.user.id,
    role: req.user.role,
  });
  res.json({ rental });
});

module.exports = { start, returnRide, active, myHistory, listAll, getOne };
