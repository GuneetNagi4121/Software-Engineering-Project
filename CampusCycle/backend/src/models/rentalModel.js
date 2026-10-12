'use strict';

const { pool } = require('../config/db');

/**
 * Data access for the `rentals` table.
 * Detailed read queries join student name, bicycle code and station names.
 *
 * `duration_seconds` is computed by PostgreSQL from the stored timestamps:
 *   - completed/cancelled rides -> ended_at - started_at
 *   - active rides              -> NOW() - started_at (still running)
 *   - missing/invalid timestamps-> NULL (never a negative or invented value)
 * All timestamps are TIMESTAMPTZ, so the arithmetic is timezone-safe and the
 * API always hands the frontend UTC instants.
 */

const DURATION_EXPR = `
  CASE
    WHEN r.started_at IS NULL THEN NULL
    WHEN r.ended_at IS NOT NULL AND r.ended_at >= r.started_at
      THEN GREATEST(0, EXTRACT(EPOCH FROM (r.ended_at - r.started_at)))::bigint
    WHEN r.ended_at IS NOT NULL AND r.ended_at < r.started_at THEN NULL
    WHEN r.status = 'ACTIVE'
      THEN GREATEST(0, EXTRACT(EPOCH FROM (NOW() - r.started_at)))::bigint
    ELSE NULL
  END AS duration_seconds`;

const SELECT_DETAIL = `
  SELECT r.id, r.user_id, r.bicycle_id,
         r.start_station_id, r.end_station_id,
         r.started_at, r.ended_at, r.status,
         r.created_at, r.updated_at,
         u.name  AS user_name,
         u.email AS user_email,
         b.cycle_code AS bicycle_code,
         b.qr_code    AS bicycle_qr,
         b.status     AS bicycle_status,
         ss.name AS start_station_name,
         es.name AS end_station_name,
         ${DURATION_EXPR}
  FROM rentals r
  JOIN users u        ON u.id = r.user_id
  JOIN bicycles b     ON b.id = r.bicycle_id
  LEFT JOIN stations ss ON ss.id = r.start_station_id
  LEFT JOIN stations es ON es.id = r.end_station_id`;

/** Convert the bigint duration (returned as a string by pg) to a number. */
function normalize(row) {
  if (!row) return row;
  return {
    ...row,
    duration_seconds:
      row.duration_seconds === null || row.duration_seconds === undefined
        ? null
        : Number(row.duration_seconds),
  };
}

/** Create a new ACTIVE rental inside a transaction. */
async function createActive({ userId, bicycleId, startStationId }, db) {
  const { rows } = await db.query(
    `INSERT INTO rentals (user_id, bicycle_id, start_station_id, status, started_at)
     VALUES ($1, $2, $3, 'ACTIVE', NOW())
     RETURNING id`,
    [userId, bicycleId, startStationId]
  );
  return findDetailById(rows[0].id, db);
}

/** The current user's active rental (locked), used to enforce one-at-a-time. */
async function findActiveByUserForUpdate(userId, db) {
  const { rows } = await db.query(
    `SELECT id FROM rentals WHERE user_id = $1 AND status = 'ACTIVE' FOR UPDATE`,
    [userId]
  );
  return rows[0] || null;
}

/** Lock a rental row for the return transaction. */
async function findByIdForUpdate(id, db) {
  const { rows } = await db.query(
    `SELECT id, user_id, bicycle_id, start_station_id, status
     FROM rentals WHERE id = $1 FOR UPDATE`,
    [id]
  );
  return rows[0] || null;
}

/** Complete a rental (return): set end station, timestamp and status. */
async function complete({ id, endStationId }, db) {
  await db.query(
    `UPDATE rentals
     SET status = 'COMPLETED', end_station_id = $2, ended_at = NOW()
     WHERE id = $1`,
    [id, endStationId]
  );
  return findDetailById(id, db);
}

async function findDetailById(id, db = pool) {
  const { rows } = await db.query(`${SELECT_DETAIL} WHERE r.id = $1`, [id]);
  return rows[0] ? normalize(rows[0]) : null;
}

/** The active rental (with details) for a user, or null. */
async function findActiveDetailByUser(userId, db = pool) {
  const { rows } = await db.query(
    `${SELECT_DETAIL} WHERE r.user_id = $1 AND r.status = 'ACTIVE' LIMIT 1`,
    [userId]
  );
  return rows[0] ? normalize(rows[0]) : null;
}

