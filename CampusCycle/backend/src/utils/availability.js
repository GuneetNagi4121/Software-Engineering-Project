'use strict';

const {
  AVAILABILITY_LEVEL,
  LOW_AVAILABILITY_PERCENT,
  LOW_AVAILABILITY_COUNT,
  STATION_STATUS,
} = require('./constants');

/**
 * THE station availability rule for the whole application.
 *
 * Every surface that shows availability — the station list, the station
 * detail page, the campus map, the student dashboard — derives it from here,
 * so the numbers can never disagree between screens.
 *
 *   available_count    bicycles with status AVAILABLE parked at the station
 *   capacity           docking capacity of the station
 *   availability_pct   round(available / capacity * 100), 0 when capacity is 0
 *   availability_level INACTIVE | NONE | LOW | GOOD
 */
function availabilityPercent(available, capacity) {
  const cap = Number(capacity) || 0;
  if (cap <= 0) return 0; // no capacity recorded -> avoid dividing by zero
  const avail = Number(available) || 0;
  return Math.min(100, Math.round((avail / cap) * 100));
}

function availabilityLevel({ status, available, capacity }) {
  if (status !== STATION_STATUS.ACTIVE) return AVAILABILITY_LEVEL.INACTIVE;
  const avail = Number(available) || 0;
  if (avail <= 0) return AVAILABILITY_LEVEL.NONE;
  const low =
    avail <= LOW_AVAILABILITY_COUNT ||
    availabilityPercent(avail, capacity) < LOW_AVAILABILITY_PERCENT;
  return low ? AVAILABILITY_LEVEL.LOW : AVAILABILITY_LEVEL.GOOD;
}

/**
 * Decorate a station row from the database with the derived availability
 * fields and numeric coordinates. Returns a new object; never mutates input.
 */
function decorateStation(row) {
  if (!row) return row;
  const capacity = Number(row.capacity) || 0;
  const available = Number(row.available_count) || 0;
  const latitude = row.latitude === null || row.latitude === undefined ? null : Number(row.latitude);
  const longitude =
    row.longitude === null || row.longitude === undefined ? null : Number(row.longitude);

  return {
    ...row,
    capacity,
    available_count: available,
    bikes_at_station: Number(row.bikes_at_station) || 0,
    latitude,
    longitude,
    has_coordinates: latitude !== null && longitude !== null,
    availability_pct: availabilityPercent(available, capacity),
    availability_level: availabilityLevel({ status: row.status, available, capacity }),
  };
}

module.exports = { availabilityPercent, availabilityLevel, decorateStation };
