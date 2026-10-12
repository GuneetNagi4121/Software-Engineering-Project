'use strict';

const asyncHandler = require('../utils/asyncHandler');
const geofenceService = require('../services/geofenceService');
const rentalService = require('../services/rentalService');
const { toPositiveInt } = require('../utils/validators');
const ApiError = require('../utils/ApiError');

function idParam(req, what = 'geofence alert') {
  const id = toPositiveInt(req.params.id);
  if (!id) throw ApiError.badRequest(`Invalid ${what} id`);
  return id;
}

/** GET /api/geofence — the active campus boundary and its limitations. */
const config = asyncHandler(async (req, res) => {
  res.json(await geofenceService.getConfig());
});

/** PUT /api/geofence — replace the active boundary (admin). */
const updateConfig = asyncHandler(async (req, res) => {
  const geofence = await geofenceService.updateConfig(req.user.id, req.body);
  res.json({ geofence });
});

/** GET /api/geofence/history — previous boundary configurations (admin). */
const history = asyncHandler(async (req, res) => {
  res.json({ geofences: await geofenceService.listConfigs() });
});

/**
 * POST /api/geofence/locations — submit a SIMULATED bicycle location (admin).
 *
 * This is the demonstration location source. It is admin-only on purpose: a
 * student's browser location is not evidence of where a bicycle is.
 */
const submitLocation = asyncHandler(async (req, res) => {
  const result = await geofenceService.submitLocation(req.body);
  res.status(201).json(result);
});

/** GET /api/geofence/locations — recent submitted locations (admin). */
const locations = asyncHandler(async (req, res) => {
  const { bicycle_id: bicycleId, limit } = req.query;
  const pings = await geofenceService.recentPings({
    bicycleId: bicycleId ? toPositiveInt(bicycleId) : undefined,
    limit: toPositiveInt(limit) || 50,
  });
  res.json({ pings, notice: geofenceService.DEMONSTRATION_NOTICE });
});

/** GET /api/geofence/locations/latest — last known position per bicycle. */
const latestLocations = asyncHandler(async (req, res) => {
  res.json({
    locations: await geofenceService.latestLocations(),
    notice: geofenceService.DEMONSTRATION_NOTICE,
  });
});

/** GET /api/geofence/events — violation alerts (admin). */
const events = asyncHandler(async (req, res) => {
  const { status, bicycle_id: bicycleId } = req.query;
  const { limit, offset } = rentalService.resolvePagination(req.query);
  const { events: rows, total } = await geofenceService.listEvents(
    { status, bicycleId: bicycleId ? toPositiveInt(bicycleId) : undefined },
    { limit, offset }
  );
  res.json({ events: rows, pagination: { limit, offset, total } });
});

/** GET /api/geofence/events/stats — counts by status (admin). */
const eventStats = asyncHandler(async (req, res) => {
  res.json({ stats: await geofenceService.stats() });
});

/** GET /api/geofence/events/:id */
const getEvent = asyncHandler(async (req, res) => {
  res.json({ event: await geofenceService.getEvent(idParam(req)) });
});

/** PATCH /api/geofence/events/:id — acknowledge or resolve (admin). */
const updateEvent = asyncHandler(async (req, res) => {
  const event = await geofenceService.setEventStatus(idParam(req), req.user.id, req.body);
  res.json({ event });
});

module.exports = {
  config,
  updateConfig,
  history,
  submitLocation,
  locations,
  latestLocations,
  events,
  eventStats,
  getEvent,
  updateEvent,
};
