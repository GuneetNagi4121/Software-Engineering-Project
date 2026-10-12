'use strict';

const { withTransaction, pool } = require('../config/db');
const maintenanceModel = require('../models/maintenanceModel');
const bicycleModel = require('../models/bicycleModel');
const ApiError = require('../utils/ApiError');
const {
  BICYCLE_STATUS,
  MAINTENANCE_CATEGORY_VALUES,
  MAINTENANCE_SEVERITY,
  MAINTENANCE_SEVERITY_VALUES,
  MAINTENANCE_STATUS,
  MAINTENANCE_STATUS_VALUES,
  MAINTENANCE_TRANSITIONS,
  MAINTENANCE_CLOSED_STATUSES,
  SAFETY_HOLD_SEVERITIES,
  ROLES,
} = require('../utils/constants');
const { isNonEmptyString, toPositiveInt, FieldErrors } = require('../utils/validators');

const DESCRIPTION_MAX = 1000;
const NOTES_MAX = 1000;

/** Statuses from which a parked bicycle is pulled out of service immediately. */
const PARKED_STATUSES = [BICYCLE_STATUS.AVAILABLE, BICYCLE_STATUS.RESERVED];

/**
 * Whether a bicycle is on safety hold — it has at least one OPEN or
 * IN_PROGRESS report of HIGH or CRITICAL severity.
 *
 * This is the single check used by the rental flow, the return flow and the
 * admin status change, so a bicycle with an unresolved safety issue can never
 * be made available again by any route.
 *
 * @param {number} bicycleId
 * @param {object} [db] pool or transaction client
 */
async function getSafetyHolds(bicycleId, db = pool) {
  return maintenanceModel.findSafetyHolds(bicycleId, db);
}

async function isOnSafetyHold(bicycleId, db = pool) {
  const holds = await getSafetyHolds(bicycleId, db);
  return holds.length > 0;
}

function validateReportInput(body) {
  const v = new FieldErrors();
  const bicycleId = toPositiveInt(body.bicycle_id);
  const category = typeof body.category === 'string' ? body.category.trim().toUpperCase() : '';
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  const severity =
    body.severity === undefined || body.severity === null || body.severity === ''
      ? MAINTENANCE_SEVERITY.MEDIUM
      : String(body.severity).trim().toUpperCase();

  v.check(bicycleId !== null, 'bicycle_id', 'Choose the bicycle you are reporting');
  v.check(
    MAINTENANCE_CATEGORY_VALUES.includes(category),
    'category',
    `Category must be one of: ${MAINTENANCE_CATEGORY_VALUES.join(', ')}`
  );
  v.check(isNonEmptyString(description), 'description', 'Describe the problem');
  v.check(
    description.length <= DESCRIPTION_MAX,
    'description',
    `Description must be ${DESCRIPTION_MAX} characters or fewer`
  );
  v.check(
    MAINTENANCE_SEVERITY_VALUES.includes(severity),
    'severity',
    `Severity must be one of: ${MAINTENANCE_SEVERITY_VALUES.join(', ')}`
  );
  v.throwIfAny();

  return { bicycleId, category, description, severity };
}

/**
 * A student (or admin) reports a problem with a bicycle.
 *
 * Safety workflow, all inside one transaction with the bicycle row locked so
 * it cannot race a rental or an admin status change:
 *   - HIGH / CRITICAL  -> the bicycle goes on safety hold. If it is parked it
 *                         is moved to MAINTENANCE straight away; if it is out
 *                         on a ride the hold is applied when it is returned.
 *   - LOW / MEDIUM     -> recorded and flagged for admin review; the bicycle
 *                         stays in service.
 */
async function createReport(userId, body) {
  const { bicycleId, category, description, severity } = validateReportInput(body);
  const isSafetyIssue = SAFETY_HOLD_SEVERITIES.includes(severity);

  return withTransaction(async (client) => {
    const bike = await bicycleModel.findByIdForUpdate(bicycleId, client);
    if (!bike) {
      throw ApiError.unprocessable('That bicycle does not exist', {
        bicycle_id: 'Unknown bicycle',
      });
    }

    const report = await maintenanceModel.create(
      { bicycleId, reportedBy: userId, category, description, severity },
      client
    );

    let bicycleStatusChanged = false;
    if (isSafetyIssue && PARKED_STATUSES.includes(bike.status)) {
      // Pull it out of service now; it keeps its station so staff can find it.
      await bicycleModel.setStatusAndStation(
        bike.id,
        BICYCLE_STATUS.MAINTENANCE,
        bike.station_id,
        client
      );
      bicycleStatusChanged = true;
    }

    const bicycle = await bicycleModel.findById(bicycleId, client);

    return {
      report,
      bicycle,
      safety_hold: isSafetyIssue,
      bicycle_status_changed: bicycleStatusChanged,
      message: isSafetyIssue
        ? bicycleStatusChanged
          ? 'Thanks — this cycle has been taken out of service for inspection.'
          : 'Thanks — this cycle will be inspected as soon as the current ride ends.'
        : 'Thanks — your report has been sent to the maintenance team for review.',
    };
  });
}

