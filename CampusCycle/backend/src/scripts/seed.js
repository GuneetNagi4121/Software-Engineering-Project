'use strict';

/**
 * Loads database/seed.sql into the configured database.
 * Usage:  npm run db:seed   (from backend/)
 */
const fs = require('fs');
const path = require('path');
const env = require('../config/env');
const { createPool } = require('../config/db');

// Schema changes and seeding use the direct (non-pooled) connection.
const pool = createPool(env.databaseUrlUnpooled);

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
