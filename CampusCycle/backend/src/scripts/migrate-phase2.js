'use strict';

/**
 * Applies only the files in database/migrations/ — the additive Phase 2
 * schema changes. Nothing is dropped or truncated, so existing users,
 * stations, bicycles and rentals are preserved. Safe to run repeatedly.
 *
 * Usage:  npm run db:migrate:phase2   (from backend/)
 */
const fs = require('fs');
const path = require('path');
const { pool } = require('../config/db');

const MIGRATIONS_DIR = path.join(__dirname, '..', '..', '..', 'database', 'migrations');

async function run() {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    console.log('No migrations directory found at', MIGRATIONS_DIR);
    return;
  }
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  if (files.length === 0) {
    console.log('No migrations to apply.');
    return;
  }

  for (const name of files) {
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, name), 'utf8');
    await pool.query(sql);
    console.log('✔ Applied migration', name);
  }
}

run()
  .catch((err) => {
    console.error('✖ Migration failed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
