'use strict';

/**
 * Loads database/seed.sql into the configured database.
 * Usage:  npm run db:seed   (from backend/)
 */
const fs = require('fs');
const path = require('path');
const { pool } = require('../config/db');

const SEED_PATH = path.join(__dirname, '..', '..', '..', 'database', 'seed.sql');

async function run() {
  const sql = fs.readFileSync(SEED_PATH, 'utf8');
  await pool.query(sql);
  console.log('✔ Seed data loaded from', path.relative(process.cwd(), SEED_PATH));
}

run()
  .catch((err) => {
    console.error('✖ Seeding failed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
