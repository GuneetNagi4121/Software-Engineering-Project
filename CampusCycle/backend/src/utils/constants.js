'use strict';

/**
 * Shared domain constants. Mirrors the CHECK constraints in schema.sql and
 * database/migrations/ so the application and the database agree on the
 * allowed values.
 */

const ROLES = Object.freeze({
  STUDENT: 'STUDENT',
  ADMIN: 'ADMIN',
});

const BICYCLE_STATUS = Object.freeze({
  AVAILABLE: 'AVAILABLE',
  RESERVED: 'RESERVED',
  IN_USE: 'IN_USE',
  MAINTENANCE: 'MAINTENANCE',
});

const RENTAL_STATUS = Object.freeze({
  ACTIVE: 'ACTIVE',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
});

const STATION_STATUS = Object.freeze({
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
});

// --- Phase 2 ---------------------------------------------------------------

/** Issue categories a student can report against a bicycle. */
const MAINTENANCE_CATEGORY = Object.freeze({
  BRAKES: 'BRAKES',
  TYRE: 'TYRE',
  CHAIN: 'CHAIN',
  LIGHT: 'LIGHT',
  SEAT: 'SEAT',
  OTHER: 'OTHER',
});

const MAINTENANCE_SEVERITY = Object.freeze({
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL',
});

const MAINTENANCE_STATUS = Object.freeze({
  OPEN: 'OPEN',
  IN_PROGRESS: 'IN_PROGRESS',
  RESOLVED: 'RESOLVED',
  CLOSED: 'CLOSED',
});

/**
 * Severities that place a bicycle on a SAFETY HOLD while the report is still
 * OPEN or IN_PROGRESS. A bicycle on safety hold cannot start a new rental and
 * cannot be moved back to AVAILABLE.
 */
const SAFETY_HOLD_SEVERITIES = Object.freeze([
  MAINTENANCE_SEVERITY.HIGH,
  MAINTENANCE_SEVERITY.CRITICAL,
]);

/** Statuses that count as "still being dealt with". */
const MAINTENANCE_OPEN_STATUSES = Object.freeze([
  MAINTENANCE_STATUS.OPEN,
  MAINTENANCE_STATUS.IN_PROGRESS,
]);

/** Statuses that count as finished (and therefore need a resolution time). */
const MAINTENANCE_CLOSED_STATUSES = Object.freeze([
  MAINTENANCE_STATUS.RESOLVED,
  MAINTENANCE_STATUS.CLOSED,
]);

/**
 * Allowed maintenance status transitions. CLOSED is terminal.
 */
const MAINTENANCE_TRANSITIONS = Object.freeze({
  OPEN: [MAINTENANCE_STATUS.IN_PROGRESS, MAINTENANCE_STATUS.RESOLVED, MAINTENANCE_STATUS.CLOSED],
  IN_PROGRESS: [MAINTENANCE_STATUS.OPEN, MAINTENANCE_STATUS.RESOLVED, MAINTENANCE_STATUS.CLOSED],
  RESOLVED: [MAINTENANCE_STATUS.IN_PROGRESS, MAINTENANCE_STATUS.CLOSED],
  CLOSED: [],
});

const GEOFENCE_EVENT_STATUS = Object.freeze({
  OPEN: 'OPEN',
  ACKNOWLEDGED: 'ACKNOWLEDGED',
  RESOLVED: 'RESOLVED',
});

/**
 * Where a bicycle location came from. CampusCycle has no GPS hardware on the
 * bicycles, so Phase 2 only accepts SIMULATED updates; DEVICE is reserved for
 * a future GPS/IoT integration and is rejected by the API today.
 */
const LOCATION_SOURCE = Object.freeze({
  SIMULATED: 'SIMULATED',
  DEVICE: 'DEVICE',
});

const ACCEPTED_LOCATION_SOURCES = Object.freeze([LOCATION_SOURCE.SIMULATED]);

/**
 * Station availability levels. One definition, used by the station list, the
 * station detail page and the campus map so they can never disagree.
 *
 *   INACTIVE — the station itself is not in service
 *   NONE     — no bicycles available
 *   LOW      — at most LOW_AVAILABILITY_COUNT bicycles left, or fewer than
 *              LOW_AVAILABILITY_PERCENT of the station's capacity
 *   GOOD     — anything above that
 *
 * Both tests matter: a count catches "only two left" at a large station, and
 * a percentage catches "nearly empty" at a small one.
 */
const AVAILABILITY_LEVEL = Object.freeze({
  GOOD: 'GOOD',
  LOW: 'LOW',
  NONE: 'NONE',
  INACTIVE: 'INACTIVE',
});

const LOW_AVAILABILITY_PERCENT = 20;
const LOW_AVAILABILITY_COUNT = 2;

module.exports = {
  ROLES,
  BICYCLE_STATUS,
  RENTAL_STATUS,
  STATION_STATUS,
  MAINTENANCE_CATEGORY,
  MAINTENANCE_SEVERITY,
  MAINTENANCE_STATUS,
  MAINTENANCE_TRANSITIONS,
  MAINTENANCE_OPEN_STATUSES,
  MAINTENANCE_CLOSED_STATUSES,
  SAFETY_HOLD_SEVERITIES,
  GEOFENCE_EVENT_STATUS,
  LOCATION_SOURCE,
  ACCEPTED_LOCATION_SOURCES,
  AVAILABILITY_LEVEL,
  LOW_AVAILABILITY_PERCENT,
  LOW_AVAILABILITY_COUNT,
  ROLE_VALUES: Object.values(ROLES),
  BICYCLE_STATUS_VALUES: Object.values(BICYCLE_STATUS),
  RENTAL_STATUS_VALUES: Object.values(RENTAL_STATUS),
  STATION_STATUS_VALUES: Object.values(STATION_STATUS),
  MAINTENANCE_CATEGORY_VALUES: Object.values(MAINTENANCE_CATEGORY),
  MAINTENANCE_SEVERITY_VALUES: Object.values(MAINTENANCE_SEVERITY),
  MAINTENANCE_STATUS_VALUES: Object.values(MAINTENANCE_STATUS),
  GEOFENCE_EVENT_STATUS_VALUES: Object.values(GEOFENCE_EVENT_STATUS),
  LOCATION_SOURCE_VALUES: Object.values(LOCATION_SOURCE),
  AVAILABILITY_LEVEL_VALUES: Object.values(AVAILABILITY_LEVEL),
};
