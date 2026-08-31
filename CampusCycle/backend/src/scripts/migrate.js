'use strict';

/**
 * Applies database/schema.sql to the configured database.
 * Usage:  npm run db:migrate   (from backend/)
 */
const fs = require('fs');
const path = require('path');
const { pool } = require('../config/db');

const SCHEMA_PATH = path.join(__dirname, '..', '..', '..', 'database', 'schema.sql');

async function run() {
  const sql = fs.readFileSync(SCHEMA_PATH, 'utf8');
  await pool.query(sql);
  console.log('✔ Schema applied from', path.relative(process.cwd(), SCHEMA_PATH));
}

run()
  .catch((err) => {
    console.error('✖ Schema migration failed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
