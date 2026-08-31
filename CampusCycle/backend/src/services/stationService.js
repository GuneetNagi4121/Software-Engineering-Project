'use strict';

const stationModel = require('../models/stationModel');
const ApiError = require('../utils/ApiError');
const { STATION_STATUS, STATION_STATUS_VALUES } = require('../utils/constants');
const { isNonEmptyString, FieldErrors } = require('../utils/validators');

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
  v.throwIfAny();
}

async function list() {
  return stationModel.listWithCounts();
}

async function getById(id) {
  const station = await stationModel.findByIdWithCounts(id);
  if (!station) throw ApiError.notFound('Station not found');
  return station;
}

async function create(input) {
  validateStationInput(input);
  return stationModel.create({
    name: input.name.trim(),
    location: input.location.trim(),
    capacity: input.capacity,
    status: input.status || STATION_STATUS.ACTIVE,
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
  };
  validateStationInput(merged);

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

module.exports = { list, getById, create, update, setStatus, remove };
