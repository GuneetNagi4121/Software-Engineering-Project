'use strict';

const bicycleModel = require('../models/bicycleModel');
const stationModel = require('../models/stationModel');
const rentalModel = require('../models/rentalModel');
const ApiError = require('../utils/ApiError');
const { BICYCLE_STATUS, BICYCLE_STATUS_VALUES } = require('../utils/constants');
const { isNonEmptyString, toPositiveInt, FieldErrors } = require('../utils/validators');

/** Statuses for which a bicycle is physically parked at a station. */
const PARKED_STATUSES = [BICYCLE_STATUS.AVAILABLE, BICYCLE_STATUS.RESERVED];

async function assertStationHasRoom(stationId, excludeBicycleId = null) {
  const station = await stationModel.findById(stationId);
  if (!station) {
    throw ApiError.unprocessable('Selected station does not exist', { stationId: 'Unknown station' });
  }
  const bikesAtStation = await bicycleModel.list({ stationId });
  const currentCount = excludeBicycleId
    ? bikesAtStation.filter((b) => b.id !== excludeBicycleId).length
    : bikesAtStation.length;
  if (currentCount >= station.capacity) {
    throw ApiError.conflict(
      `Station "${station.name}" is full (${station.capacity}/${station.capacity})`,
      { stationId: 'Station at capacity' }
    );
  }
  return station;
}

/**
 * Normalise and validate create/update input.
 * @returns {{cycleCode:string, qrCode:string, stationId:number|null, status:string}}
 */
function normalizeInput(body) {
  const v = new FieldErrors();
  const cycleCode = typeof body.cycle_code === 'string' ? body.cycle_code.trim() : body.cycle_code;
  const qrCode = typeof body.qr_code === 'string' ? body.qr_code.trim() : body.qr_code;
  const status = body.status || BICYCLE_STATUS.AVAILABLE;
  const stationId =
    body.station_id === null || body.station_id === undefined || body.station_id === ''
      ? null
      : toPositiveInt(body.station_id);

  v.check(isNonEmptyString(cycleCode), 'cycle_code', 'Cycle code is required');
  v.check(isNonEmptyString(qrCode), 'qr_code', 'QR code is required');
  v.check(BICYCLE_STATUS_VALUES.includes(status), 'status', 'Invalid bicycle status');
  if (body.station_id !== null && body.station_id !== undefined && body.station_id !== '') {
    v.check(stationId !== null, 'station_id', 'Station id must be a positive integer');
  }
  // A parked bike (available/reserved) must live at a station.
  if (PARKED_STATUSES.includes(status)) {
    v.check(stationId !== null, 'station_id', 'A station is required for available/reserved bicycles');
  }
  v.throwIfAny();

  return { cycleCode, qrCode, stationId, status };
}

async function list(filters) {
  return bicycleModel.list(filters);
}

async function getById(id) {
  const bike = await bicycleModel.findById(id);
  if (!bike) throw ApiError.notFound('Bicycle not found');
  return bike;
}

async function create(body) {
  const { cycleCode, qrCode, stationId, status } = normalizeInput(body);

  if (await bicycleModel.existsCycleCode(cycleCode)) {
    throw ApiError.conflict('A bicycle with this cycle code already exists', { cycle_code: 'Already in use' });
  }
  if (await bicycleModel.existsQrCode(qrCode)) {
    throw ApiError.conflict('A bicycle with this QR code already exists', { qr_code: 'Already in use' });
  }

  // IN_USE bikes are not at a station; ignore any provided station.
  const effectiveStationId = status === BICYCLE_STATUS.IN_USE ? null : stationId;
  if (effectiveStationId !== null) {
    await assertStationHasRoom(effectiveStationId);
  }

  return bicycleModel.create({ cycleCode, qrCode, stationId: effectiveStationId, status });
}

async function update(id, body) {
  const existing = await bicycleModel.findById(id);
  if (!existing) throw ApiError.notFound('Bicycle not found');

  if (await rentalModel.hasActiveRentalForBicycle(id)) {
    throw ApiError.conflict('This bicycle is on an active ride and cannot be edited until it is returned');
  }

  // Merge with existing so callers may send partial updates.
  const merged = normalizeInput({
    cycle_code: body.cycle_code !== undefined ? body.cycle_code : existing.cycle_code,
    qr_code: body.qr_code !== undefined ? body.qr_code : existing.qr_code,
    station_id: body.station_id !== undefined ? body.station_id : existing.station_id,
    status: body.status !== undefined ? body.status : existing.status,
  });

  if (await bicycleModel.existsCycleCode(merged.cycleCode, id)) {
    throw ApiError.conflict('A bicycle with this cycle code already exists', { cycle_code: 'Already in use' });
  }
  if (await bicycleModel.existsQrCode(merged.qrCode, id)) {
    throw ApiError.conflict('A bicycle with this QR code already exists', { qr_code: 'Already in use' });
  }

  const effectiveStationId = merged.status === BICYCLE_STATUS.IN_USE ? null : merged.stationId;
  if (effectiveStationId !== null && effectiveStationId !== existing.station_id) {
    await assertStationHasRoom(effectiveStationId, id);
  }

  return bicycleModel.update(id, {
    cycleCode: merged.cycleCode,
    qrCode: merged.qrCode,
    stationId: effectiveStationId,
    status: merged.status,
  });
}

/**
 * Change only the status of a bicycle (admin). Optionally reassign a station.
 * Blocked while the bicycle is on an active ride (use the return flow instead).
 */
async function changeStatus(id, status, stationIdRaw) {
  if (!BICYCLE_STATUS_VALUES.includes(status)) {
    throw ApiError.unprocessable('Invalid bicycle status', { status: 'Unknown status' });
  }
  const existing = await bicycleModel.findById(id);
  if (!existing) throw ApiError.notFound('Bicycle not found');

  if (await rentalModel.hasActiveRentalForBicycle(id)) {
    throw ApiError.conflict('This bicycle is on an active ride; end the ride before changing its status');
  }

  let stationId =
    stationIdRaw === undefined ? existing.station_id : toPositiveInt(stationIdRaw);
  if (stationIdRaw === null || stationIdRaw === '') stationId = null;

  if (status === BICYCLE_STATUS.IN_USE) {
    // Cannot be manually moved to IN_USE without a rental.
    throw ApiError.conflict('A bicycle can only become IN_USE through a rental');
  }
  if (PARKED_STATUSES.includes(status) && stationId === null) {
    throw ApiError.unprocessable('A station is required to make this bicycle available', {
      station_id: 'Station required',
    });
  }
  if (stationId !== null && stationId !== existing.station_id) {
    await assertStationHasRoom(stationId, id);
  }

  return bicycleModel.setStatusAndStation(id, status, stationId);
}

async function remove(id) {
  const existing = await bicycleModel.findById(id);
  if (!existing) throw ApiError.notFound('Bicycle not found');
  if (await rentalModel.hasActiveRentalForBicycle(id)) {
    throw ApiError.conflict('This bicycle is on an active ride and cannot be deleted');
  }
  await bicycleModel.remove(id);
  return { id: Number(id), deleted: true };
}

async function stats() {
  return bicycleModel.countByStatus();
}

module.exports = { list, getById, create, update, changeStatus, remove, stats };
