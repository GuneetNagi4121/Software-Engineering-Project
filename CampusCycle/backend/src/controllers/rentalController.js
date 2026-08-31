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

/** GET /api/rentals/me — the current user's ride history. */
const myHistory = asyncHandler(async (req, res) => {
  res.json({ rentals: await rentalService.getHistoryForUser(req.user.id) });
});

/** GET /api/rentals — all rides (admin), optional ?status= filter. */
const listAll = asyncHandler(async (req, res) => {
  const { status, limit } = req.query;
  if (status && !RENTAL_STATUS_VALUES.includes(status)) {
    throw ApiError.badRequest('Invalid status filter');
  }
  const rentals = await rentalService.listAll({
    status,
    limit: limit ? toPositiveInt(limit) : undefined,
  });
  res.json({ rentals });
});

module.exports = { start, returnRide, active, myHistory, listAll };
