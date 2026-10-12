'use strict';

const { withTransaction } = require('../config/db');
const geofenceModel = require('../models/geofenceModel');
const bicycleModel = require('../models/bicycleModel');
const rentalModel = require('../models/rentalModel');
const ApiError = require('../utils/ApiError');
const {
  GEOFENCE_EVENT_STATUS,
  GEOFENCE_EVENT_STATUS_VALUES,
  LOCATION_SOURCE,
  ACCEPTED_LOCATION_SOURCES,
  LOCATION_SOURCE_VALUES,
} = require('../utils/constants');
const {
  toNumber,
  isValidLatitude,
  isValidLongitude,
  validatePolygon,
  isPointInPolygon,
  polygonBounds,
} = require('../utils/geo');
const { isNonEmptyString, toPositiveInt, FieldErrors } = require('../utils/validators');

/**
 * Software-based geofencing.
 *
 * IMPORTANT LIMITATION, stated here and surfaced in the API and the UI:
 * CampusCycle has no GPS hardware on the bicycles. There is no continuous
 * real-world tracking in this phase. Every location this module knows about
 * was explicitly submitted to POST /api/geofence/locations and is stored with
 * its source, so simulated data is never mixed silently with real data. Only
 * 'SIMULATED' is accepted today; 'DEVICE' is reserved for a future GPS/IoT
 * integration and is rejected.
 *
 * A student's browser location is never accepted as a bicycle's location —
 * the endpoint is admin-only and takes an explicit bicycle id.
 */

const DEMONSTRATION_NOTICE =
  'Demonstration mode: bicycle locations are simulated. CampusCycle has no GPS hardware on its bicycles, so these coordinates were submitted manually and are not evidence of a bicycle\'s real position.';

/** The configured boundary, plus derived bounds for centring a map. */
async function getActiveBoundary() {
  const config = await geofenceModel.findActiveConfig();
  if (!config) return null;
  return { ...config, bounds: polygonBounds(config.polygon) };
}

async function getConfig() {
  const boundary = await getActiveBoundary();
  return {
    geofence: boundary,
    configured: !!boundary,
    demonstration_mode: true,
    accepted_sources: ACCEPTED_LOCATION_SOURCES,
    notice: DEMONSTRATION_NOTICE,
  };
}

async function listConfigs() {
  return geofenceModel.listConfigs();
}

/** Replace the active campus boundary (admin). */
async function updateConfig(adminId, body) {
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const description =
    typeof body.description === 'string' && body.description.trim()
      ? body.description.trim()
      : null;

  const v = new FieldErrors();
  v.check(isNonEmptyString(name), 'name', 'Give the boundary a name');
  const check = validatePolygon(body.polygon);
  v.check(check.valid, 'polygon', check.reason);
  v.throwIfAny();

  const config = await withTransaction(async (client) =>
    geofenceModel.replaceActiveConfig(
      { name, description, polygon: check.polygon, updatedBy: adminId },
      client
    )
  );

  return { ...config, bounds: polygonBounds(config.polygon) };
}

function validatePingInput(body) {
  const v = new FieldErrors();
  const bicycleId = toPositiveInt(body.bicycle_id);
  const latitude = toNumber(body.latitude);
  const longitude = toNumber(body.longitude);
  const source =
    body.source === undefined || body.source === null || body.source === ''
      ? LOCATION_SOURCE.SIMULATED
      : String(body.source).trim().toUpperCase();

  v.check(bicycleId !== null, 'bicycle_id', 'A bicycle is required');
  v.check(isValidLatitude(latitude), 'latitude', 'Latitude must be a number between -90 and 90');
  v.check(
    isValidLongitude(longitude),
    'longitude',
    'Longitude must be a number between -180 and 180'
  );
  if (LOCATION_SOURCE_VALUES.includes(source)) {
    v.check(
      ACCEPTED_LOCATION_SOURCES.includes(source),
      'source',
      'Only SIMULATED locations are accepted in this phase — there is no GPS hardware on the bicycles yet'
    );
  } else {
    v.add('source', `Source must be one of: ${ACCEPTED_LOCATION_SOURCES.join(', ')}`);
  }
  v.throwIfAny();

  return { bicycleId, latitude, longitude, source };
}

/**
 * Submit a (simulated) location for a bicycle and evaluate it against the
 * boundary. Admin-only.
 *
 * De-duplication: while a bicycle has an unresolved event, further
 * out-of-bounds pings increment that event's ping count and update its last
 * known position rather than creating a new alert. A partial unique index
 * (uq_geofence_open_event_per_bicycle) backs this up at the database level.
 *
 * Coming back inside records `returned_inside_at` but does NOT close the
 * alert — an administrator acknowledges or resolves it explicitly.
 */
