'use strict';

/**
 * Applies the base schema (database/schema.sql) and then every migration in
 * database/migrations/ in filename order.
 *
 * NOTE: schema.sql is destructive — it drops and recreates the tables. Use
 * this only to (re)build a development database from scratch.
 *
 * To apply the migrations WITHOUT touching existing data, use:
 *   npm run db:migrate:phase2
 *
 * Usage:  npm run db:migrate   (from backend/)
 */
const fs = require('fs');
const path = require('path');
const { pool } = require('../config/db');

const DB_DIR = path.join(__dirname, '..', '..', '..', 'database');
const SCHEMA_PATH = path.join(DB_DIR, 'schema.sql');
const MIGRATIONS_DIR = path.join(DB_DIR, 'migrations');

function migrationFiles() {
  if (!fs.existsSync(MIGRATIONS_DIR)) return [];
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => path.join(MIGRATIONS_DIR, f));
}

async function applyFile(file) {
  const sql = fs.readFileSync(file, 'utf8');
  await pool.query(sql);
  console.log('✔ Applied', path.relative(process.cwd(), file));
}

async function run() {
  await applyFile(SCHEMA_PATH);
  for (const file of migrationFiles()) {
    await applyFile(file);
  }
}

run()
  .catch((err) => {
    console.error('✖ Schema migration failed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
