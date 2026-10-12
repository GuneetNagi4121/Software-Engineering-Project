'use strict';

const asyncHandler = require('../utils/asyncHandler');
const maintenanceService = require('../services/maintenanceService');
const rentalService = require('../services/rentalService');
const { toPositiveInt } = require('../utils/validators');
const ApiError = require('../utils/ApiError');

function idParam(req) {
  const id = toPositiveInt(req.params.id);
  if (!id) throw ApiError.badRequest('Invalid maintenance report id');
  return id;
}

/** POST /api/maintenance — report a problem with a bicycle. */
const create = asyncHandler(async (req, res) => {
  const result = await maintenanceService.createReport(req.user.id, req.body);
  res.status(201).json(result);
});

/** GET /api/maintenance/me — the reports the signed-in student submitted. */
const mine = asyncHandler(async (req, res) => {
  const { status } = req.query;
  const { limit, offset } = rentalService.resolvePagination(req.query);
  const { reports, total } = await maintenanceService.listForUser(req.user.id, {
    status,
    limit,
    offset,
  });
  res.json({ reports, pagination: { limit, offset, total } });
});

/** GET /api/maintenance — every report (admin), with filters. */
const list = asyncHandler(async (req, res) => {
  const { status, severity, category, bicycle_id: bicycleId, from, to } = req.query;
  const { limit, offset } = rentalService.resolvePagination(req.query);
  const { reports, total } = await maintenanceService.listAll(
    {
      status,
      severity,
      category,
      bicycleId: bicycleId ? toPositiveInt(bicycleId) : undefined,
      from: from || undefined,
      to: to || undefined,
    },
    { limit, offset }
  );
  res.json({ reports, pagination: { limit, offset, total } });
});

/** GET /api/maintenance/stats — counts by status (admin). */
const stats = asyncHandler(async (req, res) => {
  res.json({ stats: await maintenanceService.stats() });
});

/** GET /api/maintenance/:id — one report (own report, or any for an admin). */
const getOne = asyncHandler(async (req, res) => {
  const report = await maintenanceService.getById(idParam(req), {
    userId: req.user.id,
    role: req.user.role,
  });
  res.json({ report });
});

/** PATCH /api/maintenance/:id/status — move a report along (admin). */
const updateStatus = asyncHandler(async (req, res) => {
  const result = await maintenanceService.updateStatus(idParam(req), req.user.id, req.body);
  res.json(result);
});

module.exports = { create, mine, list, stats, getOne, updateStatus };
