'use strict';

/**
 * Shared domain constants. Mirrors the CHECK constraints in schema.sql so the
 * application and the database agree on the allowed values.
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

module.exports = {
  ROLES,
  BICYCLE_STATUS,
  RENTAL_STATUS,
  STATION_STATUS,
  ROLE_VALUES: Object.values(ROLES),
  BICYCLE_STATUS_VALUES: Object.values(BICYCLE_STATUS),
  RENTAL_STATUS_VALUES: Object.values(RENTAL_STATUS),
  STATION_STATUS_VALUES: Object.values(STATION_STATUS),
};
