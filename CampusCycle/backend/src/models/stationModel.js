'use strict';

const { pool } = require('../config/db');

/**
 * Data access for the `stations` table.
 */

async function listWithCounts(db = pool) {
  const { rows } = await db.query(
    `SELECT s.id, s.name, s.location, s.capacity, s.status,
            s.created_at, s.updated_at,
            COUNT(b.id) FILTER (WHERE b.status = 'AVAILABLE')::int AS available_count,
            COUNT(b.id)::int AS bikes_at_station
     FROM stations s
     LEFT JOIN bicycles b ON b.station_id = s.id
     GROUP BY s.id
     ORDER BY s.name`
  );
  return rows;
}

async function findById(id, db = pool) {
  const { rows } = await db.query(
    `SELECT id, name, location, capacity, status, created_at, updated_at
     FROM stations WHERE id = $1`,
    [id]
  );
  return rows[0] || null;
}

async function findByIdWithCounts(id, db = pool) {
  const { rows } = await db.query(
    `SELECT s.id, s.name, s.location, s.capacity, s.status,
            s.created_at, s.updated_at,
            COUNT(b.id) FILTER (WHERE b.status = 'AVAILABLE')::int AS available_count,
            COUNT(b.id)::int AS bikes_at_station
     FROM stations s
     LEFT JOIN bicycles b ON b.station_id = s.id
     WHERE s.id = $1
     GROUP BY s.id`,
    [id]
  );
  return rows[0] || null;
}

async function create({ name, location, capacity, status }, db = pool) {
  const { rows } = await db.query(
    `INSERT INTO stations (name, location, capacity, status)
     VALUES ($1, $2, $3, $4)
     RETURNING id, name, location, capacity, status, created_at, updated_at`,
    [name, location, capacity, status]
  );
  return rows[0];
}

async function update(id, { name, location, capacity, status }, db = pool) {
  const { rows } = await db.query(
    `UPDATE stations
     SET name = $2, location = $3, capacity = $4, status = $5
     WHERE id = $1
     RETURNING id, name, location, capacity, status, created_at, updated_at`,
    [id, name, location, capacity, status]
  );
  return rows[0] || null;
}

/** Number of bicycles physically assigned to this station. */
async function countBicycles(id, db = pool) {
  const { rows } = await db.query(
    'SELECT COUNT(*)::int AS count FROM bicycles WHERE station_id = $1',
    [id]
  );
  return rows[0].count;
}

/** Number of ACTIVE rentals that reference this station as start or end. */
async function countActiveRentalsReferencing(id, db = pool) {
  const { rows } = await db.query(
    `SELECT COUNT(*)::int AS count FROM rentals
     WHERE status = 'ACTIVE' AND (start_station_id = $1 OR end_station_id = $1)`,
    [id]
  );
  return rows[0].count;
}

async function remove(id, db = pool) {
  const { rowCount } = await db.query('DELETE FROM stations WHERE id = $1', [id]);
  return rowCount > 0;
}

module.exports = {
  listWithCounts,
  findById,
  findByIdWithCounts,
  create,
  update,
  countBicycles,
  countActiveRentalsReferencing,
  remove,
};
