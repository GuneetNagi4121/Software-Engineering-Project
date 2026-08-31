'use strict';

const { pool } = require('../config/db');

/**
 * Data access for the `rentals` table.
 * Detailed read queries join student name, bicycle code and station names.
 */

const SELECT_DETAIL = `
  SELECT r.id, r.user_id, r.bicycle_id,
         r.start_station_id, r.end_station_id,
         r.started_at, r.ended_at, r.status,
         r.created_at, r.updated_at,
         u.name  AS user_name,
         b.cycle_code AS bicycle_code,
         b.qr_code    AS bicycle_qr,
         ss.name AS start_station_name,
         es.name AS end_station_name
  FROM rentals r
  JOIN users u        ON u.id = r.user_id
  JOIN bicycles b     ON b.id = r.bicycle_id
  LEFT JOIN stations ss ON ss.id = r.start_station_id
  LEFT JOIN stations es ON es.id = r.end_station_id`;

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
  return rows[0] || null;
}

/** The active rental (with details) for a user, or null. */
async function findActiveDetailByUser(userId, db = pool) {
  const { rows } = await db.query(
    `${SELECT_DETAIL} WHERE r.user_id = $1 AND r.status = 'ACTIVE' LIMIT 1`,
    [userId]
  );
  return rows[0] || null;
}

/** A user's rental history, newest first. */
async function listByUser(userId, db = pool) {
  const { rows } = await db.query(
    `${SELECT_DETAIL} WHERE r.user_id = $1 ORDER BY r.started_at DESC`,
    [userId]
  );
  return rows;
}

/** All rentals (admin), optionally filtered by status, newest first. */
async function listAll({ status, limit } = {}, db = pool) {
  const params = [];
  let where = '';
  if (status) {
    params.push(status);
    where = `WHERE r.status = $${params.length}`;
  }
  let sql = `${SELECT_DETAIL} ${where} ORDER BY r.started_at DESC`;
  if (limit) {
    params.push(limit);
    sql += ` LIMIT $${params.length}`;
  }
  const { rows } = await db.query(sql, params);
  return rows;
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

module.exports = {
  createActive,
  findActiveByUserForUpdate,
  findByIdForUpdate,
  complete,
  findDetailById,
  findActiveDetailByUser,
  listByUser,
  listAll,
  countActive,
  hasActiveRentalForBicycle,
};
