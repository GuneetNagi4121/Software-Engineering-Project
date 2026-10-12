'use strict';

/**
 * Loads database/seed-phase2.sql — station coordinates, the campus geofence
 * boundary and (only on an empty table) demo maintenance reports.
 * Non-destructive and idempotent.
 *
 * Usage:  npm run db:seed:phase2   (from backend/)
 */
const fs = require('fs');
const path = require('path');
const { pool } = require('../config/db');

const SEED_PATH = path.join(__dirname, '..', '..', '..', 'database', 'seed-phase2.sql');

async function run() {
  const sql = fs.readFileSync(SEED_PATH, 'utf8');
  const result = await pool.query(sql);
  const summary = Array.isArray(result) ? result[result.length - 1] : result;
  if (summary && summary.rows && summary.rows[0]) {
    console.log('  ', JSON.stringify(summary.rows[0]));
  }
  console.log('✔ Phase 2 seed applied from', path.relative(process.cwd(), SEED_PATH));
}

run()
  .catch((err) => {
    console.error('✖ Phase 2 seeding failed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
