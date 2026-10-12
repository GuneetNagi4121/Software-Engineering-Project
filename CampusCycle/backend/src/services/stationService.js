'use strict';

const stationModel = require('../models/stationModel');
const ApiError = require('../utils/ApiError');
const {
  STATION_STATUS,
  STATION_STATUS_VALUES,
  AVAILABILITY_LEVEL,
  AVAILABILITY_LEVEL_VALUES,
} = require('../utils/constants');
const { isNonEmptyString, FieldErrors } = require('../utils/validators');
const { toNumber, isValidLatitude, isValidLongitude } = require('../utils/geo');

/**
 * Coordinates are optional: a station created before Phase 2 simply is not on
 * the map yet. They must, however, be supplied as a pair and be in range.
 */
function normalizeCoordinates(body, v) {
  const hasLat = body.latitude !== undefined && body.latitude !== null && body.latitude !== '';
  const hasLng = body.longitude !== undefined && body.longitude !== null && body.longitude !== '';

  if (!hasLat && !hasLng) return { latitude: null, longitude: null };

  const latitude = toNumber(body.latitude);
  const longitude = toNumber(body.longitude);

  v.check(hasLat && hasLng, 'latitude', 'Provide both latitude and longitude, or neither');
  v.check(
    !hasLat || isValidLatitude(latitude),
    'latitude',
    'Latitude must be a number between -90 and 90'
  );
  v.check(
    !hasLng || isValidLongitude(longitude),
    'longitude',
    'Longitude must be a number between -180 and 180'
  );

  return { latitude, longitude };
}

function validateStationInput({ name, location, capacity, status }, { partial = false } = {}) {
  const v = new FieldErrors();
  if (!partial || name !== undefined) {
    v.check(isNonEmptyString(name), 'name', 'Station name is required');
  }
  if (!partial || location !== undefined) {
    v.check(isNonEmptyString(location), 'location', 'Location is required');
  }
  if (!partial || capacity !== undefined) {
    v.check(
      Number.isInteger(capacity) && capacity > 0 && capacity <= 1000,
      'capacity',
      'Capacity must be a positive integer'
    );
  }
  if (status !== undefined) {
    v.check(STATION_STATUS_VALUES.includes(status), 'status', 'Invalid station status');
  }
  return v;
}

/**
 * All stations with live availability.
 *
 * @param {object} [filters]
 * @param {string} [filters.availability] GOOD | LOW | NONE | INACTIVE
 * @param {string} [filters.status]       ACTIVE | INACTIVE
 * @param {boolean}[filters.mappedOnly]   only stations with coordinates
 * @param {string} [filters.sort]         name | availability | availability_desc
 */
async function list(filters = {}) {
  const { availability, status, mappedOnly, sort } = filters;

  if (availability && !AVAILABILITY_LEVEL_VALUES.includes(availability)) {
    throw ApiError.badRequest(
      `Invalid availability filter. Use one of: ${AVAILABILITY_LEVEL_VALUES.join(', ')}`
    );
  }
  if (status && !STATION_STATUS_VALUES.includes(status)) {
    throw ApiError.badRequest('Invalid station status filter');
  }

  let stations = await stationModel.listWithCounts();

  if (status) stations = stations.filter((s) => s.status === status);
  if (availability) stations = stations.filter((s) => s.availability_level === availability);
  if (mappedOnly) stations = stations.filter((s) => s.has_coordinates);

  if (sort === 'availability') {
    stations = [...stations].sort(
      (a, b) => a.available_count - b.available_count || a.name.localeCompare(b.name)
    );
  } else if (sort === 'availability_desc') {
    stations = [...stations].sort(
      (a, b) => b.available_count - a.available_count || a.name.localeCompare(b.name)
    );
  }

  return stations;
}

/**
 * Stations for the campus map: the same availability figures as the list, plus
 * the active geofence boundary. Stations without coordinates are reported
 * separately so the UI can say "3 stations are not on the map yet" instead of
 * silently dropping them.
 */
