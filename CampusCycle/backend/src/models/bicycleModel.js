'use strict';

const { pool } = require('../config/db');

/**
 * Data access for the `bicycles` table.
 * Read queries join the station name for convenient display.
 */

const SELECT_WITH_STATION = `
  SELECT b.id, b.cycle_code, b.qr_code, b.station_id, b.status,
         b.created_at, b.updated_at,
         s.name AS station_name
  FROM bicycles b
  LEFT JOIN stations s ON s.id = b.station_id`;

/**
 * List bicycles with optional filters.
 * @param {{ status?: string, stationId?: number, search?: string }} filters
 */
async function list({ status, stationId, search } = {}, db = pool) {
  const conditions = [];
  const params = [];

  if (status) {
    params.push(status);
    conditions.push(`b.status = $${params.length}`);
  }
  if (stationId) {
    params.push(stationId);
    conditions.push(`b.station_id = $${params.length}`);
  }
  if (search) {
    params.push(`%${search}%`);
    conditions.push(`(b.cycle_code ILIKE $${params.length} OR b.qr_code ILIKE $${params.length})`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows } = await db.query(
    `${SELECT_WITH_STATION} ${where} ORDER BY b.cycle_code`,
    params
  );
  return rows;
}

async function findById(id, db = pool) {
  const { rows } = await db.query(`${SELECT_WITH_STATION} WHERE b.id = $1`, [id]);
  return rows[0] || null;
}

/**
 * Lock a bicycle row by QR code for a rental transaction.
 * Returns the raw row (no join) or null.
 */
async function findByQrForUpdate(qrCode, db) {
  const { rows } = await db.query(
    `SELECT id, cycle_code, qr_code, station_id, status
     FROM bicycles WHERE qr_code = $1 FOR UPDATE`,
    [qrCode]
  );
  return rows[0] || null;
}

/** Lock a bicycle row by id for a transaction. */
async function findByIdForUpdate(id, db) {
  const { rows } = await db.query(
    `SELECT id, cycle_code, qr_code, station_id, status
     FROM bicycles WHERE id = $1 FOR UPDATE`,
    [id]
  );
  return rows[0] || null;
}

async function create({ cycleCode, qrCode, stationId, status }, db = pool) {
  const { rows } = await db.query(
    `INSERT INTO bicycles (cycle_code, qr_code, station_id, status)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [cycleCode, qrCode, stationId, status]
  );
  return findById(rows[0].id, db);
}

async function update(id, { cycleCode, qrCode, stationId, status }, db = pool) {
  const { rowCount } = await db.query(
    `UPDATE bicycles
     SET cycle_code = $2, qr_code = $3, station_id = $4, status = $5
     WHERE id = $1`,
    [id, cycleCode, qrCode, stationId, status]
  );
  if (rowCount === 0) return null;
  return findById(id, db);
}

/** Update status (and optionally the station) of a bicycle. */
async function setStatusAndStation(id, status, stationId, db = pool) {
  const { rowCount } = await db.query(
    `UPDATE bicycles SET status = $2, station_id = $3 WHERE id = $1`,
    [id, status, stationId]
  );
  if (rowCount === 0) return null;
  return findById(id, db);
}

async function remove(id, db = pool) {
  const { rowCount } = await db.query('DELETE FROM bicycles WHERE id = $1', [id]);
  return rowCount > 0;
}

async function existsCycleCode(cycleCode, exceptId = null, db = pool) {
  const params = [cycleCode];
  let sql = 'SELECT 1 FROM bicycles WHERE cycle_code = $1';
  if (exceptId) {
    params.push(exceptId);
    sql += ' AND id <> $2';
  }
  const { rows } = await db.query(sql, params);
  return rows.length > 0;
}

async function existsQrCode(qrCode, exceptId = null, db = pool) {
  const params = [qrCode];
  let sql = 'SELECT 1 FROM bicycles WHERE qr_code = $1';
  if (exceptId) {
    params.push(exceptId);
    sql += ' AND id <> $2';
  }
  const { rows } = await db.query(sql, params);
  return rows.length > 0;
}

/** Counts of bicycles grouped by status, always including every status key. */
async function countByStatus(db = pool) {
  const { rows } = await db.query(
    `SELECT status, COUNT(*)::int AS count FROM bicycles GROUP BY status`
  );
  const counts = { AVAILABLE: 0, RESERVED: 0, IN_USE: 0, MAINTENANCE: 0 };
  for (const r of rows) counts[r.status] = r.count;
  counts.TOTAL = Object.values(counts).reduce((a, b) => a + b, 0);
  return counts;
}

module.exports = {
  list,
  findById,
  findByQrForUpdate,
  findByIdForUpdate,
  create,
  update,
  setStatusAndStation,
  remove,
  existsCycleCode,
  existsQrCode,
  countByStatus,
};
