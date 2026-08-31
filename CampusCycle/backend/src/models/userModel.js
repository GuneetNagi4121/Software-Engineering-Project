'use strict';

const { pool } = require('../config/db');

/**
 * Data access for the `users` table.
 * Every function accepts an optional `db` (a pool or a transaction client).
 */

const PUBLIC_COLUMNS = 'id, name, email, role, created_at, updated_at';

async function create({ name, email, passwordHash, role }, db = pool) {
  const { rows } = await db.query(
    `INSERT INTO users (name, email, password_hash, role)
     VALUES ($1, $2, $3, $4)
     RETURNING ${PUBLIC_COLUMNS}`,
    [name, email, passwordHash, role]
  );
  return rows[0];
}

async function findByEmail(email, db = pool) {
  const { rows } = await db.query(
    `SELECT id, name, email, password_hash, role, created_at, updated_at
     FROM users WHERE email = $1`,
    [email]
  );
  return rows[0] || null;
}

async function findById(id, db = pool) {
  const { rows } = await db.query(
    `SELECT ${PUBLIC_COLUMNS} FROM users WHERE id = $1`,
    [id]
  );
  return rows[0] || null;
}

async function emailExists(email, db = pool) {
  const { rows } = await db.query('SELECT 1 FROM users WHERE email = $1', [email]);
  return rows.length > 0;
}

async function listAll(db = pool) {
  const { rows } = await db.query(
    `SELECT ${PUBLIC_COLUMNS} FROM users ORDER BY created_at DESC`
  );
  return rows;
}

async function updateProfile(id, { name }, db = pool) {
  const { rows } = await db.query(
    `UPDATE users SET name = $2 WHERE id = $1 RETURNING ${PUBLIC_COLUMNS}`,
    [id, name]
  );
  return rows[0] || null;
}

module.exports = {
  create,
  findByEmail,
  findById,
  emailExists,
  listAll,
  updateProfile,
};