async function mapData() {
  // Required lazily: geofenceService does not depend on stationService, but
  // keeping the require here documents that the map is a composition.
  const geofenceService = require('./geofenceService');
  const [stations, geofence] = await Promise.all([
    stationModel.listWithCounts(),
    geofenceService.getActiveBoundary(),
  ]);

  const mapped = stations.filter((s) => s.has_coordinates);
  const unmapped = stations.filter((s) => !s.has_coordinates);

  return {
    stations: mapped,
    unmapped_stations: unmapped.map((s) => ({ id: s.id, name: s.name, location: s.location })),
    geofence,
    availability_rules: {
      levels: AVAILABILITY_LEVEL_VALUES,
      low_availability_percent: require('../utils/constants').LOW_AVAILABILITY_PERCENT,
      low_availability_count: require('../utils/constants').LOW_AVAILABILITY_COUNT,
      description:
        'available_count counts bicycles with status AVAILABLE parked at the station; availability_pct = available_count / capacity; LOW means at most low_availability_count bicycles left or below low_availability_percent of capacity.',
    },
    totals: {
      stations: stations.length,
      mapped: mapped.length,
      unmapped: unmapped.length,
      available_bicycles: stations.reduce((sum, s) => sum + s.available_count, 0),
      capacity: stations.reduce((sum, s) => sum + s.capacity, 0),
    },
  };
}

async function getById(id) {
  const station = await stationModel.findByIdWithCounts(id);
  if (!station) throw ApiError.notFound('Station not found');
  return station;
}

async function create(input) {
  const v = validateStationInput(input);
  const coords = normalizeCoordinates(input, v);
  v.throwIfAny();

  return stationModel.create({
    name: input.name.trim(),
    location: input.location.trim(),
    capacity: input.capacity,
    status: input.status || STATION_STATUS.ACTIVE,
    latitude: coords.latitude,
    longitude: coords.longitude,
  });
}

async function update(id, input) {
  const existing = await stationModel.findById(id);
  if (!existing) throw ApiError.notFound('Station not found');

  const merged = {
    name: input.name !== undefined ? input.name : existing.name,
    location: input.location !== undefined ? input.location : existing.location,
    capacity: input.capacity !== undefined ? input.capacity : existing.capacity,
    status: input.status !== undefined ? input.status : existing.status,
    latitude: input.latitude !== undefined ? input.latitude : existing.latitude,
    longitude: input.longitude !== undefined ? input.longitude : existing.longitude,
  };

  const v = validateStationInput(merged);
  const coords = normalizeCoordinates(merged, v);
  v.throwIfAny();

  // A station cannot be shrunk below the number of bikes currently parked.
  const parked = await stationModel.countBicycles(id);
  if (merged.capacity < parked) {
    throw ApiError.conflict(
      `Capacity (${merged.capacity}) cannot be less than the ${parked} bicycle(s) currently at this station`,
      { capacity: `At least ${parked} required` }
    );
  }

  return stationModel.update(id, {
    name: merged.name.trim(),
    location: merged.location.trim(),
    capacity: merged.capacity,
    status: merged.status,
    latitude: coords.latitude,
    longitude: coords.longitude,
  });
}

async function setStatus(id, status) {
  if (!STATION_STATUS_VALUES.includes(status)) {
    throw ApiError.unprocessable('Invalid station status', { status: 'Must be ACTIVE or INACTIVE' });
  }
  const existing = await stationModel.findById(id);
  if (!existing) throw ApiError.notFound('Station not found');
  return stationModel.update(id, { ...existing, status });
}

async function remove(id) {
  const existing = await stationModel.findById(id);
  if (!existing) throw ApiError.notFound('Station not found');

  const bikeCount = await stationModel.countBicycles(id);
  if (bikeCount > 0) {
    throw ApiError.conflict(
      `Cannot delete station: ${bikeCount} bicycle(s) are still assigned to it. Reassign them first.`
    );
  }
  const activeRefs = await stationModel.countActiveRentalsReferencing(id);
  if (activeRefs > 0) {
    throw ApiError.conflict(
      `Cannot delete station: ${activeRefs} active rental(s) reference it. Wait for those rides to end.`
    );
  }

  await stationModel.remove(id);
  return { id: Number(id), deleted: true };
}

module.exports = { list, mapData, getById, create, update, setStatus, remove, AVAILABILITY_LEVEL };
