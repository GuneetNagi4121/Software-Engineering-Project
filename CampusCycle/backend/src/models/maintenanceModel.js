'use strict';

const { pool } = require('../config/db');
const {
  MAINTENANCE_OPEN_STATUSES,
  SAFETY_HOLD_SEVERITIES,
} = require('../utils/constants');

/**
 * Data access for the `maintenance_reports` table.
 */

const SELECT_DETAIL = `
  SELECT m.id, m.bicycle_id, m.reported_by, m.category, m.description,
         m.severity, m.status, m.reported_at, m.resolved_at, m.resolved_by,
         m.resolution_notes, m.created_at, m.updated_at,
         b.cycle_code  AS bicycle_code,
         b.qr_code     AS bicycle_qr,
         b.status      AS bicycle_status,
         b.station_id  AS bicycle_station_id,
         st.name       AS bicycle_station_name,
         reporter.name  AS reported_by_name,
         reporter.email AS reported_by_email,
         resolver.name  AS resolved_by_name
  FROM maintenance_reports m
  JOIN bicycles b           ON b.id = m.bicycle_id
  LEFT JOIN stations st     ON st.id = b.station_id
  JOIN users reporter       ON reporter.id = m.reported_by
  LEFT JOIN users resolver  ON resolver.id = m.resolved_by`;

async function create(
  { bicycleId, reportedBy, category, description, severity },
  db = pool
) {
  const { rows } = await db.query(
    `INSERT INTO maintenance_reports
       (bicycle_id, reported_by, category, description, severity, status, reported_at)
     VALUES ($1, $2, $3, $4, $5, 'OPEN', NOW())
     RETURNING id`,
    [bicycleId, reportedBy, category, description, severity]
  );
  return findById(rows[0].id, db);
}

async function findById(id, db = pool) {
  const { rows } = await db.query(`${SELECT_DETAIL} WHERE m.id = $1`, [id]);
  return rows[0] || null;
}

/** Lock a report row for a status-change transaction. */
async function findByIdForUpdate(id, db) {
  const { rows } = await db.query(
    `SELECT id, bicycle_id, severity, status, resolved_at
     FROM maintenance_reports WHERE id = $1 FOR UPDATE`,
    [id]
  );
  return rows[0] || null;
}

function buildFilters({ reportedBy, bicycleId, status, severity, category, from, to } = {}, params = []) {
  const conditions = [];
  if (reportedBy) {
    params.push(reportedBy);
    conditions.push(`m.reported_by = $${params.length}`);
  }
  if (bicycleId) {
    params.push(bicycleId);
    conditions.push(`m.bicycle_id = $${params.length}`);
  }
  if (status) {
    params.push(status);
    conditions.push(`m.status = $${params.length}`);
  }
  if (severity) {
    params.push(severity);
    conditions.push(`m.severity = $${params.length}`);
  }
  if (category) {
    params.push(category);
    conditions.push(`m.category = $${params.length}`);
  }
  if (from) {
    params.push(from);
    conditions.push(`m.reported_at >= $${params.length}`);
  }
  if (to) {
    params.push(to);
    conditions.push(`m.reported_at <= $${params.length}`);
  }
  return conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
}

/**
 * Paginated list. Open reports first, then newest first, so an admin sees
 * what still needs attention at the top.
 */
async function listPaged(filters = {}, { limit = 25, offset = 0 } = {}, db = pool) {
  const params = [];
  const where = buildFilters(filters, params);

  const countResult = await db.query(
    `SELECT COUNT(*)::int AS total FROM maintenance_reports m ${where}`,
    params
  );

  const pageParams = params.slice();
  pageParams.push(limit);
  const limitPh = `$${pageParams.length}`;
  pageParams.push(offset);
  const offsetPh = `$${pageParams.length}`;

  const { rows } = await db.query(
    `${SELECT_DETAIL} ${where}
     ORDER BY
       CASE m.status WHEN 'OPEN' THEN 0 WHEN 'IN_PROGRESS' THEN 1
                     WHEN 'RESOLVED' THEN 2 ELSE 3 END,
       CASE m.severity WHEN 'CRITICAL' THEN 0 WHEN 'HIGH' THEN 1
                       WHEN 'MEDIUM' THEN 2 ELSE 3 END,
       m.reported_at DESC, m.id DESC
     LIMIT ${limitPh} OFFSET ${offsetPh}`,
    pageParams
  );

  return { reports: rows, total: countResult.rows[0].total };
}

/**
 * Update the status of a report, recording resolution details when it moves
 * into a finished state and clearing them when it is reopened.
 */
async function updateStatus(
  { id, status, resolvedBy, resolutionNotes, finished },
  db = pool
) {
  const { rows } = await db.query(
    `UPDATE maintenance_reports
     SET status = $2,
         resolved_at = CASE WHEN $5::boolean THEN COALESCE(resolved_at, NOW()) ELSE NULL END,
         resolved_by = CASE WHEN $5::boolean THEN $3::int ELSE NULL END,
         resolution_notes = COALESCE($4::text, resolution_notes)
     WHERE id = $1
     RETURNING id`,
    [id, status, resolvedBy ?? null, resolutionNotes ?? null, finished]
  );
  if (rows.length === 0) return null;
  return findById(id, db);
}

/**
 * Open (OPEN/IN_PROGRESS) high-severity reports for a bicycle — the SAFETY
 * HOLD check. Pass a transaction client when called inside a rental.
 */
async function findSafetyHolds(bicycleId, db = pool) {
  const { rows } = await db.query(
    `SELECT id, category, severity, status, reported_at
     FROM maintenance_reports
     WHERE bicycle_id = $1
       AND status = ANY($2::text[])
       AND severity = ANY($3::text[])
     ORDER BY reported_at`,
    [bicycleId, MAINTENANCE_OPEN_STATUSES, SAFETY_HOLD_SEVERITIES]
  );
  return rows;
}

/** Counts by status, always including every status key. */
async function countByStatus(db = pool) {
  const { rows } = await db.query(
    'SELECT status, COUNT(*)::int AS count FROM maintenance_reports GROUP BY status'
  );
  const counts = { OPEN: 0, IN_PROGRESS: 0, RESOLVED: 0, CLOSED: 0 };
  for (const r of rows) counts[r.status] = r.count;
  counts.TOTAL = Object.values(counts).reduce((a, b) => a + b, 0);
  return counts;
}

/** Bicycle ids currently on safety hold — used to annotate bicycle lists. */
async function bicycleIdsOnSafetyHold(db = pool) {
  const { rows } = await db.query(
    `SELECT DISTINCT bicycle_id
     FROM maintenance_reports
     WHERE status = ANY($1::text[]) AND severity = ANY($2::text[])`,
    [MAINTENANCE_OPEN_STATUSES, SAFETY_HOLD_SEVERITIES]
  );
  return rows.map((r) => r.bicycle_id);
}

module.exports = {
  create,
  findById,
  findByIdForUpdate,
  listPaged,
  updateStatus,
  findSafetyHolds,
  countByStatus,
  bicycleIdsOnSafetyHold,
};
