'use strict';

const asyncHandler = require('../utils/asyncHandler');
const bicycleService = require('../services/bicycleService');
const { toPositiveInt } = require('../utils/validators');
const ApiError = require('../utils/ApiError');
const { BICYCLE_STATUS_VALUES } = require('../utils/constants');

function idParam(req) {
  const id = toPositiveInt(req.params.id);
  if (!id) throw ApiError.badRequest('Invalid bicycle id');
  return id;
}

const list = asyncHandler(async (req, res) => {
  const { status, station_id: stationId, search } = req.query;
  if (status && !BICYCLE_STATUS_VALUES.includes(status)) {
    throw ApiError.badRequest('Invalid status filter');
  }
  const bicycles = await bicycleService.list({
    status,
    stationId: stationId ? toPositiveInt(stationId) : undefined,
    search: search ? String(search) : undefined,
  });
  res.json({ bicycles });
});

const stats = asyncHandler(async (req, res) => {
  res.json({ stats: await bicycleService.stats() });
});

const getOne = asyncHandler(async (req, res) => {
  res.json({ bicycle: await bicycleService.getById(idParam(req)) });
});

const create = asyncHandler(async (req, res) => {
  const bicycle = await bicycleService.create(req.body);
  res.status(201).json({ bicycle });
});

const update = asyncHandler(async (req, res) => {
  const bicycle = await bicycleService.update(idParam(req), req.body);
  res.json({ bicycle });
});

const changeStatus = asyncHandler(async (req, res) => {
  const bicycle = await bicycleService.changeStatus(idParam(req), req.body.status, req.body.station_id);
  res.json({ bicycle });
});

const remove = asyncHandler(async (req, res) => {
  res.json(await bicycleService.remove(idParam(req)));
});

module.exports = { list, stats, getOne, create, update, changeStatus, remove };
