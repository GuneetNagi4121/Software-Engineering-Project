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

const list = asyncHandler(async (req, res) => {
  res.json({ stations: await stationService.list() });
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

module.exports = { list, getOne, create, update, setStatus, remove };