async function submitLocation(body) {
  const { bicycleId, latitude, longitude, source } = validatePingInput(body);

  return withTransaction(async (client) => {
    const bike = await bicycleModel.findByIdForUpdate(bicycleId, client);
    if (!bike) {
      throw ApiError.unprocessable('That bicycle does not exist', {
        bicycle_id: 'Unknown bicycle',
      });
    }

    const config = await geofenceModel.findActiveConfig(client);
    if (!config) {
      throw ApiError.conflict(
        'No campus boundary is configured yet. Set one up before submitting locations.'
      );
    }

    const insideBoundary = isPointInPolygon(latitude, longitude, config.polygon);
    const rentalId = await rentalModel.findActiveIdForBicycle(bicycleId, client);

    const ping = await geofenceModel.insertPing(
      {
        bicycleId,
        rentalId,
        latitude,
        longitude,
        source,
        insideBoundary,
        geofenceId: config.id,
      },
      client
    );

    const existing = await geofenceModel.findUnresolvedByBicycleForUpdate(bicycleId, client);

    let event = null;
    let duplicateSuppressed = false;

    if (!insideBoundary) {
      if (existing) {
        event = await geofenceModel.touchEvent(
          { id: existing.id, latitude, longitude, rentalId },
          client
        );
        duplicateSuppressed = true;
      } else {
        event = await geofenceModel.createEvent(
          { bicycleId, rentalId, geofenceId: config.id, latitude, longitude, source },
          client
        );
      }
    } else if (existing) {
      event = await geofenceModel.markReturnedInside(existing.id, client);
    }

    return {
      ping,
      inside_boundary: insideBoundary,
      violation: !insideBoundary,
      duplicate_suppressed: duplicateSuppressed,
      event,
      geofence: { id: config.id, name: config.name },
      source,
      notice: DEMONSTRATION_NOTICE,
    };
  });
}

async function listEvents({ status, bicycleId } = {}, pagination = {}) {
  if (status && !GEOFENCE_EVENT_STATUS_VALUES.includes(status)) {
    throw ApiError.badRequest('Invalid alert status filter');
  }
  return geofenceModel.listEventsPaged({ status, bicycleId }, pagination);
}

async function getEvent(id) {
  const event = await geofenceModel.findEventById(id);
  if (!event) throw ApiError.notFound('Geofence alert not found');
  return event;
}

const EVENT_TRANSITIONS = Object.freeze({
  OPEN: [GEOFENCE_EVENT_STATUS.ACKNOWLEDGED, GEOFENCE_EVENT_STATUS.RESOLVED],
  ACKNOWLEDGED: [GEOFENCE_EVENT_STATUS.RESOLVED],
  RESOLVED: [],
});

/** Acknowledge or resolve an alert (admin). */
async function setEventStatus(id, adminId, body) {
  const status = typeof body.status === 'string' ? body.status.trim().toUpperCase() : '';
  const notes = typeof body.notes === 'string' ? body.notes.trim() : '';

  const v = new FieldErrors();
  v.check(
    [GEOFENCE_EVENT_STATUS.ACKNOWLEDGED, GEOFENCE_EVENT_STATUS.RESOLVED].includes(status),
    'status',
    'Status must be ACKNOWLEDGED or RESOLVED'
  );
  v.check(notes.length <= 1000, 'notes', 'Notes must be 1000 characters or fewer');
  v.throwIfAny();

  return withTransaction(async (client) => {
    const existing = await geofenceModel.findEventByIdForUpdate(id, client);
    if (!existing) throw ApiError.notFound('Geofence alert not found');

    const allowed = EVENT_TRANSITIONS[existing.status] || [];
    if (!allowed.includes(status)) {
      throw ApiError.conflict(
        allowed.length === 0
          ? 'This alert is already resolved'
          : `An ${existing.status} alert can only move to: ${allowed.join(', ')}`,
        { status: 'Invalid transition' }
      );
    }

    return geofenceModel.setEventStatus({ id, status, userId: adminId, notes: notes || null }, client);
  });
}

async function recentPings({ bicycleId, limit = 50 } = {}) {
  return geofenceModel.listRecentPings({ bicycleId, limit });
}

async function latestLocations() {
  return geofenceModel.latestPingPerBicycle();
}

async function stats() {
  return geofenceModel.countEventsByStatus();
}

module.exports = {
  DEMONSTRATION_NOTICE,
  getConfig,
  getActiveBoundary,
  listConfigs,
  updateConfig,
  submitLocation,
  listEvents,
  getEvent,
  setEventStatus,
  recentPings,
  latestLocations,
  stats,
};
