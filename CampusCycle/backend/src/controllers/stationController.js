'use strict';

const asyncHandler = require('../utils/asyncHandler');
const stationService = require('../services/stationService');
const { toPositiveInt } = require('../utils/validators');
const ApiError = require('../utils/ApiError');

function idParam(req) {
  const id = toPositiveInt(req.params.id);
  if (!id) throw ApiError.badRequest('Invalid station id');
  return id;
}

/**
 * GET /api/stations — stations with live availability.
 * Optional filters: ?availability=GOOD|LOW|NONE|INACTIVE, ?status=,
 * ?mapped=true, ?sort=availability|availability_desc|name
 */
const list = asyncHandler(async (req, res) => {
  const { availability, status, mapped, sort } = req.query;
  const stations = await stationService.list({
    availability,
    status,
    mappedOnly: mapped === 'true' || mapped === '1',
    sort,
  });
  res.json({ stations });
});

/** GET /api/stations/map — stations with coordinates + the campus boundary. */
const map = asyncHandler(async (req, res) => {
  res.json(await stationService.mapData());
});

const getOne = asyncHandler(async (req, res) => {
  res.json({ station: await stationService.getById(idParam(req)) });
});

const create = asyncHandler(async (req, res) => {
  const station = await stationService.create(req.body);
  res.status(201).json({ station });
});

const update = asyncHandler(async (req, res) => {
  const station = await stationService.update(idParam(req), req.body);
  res.json({ station });
});

const setStatus = asyncHandler(async (req, res) => {
  const station = await stationService.setStatus(idParam(req), req.body.status);
  res.json({ station });
});

const remove = asyncHandler(async (req, res) => {
  res.json(await stationService.remove(idParam(req)));
});

module.exports = { list, map, getOne, create, update, setStatus, remove };