/**
 * Build the WHERE clause shared by the student and admin history queries.
 * @param {object} filters
 * @param {Array} params  mutated — parameter values in order
 */
function buildFilters(
  { userId, status, bicycleId, stationId, from, to } = {},
  params = []
) {
  const conditions = [];

  if (userId) {
    params.push(userId);
    conditions.push(`r.user_id = $${params.length}`);
  }
  if (status) {
    params.push(status);
    conditions.push(`r.status = $${params.length}`);
  }
  if (bicycleId) {
    params.push(bicycleId);
    conditions.push(`r.bicycle_id = $${params.length}`);
  }
  if (stationId) {
    params.push(stationId);
    conditions.push(
      `(r.start_station_id = $${params.length} OR r.end_station_id = $${params.length})`
    );
  }
  if (from) {
    params.push(from);
    conditions.push(`r.started_at >= $${params.length}`);
  }
  if (to) {
    params.push(to);
    conditions.push(`r.started_at <= $${params.length}`);
  }

  return conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
}

/**
 * Paginated rental history. Used for both a single student's rides
 * (filters.userId set by the service from the authenticated user) and the
 * admin view across all users.
 *
 * @returns {{ rentals: object[], total: number }}
 */
async function listPaged(filters = {}, { limit = 25, offset = 0 } = {}, db = pool) {
  const params = [];
  const where = buildFilters(filters, params);

  const countResult = await db.query(
    `SELECT COUNT(*)::int AS total FROM rentals r ${where}`,
    params
  );

  const pageParams = params.slice();
  pageParams.push(limit);
  const limitPlaceholder = `$${pageParams.length}`;
  pageParams.push(offset);
  const offsetPlaceholder = `$${pageParams.length}`;

  const { rows } = await db.query(
    `${SELECT_DETAIL} ${where}
     ORDER BY r.started_at DESC, r.id DESC
     LIMIT ${limitPlaceholder} OFFSET ${offsetPlaceholder}`,
    pageParams
  );

  return { rentals: rows.map(normalize), total: countResult.rows[0].total };
}

/** A user's rental history, newest first (no pagination). */
async function listByUser(userId, filters = {}, db = pool) {
  const params = [];
  const where = buildFilters({ ...filters, userId }, params);
  const { rows } = await db.query(
    `${SELECT_DETAIL} ${where} ORDER BY r.started_at DESC, r.id DESC`,
    params
  );
  return rows.map(normalize);
}

/** All rentals (admin), optionally filtered by status, newest first. */
async function listAll({ status, limit } = {}, db = pool) {
  const params = [];
  const where = buildFilters({ status }, params);
  let sql = `${SELECT_DETAIL} ${where} ORDER BY r.started_at DESC, r.id DESC`;
  if (limit) {
    params.push(limit);
    sql += ` LIMIT $${params.length}`;
  }
  const { rows } = await db.query(sql, params);
  return rows.map(normalize);
}

async function countActive(db = pool) {
  const { rows } = await db.query(
    `SELECT COUNT(*)::int AS count FROM rentals WHERE status = 'ACTIVE'`
  );
  return rows[0].count;
}

/** Whether a bicycle currently has an ACTIVE rental. */
async function hasActiveRentalForBicycle(bicycleId, db = pool) {
  const { rows } = await db.query(
    `SELECT 1 FROM rentals WHERE bicycle_id = $1 AND status = 'ACTIVE' LIMIT 1`,
    [bicycleId]
  );
  return rows.length > 0;
}

/** The ACTIVE rental id for a bicycle, if any (used to tag location pings). */
async function findActiveIdForBicycle(bicycleId, db = pool) {
  const { rows } = await db.query(
    `SELECT id FROM rentals WHERE bicycle_id = $1 AND status = 'ACTIVE' LIMIT 1`,
    [bicycleId]
  );
  return rows[0] ? rows[0].id : null;
}

module.exports = {
  createActive,
  findActiveByUserForUpdate,
  findByIdForUpdate,
  complete,
  findDetailById,
  findActiveDetailByUser,
  listByUser,
  listPaged,
  listAll,
  countActive,
  hasActiveRentalForBicycle,
  findActiveIdForBicycle,
};
