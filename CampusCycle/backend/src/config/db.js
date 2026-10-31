'use strict';

const { Pool } = require('pg');
const env = require('./env');

/**
 * Build a pool from a connection string, or from the individual DB_* parts
 * when no string is given.
 */
function createPool(connectionString) {
  return connectionString
    ? new Pool({ connectionString })
    : new Pool({
        host: env.db.host,
        port: env.db.port,
        database: env.db.name,
        user: env.db.user,
        password: env.db.password,
      });
}

/**
 * A single shared connection pool for the whole app.
 * Uses DATABASE_URL (Neon's pooled endpoint) when provided.
 */
const pool = createPool(env.databaseUrl);

pool.on('error', (err) => {
  // A pooled client experienced a fatal error while idle.
  console.error('Unexpected PostgreSQL pool error:', err.message);
});

/**
 * Convenience query helper. Accepts (text, params).
 */
function query(text, params) {
  return pool.query(text, params);
}

/**
 * Run `fn(client)` inside a single transaction.
 * Commits on success, rolls back on any thrown error, always releases.
 *
 * @param {(client: import('pg').PoolClient) => Promise<T>} fn
 * @returns {Promise<T>}
 * @template T
 */
async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {
      console.error('Rollback failed:', rollbackErr.message);
    }
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, createPool, query, withTransaction };
