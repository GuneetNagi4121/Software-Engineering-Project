'use strict';

/**
 * Self-contained end-to-end test for CampusCycle Phase 1.
 *
 * It resets the database from database/schema.sql + database/seed.sql, boots the
 * Express app on an ephemeral port, and exercises the required scenarios over
 * real HTTP against the live PostgreSQL database:
 *
 *   A. Student logs in, views stations, rents a bike (QR), sees the active ride,
 *      returns it, and the bike/rental transition correctly.
 *   B. Role-based access control (student blocked from admin APIs; no-token 401).
 *   C. Renting an unavailable / unknown bicycle is rejected.
 *   D. Two students racing for the same bicycle -> exactly one succeeds.
 *   E. Admin dashboard figures reflect the data.
 *
 * Usage:  npm run test:e2e   (from backend/, with a reachable database)
 */

process.env.NODE_ENV = 'test';

const fs = require('fs');
const path = require('path');
const app = require('../app');
const { pool } = require('../config/db');

const DB_DIR = path.join(__dirname, '..', '..', '..', 'database');

let passed = 0;
let failed = 0;
let base = '';

function check(condition, message) {
  if (condition) {
    passed += 1;
    console.log('  ✔', message);
  } else {
    failed += 1;
    console.error('  ✖', message);
  }
}

async function api(method, endpoint, { token, body } = {}) {
  const res = await fetch(base + endpoint, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* no JSON body */
  }
  return { status: res.status, data };
}

async function login(email, password) {
  const { data } = await api('POST', '/api/auth/login', { body: { email, password } });
  return data && data.token;
}

async function resetDatabase() {
  const schema = fs.readFileSync(path.join(DB_DIR, 'schema.sql'), 'utf8');
  const seed = fs.readFileSync(path.join(DB_DIR, 'seed.sql'), 'utf8');
  await pool.query(schema);
  await pool.query(seed);
}

async function main() {
  console.log('Resetting database (schema + seed)...');
  await resetDatabase();

  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
  console.log('Test server listening on', base);

  try {
    // ---- Scenario A: full rent + return flow ----------------------------
    console.log('\nScenario A — student rents and returns a bicycle');
    const aditi = await login('aditi@campuscycle.edu', 'Student@123');
    check(!!aditi, 'student can log in and receives a token');

    const stations = (await api('GET', '/api/stations', { token: aditi })).data.stations;
    check(Array.isArray(stations) && stations.length >= 6, 'student can view all stations');
    const returnStation = stations.find((s) => s.status === 'ACTIVE');

    const available = (await api('GET', '/api/bicycles?status=AVAILABLE', { token: aditi })).data.bicycles;
    check(available.length > 0, 'available bicycles are listed');
    const bike = available[0];

    const start = await api('POST', '/api/rentals', { token: aditi, body: { qr_code: bike.qr_code } });
    check(start.status === 201, 'rental starts (HTTP 201)');
    check(start.data.rental && start.data.rental.status === 'ACTIVE', 'rental status is ACTIVE');
    const rentalId = start.data.rental.id;

    const bikeInUse = (await api('GET', `/api/bicycles/${bike.id}`, { token: aditi })).data.bicycle;
    check(bikeInUse.status === 'IN_USE', 'bicycle becomes IN_USE');

    const activeRide = (await api('GET', '/api/rentals/active', { token: aditi })).data.rental;
    check(activeRide && activeRide.id === rentalId, 'student sees the active ride');
    check(!!activeRide.started_at, 'active ride carries a server-side start timestamp');

    const ret = await api('POST', `/api/rentals/${rentalId}/return`, {
      token: aditi,
      body: { end_station_id: returnStation.id },
    });
    check(ret.status === 200, 'return succeeds (HTTP 200)');
    check(ret.data.rental.status === 'COMPLETED', 'rental becomes COMPLETED');
    check(ret.data.rental.end_station_id === returnStation.id, 'end station is recorded');
    check(!!ret.data.rental.ended_at, 'end timestamp is recorded');

    const bikeBack = (await api('GET', `/api/bicycles/${bike.id}`, { token: aditi })).data.bicycle;
    check(bikeBack.status === 'AVAILABLE', 'bicycle becomes AVAILABLE');
    check(bikeBack.station_id === returnStation.id, 'bicycle is assigned to the return station');

    // ---- Scenario B: RBAC ----------------------------------------------
    console.log('\nScenario B — role-based access control');
    check((await api('GET', '/api/admin/overview', { token: aditi })).status === 403,
      'student GET /api/admin/overview -> 403');
    check((await api('POST', '/api/bicycles', { token: aditi, body: { cycle_code: 'X', qr_code: 'X' } })).status === 403,
      'student POST /api/bicycles -> 403');
    check((await api('GET', '/api/bicycles')).status === 401, 'no token -> 401');

    // ---- Scenario C: unavailable bike ----------------------------------
    console.log('\nScenario C — renting an unavailable bicycle is rejected');
    check((await api('POST', '/api/rentals', { token: aditi, body: { qr_code: 'CYCLE-TC-010' } })).status === 409,
      'renting a MAINTENANCE bike -> 409');
    check((await api('POST', '/api/rentals', { token: aditi, body: { qr_code: 'DOES-NOT-EXIST' } })).status === 404,
      'renting an unknown QR -> 404');

    // ---- Scenario D: concurrency ---------------------------------------
    console.log('\nScenario D — two students race for the same bicycle');
    const sneha = await login('sneha@campuscycle.edu', 'Student@123');
    const freshAvailable = (await api('GET', '/api/bicycles?status=AVAILABLE', { token: aditi })).data.bicycles;
    const target = freshAvailable[0];
    const [r1, r2] = await Promise.all([
      api('POST', '/api/rentals', { token: aditi, body: { qr_code: target.qr_code } }),
      api('POST', '/api/rentals', { token: sneha, body: { qr_code: target.qr_code } }),
    ]);
    const successes = [r1, r2].filter((r) => r.status === 201).length;
    const rejections = [r1, r2].filter((r) => r.status === 409 || r.status === 404).length;
    check(successes === 1, `exactly one rental succeeds (got ${successes})`);
    check(rejections === 1, `the other student is rejected (got ${rejections})`);

    // Cleanup: end any rides opened by the test so the seed state is restored.
    for (const token of [aditi, sneha]) {
      const active = (await api('GET', '/api/rentals/active', { token })).data.rental;
      if (active) {
        await api('POST', `/api/rentals/${active.id}/return`, {
          token,
          body: { end_station_id: returnStation.id },
        });
      }
    }

    // ---- Scenario E: admin dashboard -----------------------------------
    console.log('\nScenario E — admin dashboard reflects data');
    const admin = await login('admin@campuscycle.edu', 'Admin@123');
    const overview = (await api('GET', '/api/admin/overview', { token: admin })).data;
    check(overview.bicycles.TOTAL === 20, 'overview reports 20 total bicycles');
    check(overview.stations.total === 6, 'overview reports 6 stations');
    check(overview.activeRentals === 2, 'overview reports the 2 seeded active rentals after cleanup');
    check((await api('GET', '/api/bicycles', { token: admin })).data.bicycles.length === 20,
      'admin can list all 20 bicycles');
  } finally {
    server.close();
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  await pool.end();
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('Test harness error:', err);
  process.exit(1);
});