/** Reports submitted by one student. */
async function listForUser(userId, { status, limit = 50, offset = 0 } = {}) {
  if (status && !MAINTENANCE_STATUS_VALUES.includes(status)) {
    throw ApiError.badRequest('Invalid maintenance status filter');
  }
  return maintenanceModel.listPaged({ reportedBy: userId, status }, { limit, offset });
}

/** Every report (admin), with filters. */
async function listAll(filters = {}, pagination = {}) {
  const { status, severity, category } = filters;
  if (status && !MAINTENANCE_STATUS_VALUES.includes(status)) {
    throw ApiError.badRequest('Invalid maintenance status filter');
  }
  if (severity && !MAINTENANCE_SEVERITY_VALUES.includes(severity)) {
    throw ApiError.badRequest('Invalid severity filter');
  }
  if (category && !MAINTENANCE_CATEGORY_VALUES.includes(category)) {
    throw ApiError.badRequest('Invalid category filter');
  }
  return maintenanceModel.listPaged(filters, pagination);
}

/**
 * One report. Students may only read their own; admins may read any.
 */
async function getById(id, { userId, role }) {
  const report = await maintenanceModel.findById(id);
  if (!report) throw ApiError.notFound('Maintenance report not found');
  if (role !== ROLES.ADMIN && report.reported_by !== userId) {
    throw ApiError.forbidden('You can only view your own maintenance reports');
  }
  return report;
}

/**
 * Admin moves a report along its lifecycle.
 *
 * OPEN -> IN_PROGRESS -> RESOLVED -> CLOSED, with reopening allowed from
 * IN_PROGRESS and RESOLVED. CLOSED is terminal. Resolution notes are required
 * when finishing a report.
 */
async function updateStatus(id, adminId, body) {
  const status = typeof body.status === 'string' ? body.status.trim().toUpperCase() : '';
  const resolutionNotes =
    typeof body.resolution_notes === 'string' ? body.resolution_notes.trim() : '';

  const v = new FieldErrors();
  v.check(
    MAINTENANCE_STATUS_VALUES.includes(status),
    'status',
    `Status must be one of: ${MAINTENANCE_STATUS_VALUES.join(', ')}`
  );
  v.check(
    resolutionNotes.length <= NOTES_MAX,
    'resolution_notes',
    `Notes must be ${NOTES_MAX} characters or fewer`
  );
  v.throwIfAny();

  const finished = MAINTENANCE_CLOSED_STATUSES.includes(status);

  return withTransaction(async (client) => {
    const existing = await maintenanceModel.findByIdForUpdate(id, client);
    if (!existing) throw ApiError.notFound('Maintenance report not found');

    if (existing.status === status) {
      throw ApiError.conflict(`This report is already ${status}`);
    }

    const allowed = MAINTENANCE_TRANSITIONS[existing.status] || [];
    if (!allowed.includes(status)) {
      throw ApiError.conflict(
        allowed.length === 0
          ? `A ${existing.status} report cannot be changed any further`
          : `A ${existing.status} report can only move to: ${allowed.join(', ')}`,
        { status: 'Invalid transition' }
      );
    }

    if (finished && !resolutionNotes) {
      throw ApiError.unprocessable('Explain what was done before closing the report', {
        resolution_notes: 'Resolution notes are required',
      });
    }

    // Lock the bicycle too: resolving a report can lift a safety hold, and we
    // must not interleave with a rental or an admin status change.
    await bicycleModel.findByIdForUpdate(existing.bicycle_id, client);

    const report = await maintenanceModel.updateStatus(
      {
        id,
        status,
        resolvedBy: finished ? adminId : null,
        resolutionNotes: resolutionNotes || null,
        finished,
      },
      client
    );

    const remainingHolds = await getSafetyHolds(existing.bicycle_id, client);
    const bicycle = await bicycleModel.findById(existing.bicycle_id, client);

    return {
      report,
      bicycle,
      safety_hold: remainingHolds.length > 0,
      open_safety_issues: remainingHolds.length,
      // The bicycle is never silently returned to service: an admin must set
      // it back to AVAILABLE explicitly, and may only do so once this is true.
      bicycle_can_return_to_service:
        remainingHolds.length === 0 && bicycle && bicycle.status === BICYCLE_STATUS.MAINTENANCE,
    };
  });
}

async function stats() {
  return maintenanceModel.countByStatus();
}

module.exports = {
  createReport,
  listForUser,
  listAll,
  getById,
  updateStatus,
  stats,
  getSafetyHolds,
  isOnSafetyHold,
};
