'use strict';

/**
 * Self-contained end-to-end test for CampusCycle Phase 2.
 *
 * It rebuilds the database from database/schema.sql + database/migrations/ +
 * database/seed.sql + database/seed-phase2.sql, boots the Express app on an
 * ephemeral port, and exercises the Phase 2 modules over real HTTP against
 * the live PostgreSQL database:
 *
 *   F. Station coordinates, availability rules and the campus map endpoint.
 *   G. Station availability filters and sorting.
 *   H. Ride history: own-rides-only, ride detail, duration, filters,
 *      admin filters and pagination.
 *   I. Maintenance: reporting, safety hold, status lifecycle, invalid
 *      transitions, and the guarantee that an unsafe bicycle cannot be
 *      rented or returned to service.
 *   J. Analytics: database-driven figures, date filtering, admin-only.
 *   K. Geofencing: inside/outside detection, de-duplication, acknowledge and
 *      resolve, simulated-source labelling, student lockout.
 *   L. Phase 2 role-based access control.
 *
 * Usage:  npm run test:e2e:phase2   (from backend/, with a reachable database)
 */

process.env.NODE_ENV = 'test';

const fs = require('fs');
const path = require('path');
const app = require('../app');
const { pool } = require('../config/db');

const DB_DIR = path.join(__dirname, '..', '..', '..', 'database');
const MIGRATIONS_DIR = path.join(DB_DIR, 'migrations');

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
  const read = (p) => fs.readFileSync(p, 'utf8');
  await pool.query(read(path.join(DB_DIR, 'schema.sql')));
  for (const name of fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort()) {
    await pool.query(read(path.join(MIGRATIONS_DIR, name)));
  }
  await pool.query(read(path.join(DB_DIR, 'seed.sql')));
  await pool.query(read(path.join(DB_DIR, 'seed-phase2.sql')));
}

// Points used by the geofencing scenario. "Inside" is the campus centre from
// the seed boundary; "outside" is well beyond it.
const INSIDE = { latitude: 30.3564, longitude: 76.3625 };
const OUTSIDE = { latitude: 30.4000, longitude: 76.4200 };
const OUTSIDE_2 = { latitude: 30.4100, longitude: 76.4300 };

async function main() {
  console.log('Resetting database (schema + migrations + seeds)...');
  await resetDatabase();

  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
  console.log('Test server listening on', base);

  try {
    const admin = await login('admin@campuscycle.edu', 'Admin@123');
    const guneet = await login('guneet@campuscycle.edu', 'Student@123');
    const aditi = await login('aditi@campuscycle.edu', 'Student@123');
    const rahul = await login('rahul@campuscycle.edu', 'Student@123');
    check(!!admin && !!guneet && !!aditi, 'admin and students can log in');

    // ---- Scenario F: map + coordinates -------------------------------------
    console.log('\nScenario F — campus map and station coordinates');
    const stationsRes = await api('GET', '/api/stations', { token: aditi });
    const stations = stationsRes.data.stations;
    check(stations.length === 6, 'six stations are returned');
    check(
      stations.every((s) => typeof s.latitude === 'number' && typeof s.longitude === 'number'),
      'every seeded station has numeric coordinates'
    );
    check(
      stations.every(
        (s) => s.latitude >= -90 && s.latitude <= 90 && s.longitude >= -180 && s.longitude <= 180
      ),
      'all coordinates are within valid latitude/longitude ranges'
    );
    check(
      stations.every((s) => typeof s.availability_pct === 'number' && s.availability_level),
      'stations carry derived availability_pct and availability_level'
    );

    const lib = stations.find((s) => s.name === 'Library');
    const dbLib = (
      await pool.query(
        `SELECT s.capacity,
                COUNT(b.id) FILTER (WHERE b.status = 'AVAILABLE')::int AS avail
         FROM stations s LEFT JOIN bicycles b ON b.station_id = s.id
         WHERE s.name = 'Library' GROUP BY s.id`
      )
    ).rows[0];
    check(
      lib.available_count === dbLib.avail && lib.capacity === dbLib.capacity,
      `availability matches the database (${lib.available_count}/${lib.capacity})`
    );
    check(
      lib.availability_pct === Math.round((dbLib.avail / dbLib.capacity) * 100),
      'availability percentage is computed from database values'
    );

    const mapRes = await api('GET', '/api/stations/map', { token: aditi });
    check(mapRes.status === 200, 'GET /api/stations/map -> 200 for a student');
    check(mapRes.data.stations.length === 6, 'map returns all mapped stations');
    check(mapRes.data.unmapped_stations.length === 0, 'no unmapped stations on seeded data');
    check(!!mapRes.data.geofence, 'map includes the active campus boundary');
    check(
      Array.isArray(mapRes.data.geofence.polygon) && mapRes.data.geofence.polygon.length >= 3,
      'boundary polygon has at least three vertices'
    );
    const mapLib = mapRes.data.stations.find((s) => s.name === 'Library');
    check(
      mapLib.available_count === lib.available_count &&
        mapLib.availability_level === lib.availability_level,
      'map and station list report identical availability'
    );

    // An inactive station must be represented, not hidden.
    const sports = stations.find((s) => s.name === 'Sports Complex');
    await api('PATCH', `/api/stations/${sports.id}/status`, {
      token: admin,
      body: { status: 'INACTIVE' },
    });
    const afterDeactivate = (await api('GET', '/api/stations', { token: aditi })).data.stations.find(
      (s) => s.id === sports.id
    );
    check(
      afterDeactivate.status === 'INACTIVE' && afterDeactivate.availability_level === 'INACTIVE',
      'an inactive station is returned with availability_level INACTIVE'
    );
    const mapAfter = (await api('GET', '/api/stations/map', { token: aditi })).data;
    check(
      mapAfter.stations.some((s) => s.id === sports.id && s.availability_level === 'INACTIVE'),
      'the inactive station still appears on the map, marked inactive'
    );
    await api('PATCH', `/api/stations/${sports.id}/status`, {
      token: admin,
      body: { status: 'ACTIVE' },
    });

    // Coordinate validation on write.
    const badCoord = await api('PUT', `/api/stations/${lib.id}`, {
      token: admin,
      body: { latitude: 95, longitude: 76.36 },
    });
    check(badCoord.status === 422, 'latitude 95 is rejected (422)');
    const halfCoord = await api('PUT', `/api/stations/${lib.id}`, {
      token: admin,
      body: { latitude: 30.1, longitude: '' },
    });
    check(halfCoord.status === 422, 'a latitude without a longitude is rejected (422)');
    const goodCoord = await api('PUT', `/api/stations/${lib.id}`, {
      token: admin,
      body: { latitude: 30.3568, longitude: 76.3628 },
    });
    check(goodCoord.status === 200, 'valid coordinates are accepted');

    // ---- Scenario G: availability filters ----------------------------------
    console.log('\nScenario G — station availability filters and sorting');
    const low = (await api('GET', '/api/stations?availability=LOW', { token: aditi })).data.stations;
    check(
      low.every((s) => s.availability_level === 'LOW'),
      'availability=LOW returns only LOW stations'
    );
    const none = (await api('GET', '/api/stations?availability=NONE', { token: aditi })).data
      .stations;
    check(
      none.every((s) => s.available_count === 0),
      'availability=NONE returns only stations with zero available cycles'
    );
    const sorted = (await api('GET', '/api/stations?sort=availability_desc', { token: aditi })).data
      .stations;
    const counts = sorted.map((s) => s.available_count);
    check(
      counts.every((c, i) => i === 0 || counts[i - 1] >= c),
      'sort=availability_desc orders stations by available cycles'
    );
    check(
      (await api('GET', '/api/stations?availability=NOPE', { token: aditi })).status === 400,
      'an unknown availability filter -> 400'
    );

    // ---- Scenario H: ride history ------------------------------------------
    console.log('\nScenario H — ride history and ride details');
    const mine = (await api('GET', '/api/rentals/me', { token: guneet })).data.rentals;
    check(mine.length > 0, "a student sees their own rides");
    check(
      mine.every((r) => r.user_name === 'Guneet Nagi'),
      'the history contains only the signed-in student\'s rides'
    );
    const activeRide = mine.find((r) => r.status === 'ACTIVE');
    check(
      activeRide && activeRide.duration_seconds > 0,
      'an active ride has a live duration computed from started_at'
    );
    check(
      Math.abs(activeRide.duration_seconds - 45 * 60) < 120,
      `the seeded 45-minute active ride reports ~2700s (got ${activeRide && activeRide.duration_seconds}s)`
    );

    const rahulRides = (await api('GET', '/api/rentals/me', { token: rahul })).data.rentals;
    const completed = rahulRides.find((r) => r.status === 'COMPLETED');
    check(
      completed && completed.duration_seconds === 38 * 60,
      `the seeded 38-minute completed ride reports exactly 2280s (got ${completed && completed.duration_seconds}s)`
    );

    const detail = await api('GET', `/api/rentals/${activeRide.id}`, { token: guneet });
    check(detail.status === 200, 'a student can open their own ride detail');
    check(
      detail.data.rental.start_station_name === 'Library',
      'ride detail includes the start station name'
    );
    const foreign = await api('GET', `/api/rentals/${completed.id}`, { token: guneet });
    check(foreign.status === 403, "opening another student's ride -> 403");
    check(
      (await api('GET', '/api/rentals/999999', { token: guneet })).status === 404,
      'an unknown ride id -> 404'
    );
    check(
      (await api('GET', '/api/rentals/abc', { token: guneet })).status === 400,
      'a non-numeric ride id -> 400'
    );
    check(
      (await api('GET', `/api/rentals/${completed.id}`, { token: admin })).status === 200,
      'an admin can open any ride'
    );

    const filteredMine = (await api('GET', '/api/rentals/me?status=COMPLETED', { token: rahul }))
      .data.rentals;
    check(
      filteredMine.length > 0 && filteredMine.every((r) => r.status === 'COMPLETED'),
      'student history filters by status'
    );
    check(
      (await api('GET', '/api/rentals/me?status=NOPE', { token: rahul })).status === 400,
      'an invalid status filter -> 400'
    );

    const adminPage = await api('GET', '/api/rentals?limit=2', { token: admin });
    check(adminPage.status === 200, 'admin ride history -> 200');
    check(adminPage.data.rentals.length <= 2, 'admin history respects ?limit');
    check(
      adminPage.data.pagination && adminPage.data.pagination.total >= 3,
      'admin history reports a total count for pagination'
    );
    const page2 = await api('GET', '/api/rentals?limit=2&page=2', { token: admin });
    check(
      page2.data.rentals.length > 0 &&
        page2.data.rentals[0].id !== adminPage.data.rentals[0].id,
      'page 2 returns a different slice'
    );
    const byStation = await api('GET', `/api/rentals?station_id=${lib.id}`, { token: admin });
    check(
      byStation.data.rentals.every(
        (r) => r.start_station_id === lib.id || r.end_station_id === lib.id
      ),
      'admin history filters by station'
    );
    const future = await api('GET', '/api/rentals?from=2099-01-01', { token: admin });
    check(future.data.rentals.length === 0, 'a future date range returns no rides');

    // ---- Scenario I: maintenance -------------------------------------------
    console.log('\nScenario I — maintenance reporting and the safety workflow');
    const available = (await api('GET', '/api/bicycles?status=AVAILABLE', { token: aditi })).data
      .bicycles;
    const minorBike = available[0];
    const unsafeBike = available[1];

    const minor = await api('POST', '/api/maintenance', {
      token: aditi,
      body: { bicycle_id: minorBike.id, category: 'LIGHT', description: 'Front light flickers.', severity: 'LOW' },
    });
    check(minor.status === 201, 'a student can submit a low-severity report (201)');
    check(minor.data.report.status === 'OPEN', 'a new report starts OPEN');
    check(minor.data.safety_hold === false, 'a LOW report does not place a safety hold');
    check(
      minor.data.bicycle.status === 'AVAILABLE',
      'a LOW report leaves the bicycle in service'
    );

    const serious = await api('POST', '/api/maintenance', {
      token: aditi,
      body: {
        bicycle_id: unsafeBike.id,
        category: 'BRAKES',
        description: 'Brakes do not engage at all.',
        severity: 'CRITICAL',
      },
    });
    check(serious.status === 201, 'a CRITICAL report is accepted (201)');
    check(serious.data.safety_hold === true, 'a CRITICAL report places a safety hold');
    check(
      serious.data.bicycle.status === 'MAINTENANCE',
      'a parked bicycle with a CRITICAL report is pulled out of service immediately'
    );

    const rentUnsafe = await api('POST', '/api/rentals', {
      token: guneet,
      body: { qr_code: unsafeBike.qr_code },
    });
    check(rentUnsafe.status === 409, 'renting the unsafe bicycle -> 409');

    const forceAvailable = await api('PATCH', `/api/bicycles/${unsafeBike.id}/status`, {
      token: admin,
      body: { status: 'AVAILABLE', station_id: minorBike.station_id },
    });
    check(
      forceAvailable.status === 409,
      'an admin cannot return a bicycle with an open safety issue to service -> 409'
    );

    const stored = (await api('GET', `/api/maintenance/${serious.data.report.id}`, { token: aditi }))
      .data.report;
    check(
      stored.description === 'Brakes do not engage at all.' &&
        stored.severity === 'CRITICAL' &&
        stored.category === 'BRAKES',
      'the report is stored exactly as submitted'
    );
    check(
      (await api('GET', `/api/maintenance/${serious.data.report.id}`, { token: rahul })).status ===
        403,
      "a student cannot read another student's report -> 403"
    );

    const myReports = (await api('GET', '/api/maintenance/me', { token: aditi })).data.reports;
    // Aditi has the two reports filed above plus one from the Phase 2 seed.
    check(myReports.length === 3, 'a student sees the reports they submitted');
    check(
      myReports.every((r) => r.reported_by_email === 'aditi@campuscycle.edu'),
      'the student report list contains only their own reports'
    );

    const badReport = await api('POST', '/api/maintenance', {
      token: aditi,
      body: { bicycle_id: minorBike.id, category: 'SPACESHIP', description: '' },
    });
    check(badReport.status === 422, 'an invalid category and empty description -> 422');
    check(
      badReport.data.details && badReport.data.details.category && badReport.data.details.description,
      'validation errors are returned per field'
    );
    check(
      (await api('POST', '/api/maintenance', {
        token: aditi,
        body: { bicycle_id: 999999, category: 'CHAIN', description: 'x' },
      })).status === 422,
      'reporting against an unknown bicycle -> 422'
    );

    // Lifecycle
    const reportId = serious.data.report.id;
    const toProgress = await api('PATCH', `/api/maintenance/${reportId}/status`, {
      token: admin,
      body: { status: 'IN_PROGRESS' },
    });
    check(toProgress.status === 200, 'an admin can move a report to IN_PROGRESS');
    check(toProgress.data.safety_hold === true, 'the safety hold survives IN_PROGRESS');
    check(
      (await api('POST', '/api/rentals', { token: guneet, body: { qr_code: unsafeBike.qr_code } }))
        .status === 409,
      'the bicycle still cannot be rented while IN_PROGRESS'
    );

    const noNotes = await api('PATCH', `/api/maintenance/${reportId}/status`, {
      token: admin,
      body: { status: 'RESOLVED' },
    });
    check(noNotes.status === 422, 'resolving without resolution notes -> 422');

    const resolved = await api('PATCH', `/api/maintenance/${reportId}/status`, {
      token: admin,
      body: { status: 'RESOLVED', resolution_notes: 'New brake pads and cable fitted; tested.' },
    });
    check(resolved.status === 200, 'an admin can resolve the report with notes');
    check(!!resolved.data.report.resolved_at, 'resolving records resolved_at');
    check(
      resolved.data.report.resolved_by_name === 'Admin User',
      'resolving records who resolved it'
    );
    check(resolved.data.safety_hold === false, 'the safety hold is lifted once resolved');
    check(
      resolved.data.bicycle.status === 'MAINTENANCE',
      'the bicycle is NOT silently returned to service when the report is resolved'
    );
    check(
      resolved.data.bicycle_can_return_to_service === true,
      'the API reports that the bicycle may now be returned to service'
    );

    const backInService = await api('PATCH', `/api/bicycles/${unsafeBike.id}/status`, {
      token: admin,
      body: { status: 'AVAILABLE', station_id: unsafeBike.station_id },
    });
    check(
      backInService.status === 200 && backInService.data.bicycle.status === 'AVAILABLE',
      'once resolved, an admin can explicitly return the bicycle to service'
    );
    const rentAgain = await api('POST', '/api/rentals', {
      token: guneet,
      body: { qr_code: unsafeBike.qr_code },
    });
    check(rentAgain.status === 409, 'Guneet still has an active ride, so this is still refused');

    const closed = await api('PATCH', `/api/maintenance/${reportId}/status`, {
      token: admin,
      body: { status: 'CLOSED', resolution_notes: 'Verified on a test ride.' },
    });
    check(closed.status === 200, 'RESOLVED -> CLOSED is allowed');
    const reopen = await api('PATCH', `/api/maintenance/${reportId}/status`, {
      token: admin,
      body: { status: 'OPEN' },
    });
    check(reopen.status === 409, 'CLOSED is terminal: CLOSED -> OPEN is refused (409)');
    const sameStatus = await api('PATCH', `/api/maintenance/${reportId}/status`, {
      token: admin,
      body: { status: 'CLOSED', resolution_notes: 'again' },
    });
    check(sameStatus.status === 409, 'moving a report to the status it already has -> 409');

    // Safety hold applied to a bicycle that is out on a ride.
    const onRide = (await api('GET', '/api/rentals/active', { token: guneet })).data.rental;
    const holdWhileRiding = await api('POST', '/api/maintenance', {
      token: guneet,
      body: {
        bicycle_id: onRide.bicycle_id,
        category: 'CHAIN',
        description: 'Chain came off twice on the way here.',
        severity: 'HIGH',
      },
    });
    check(holdWhileRiding.status === 201, 'a rider can report an issue mid-ride');
    check(
      holdWhileRiding.data.bicycle.status === 'IN_USE' &&
        holdWhileRiding.data.bicycle_status_changed === false,
      'a bicycle on a ride is not yanked out from under the rider'
    );
    const returnStation = stations.find((s) => s.status === 'ACTIVE');
    const returned = await api('POST', `/api/rentals/${onRide.id}/return`, {
      token: guneet,
      body: { end_station_id: returnStation.id },
    });
    check(returned.status === 200, 'the ride can still be returned normally');
    check(
      returned.data.rental.bicycle_status === 'MAINTENANCE' &&
        returned.data.rental.held_for_maintenance === true,
      'a bicycle with an open safety issue is parked as MAINTENANCE, not AVAILABLE'
    );
    const heldBike = (await api('GET', `/api/bicycles/${onRide.bicycle_id}`, { token: admin })).data
      .bicycle;
    check(
      heldBike.status === 'MAINTENANCE' && heldBike.on_safety_hold === true,
      'the bicycle record confirms the safety hold'
    );

    // ---- Scenario J: analytics ---------------------------------------------
    console.log('\nScenario J — usage analytics');
    const analytics = (await api('GET', '/api/analytics', { token: admin })).data;
    check(!!analytics.lifetime && !!analytics.period, 'analytics separates lifetime from period');
    check(analytics.lifetime.total_bicycles === 20, 'total bicycles comes from the database (20)');
    check(analytics.lifetime.total_stations === 6, 'total stations comes from the database (6)');
    const dbCounts = (
      await pool.query(
        `SELECT
           COUNT(*) FILTER (WHERE status = 'AVAILABLE')::int AS a,
           COUNT(*) FILTER (WHERE status = 'IN_USE')::int AS u,
           COUNT(*) FILTER (WHERE status = 'MAINTENANCE')::int AS m
         FROM bicycles`
      )
    ).rows[0];
    check(
      analytics.lifetime.available_bicycles === dbCounts.a &&
        analytics.lifetime.in_use_bicycles === dbCounts.u &&
        analytics.lifetime.maintenance_bicycles === dbCounts.m,
      'fleet figures match a direct SQL count'
    );
    check(
      analytics.charts.rentalsOverTime.length === 30,
      'the default range is the last 30 days, as a continuous 30-point series'
    );
    check(
      analytics.charts.usageByHour.length === 24,
      'usage-by-hour covers all 24 hours, including empty ones'
    );
    check(
      analytics.charts.bicycleStatus.length === 4,
      'the status distribution includes every status, even zero ones'
    );
    check(
      analytics.charts.rentalsByStation.length === 6,
      'every station appears in rentals-by-station'
    );
    check(
      typeof analytics.lifetime.avg_completed_minutes === 'number',
      'average completed ride duration is reported'
    );

    const narrow = (await api('GET', '/api/analytics?from=2099-01-01&to=2099-01-07', { token: admin }))
      .data;
    check(narrow.period.rides_started === 0, 'a future date range yields zero rides');
    check(narrow.charts.rentalsOverTime.length === 7, 'the chart follows the requested range');
    check(
      narrow.lifetime.total_bicycles === 20,
      'lifetime figures are unaffected by the date filter'
    );
    const shifted = (await api('GET', '/api/analytics?from=2026-01-01&to=2026-01-31', { token: admin }))
      .data;
    check(
      shifted.charts.rentalsOverTime.length === 31 &&
        shifted.charts.rentalsOverTime[0].day === '2026-01-01',
      'changing the date range changes the results'
    );
    check(
      (await api('GET', '/api/analytics?from=2026-05-01&to=2026-01-01', { token: admin })).status ===
        400,
      'a reversed date range -> 400'
    );
    check(
      (await api('GET', '/api/analytics?from=not-a-date', { token: admin })).status === 400,
      'an unparseable date -> 400'
    );

    // ---- Scenario K: geofencing --------------------------------------------
    console.log('\nScenario K — software geofencing (simulated locations)');
    const geo = (await api('GET', '/api/geofence', { token: aditi })).data;
    check(geo.configured === true, 'a campus boundary is configured');
    check(
      geo.demonstration_mode === true && /simulated/i.test(geo.notice),
      'the API labels the location source as simulated demonstration data'
    );

    const target = (await api('GET', '/api/bicycles?status=AVAILABLE', { token: admin })).data
      .bicycles[0];

    const insidePing = await api('POST', '/api/geofence/locations', {
      token: admin,
      body: { bicycle_id: target.id, ...INSIDE },
    });
    check(insidePing.status === 201, 'an inside-boundary location is accepted (201)');
    check(
      insidePing.data.inside_boundary === true && insidePing.data.violation === false,
      'an inside-boundary location raises no violation'
    );
    check(insidePing.data.event === null, 'no alert is created for an inside location');
    check(insidePing.data.ping.source === 'SIMULATED', 'the ping is stored as SIMULATED');

    const firstOut = await api('POST', '/api/geofence/locations', {
      token: admin,
      body: { bicycle_id: target.id, ...OUTSIDE },
    });
    check(firstOut.status === 201 && firstOut.data.violation === true, 'an outside location is a violation');
    check(!!firstOut.data.event && firstOut.data.event.status === 'OPEN', 'a violation creates an OPEN alert');
    check(firstOut.data.event.ping_count === 1, 'the new alert starts with one ping');
    const eventId = firstOut.data.event.id;
    check(
      firstOut.data.event.bicycle_code === target.cycle_code,
      'the alert is associated with the right bicycle'
    );
    check(!!firstOut.data.event.occurred_at, 'the alert records when it happened');
    check(
      firstOut.data.event.latitude === OUTSIDE.latitude &&
        firstOut.data.event.longitude === OUTSIDE.longitude,
      'the alert records the coordinates'
    );

    const secondOut = await api('POST', '/api/geofence/locations', {
      token: admin,
      body: { bicycle_id: target.id, ...OUTSIDE_2 },
    });
    const thirdOut = await api('POST', '/api/geofence/locations', {
      token: admin,
      body: { bicycle_id: target.id, ...OUTSIDE_2 },
    });
    check(
      secondOut.data.duplicate_suppressed === true && thirdOut.data.duplicate_suppressed === true,
      'repeated out-of-bounds updates are folded into the existing alert'
    );
    check(
      secondOut.data.event.id === eventId && thirdOut.data.event.id === eventId,
      'no duplicate alert is created'
    );
    check(thirdOut.data.event.ping_count === 3, 'the alert counts the repeated pings (3)');
    check(
      thirdOut.data.event.last_latitude === OUTSIDE_2.latitude,
      'the alert tracks the last known position'
    );
    const openAlerts = (await api('GET', '/api/geofence/events?status=OPEN', { token: admin })).data;
    check(openAlerts.pagination.total === 1, 'the dashboard shows exactly one open alert');

    const backInside = await api('POST', '/api/geofence/locations', {
      token: admin,
      body: { bicycle_id: target.id, ...INSIDE },
    });
    check(
      !!backInside.data.event.returned_inside_at && backInside.data.event.status === 'OPEN',
      'returning inside is recorded but does not silently close the alert'
    );

    const ack = await api('PATCH', `/api/geofence/events/${eventId}`, {
      token: admin,
      body: { status: 'ACKNOWLEDGED', notes: 'Security team notified.' },
    });
    check(
      ack.status === 200 && ack.data.event.status === 'ACKNOWLEDGED',
      'an admin can acknowledge an alert'
    );
    check(
      ack.data.event.acknowledged_by_name === 'Admin User' && !!ack.data.event.acknowledged_at,
      'acknowledgement records who and when'
    );
    const resolve = await api('PATCH', `/api/geofence/events/${eventId}`, {
      token: admin,
      body: { status: 'RESOLVED', notes: 'Cycle recovered and returned to the Library station.' },
    });
    check(
      resolve.status === 200 && resolve.data.event.status === 'RESOLVED',
      'an admin can resolve an alert'
    );
    check(
      (await api('PATCH', `/api/geofence/events/${eventId}`, {
        token: admin,
        body: { status: 'ACKNOWLEDGED' },
      })).status === 409,
      'a resolved alert cannot be moved back (409)'
    );

    // Once resolved, a fresh violation creates a NEW alert.
    const afterResolve = await api('POST', '/api/geofence/locations', {
      token: admin,
      body: { bicycle_id: target.id, ...OUTSIDE },
    });
    check(
      afterResolve.data.event.id !== eventId && afterResolve.data.event.status === 'OPEN',
      'a violation after resolution opens a new alert'
    );
    await api('PATCH', `/api/geofence/events/${afterResolve.data.event.id}`, {
      token: admin,
      body: { status: 'RESOLVED', notes: 'Test cleanup.' },
    });

    // Validation + source handling.
    check(
      (await api('POST', '/api/geofence/locations', {
        token: admin,
        body: { bicycle_id: target.id, latitude: 120, longitude: 76.3 },
      })).status === 422,
      'an out-of-range latitude -> 422'
    );
    const deviceSource = await api('POST', '/api/geofence/locations', {
      token: admin,
      body: { bicycle_id: target.id, ...INSIDE, source: 'DEVICE' },
    });
    check(
      deviceSource.status === 422,
      'a DEVICE-sourced location is refused: there is no GPS hardware yet (422)'
    );
    check(
      (await api('POST', '/api/geofence/locations', {
        token: admin,
        body: { bicycle_id: 999999, ...INSIDE },
      })).status === 422,
      'a location for an unknown bicycle -> 422'
    );

    // Boundary configuration.
    const badPoly = await api('PUT', '/api/geofence', {
      token: admin,
      body: { name: 'Bad', polygon: [[30.1, 76.1], [30.2, 76.2]] },
    });
    check(badPoly.status === 422, 'a two-point boundary is rejected (422)');
    const badPoint = await api('PUT', '/api/geofence', {
      token: admin,
      body: { name: 'Bad', polygon: [[30.1, 76.1], [30.2, 76.2], [200, 76.3]] },
    });
    check(badPoint.status === 422, 'an out-of-range vertex is rejected (422)');

    const newPoly = [
      [30.3609, 76.3585],
      [30.3609, 76.3665],
      [30.3519, 76.3677],
      [30.3519, 76.3573],
    ];
    const newBoundary = await api('PUT', '/api/geofence', {
      token: admin,
      body: { name: 'Test boundary', description: 'Tightened for testing', polygon: newPoly },
    });
    check(newBoundary.status === 200, 'an admin can replace the campus boundary');
    check(
      newBoundary.data.geofence.polygon.length === 4,
      'the new boundary is stored with its four vertices'
    );
    const activeCount = (
      await pool.query('SELECT COUNT(*)::int AS c FROM geofence_config WHERE is_active')
    ).rows[0].c;
    check(activeCount === 1, 'exactly one boundary remains active');

    // ---- Scenario L: Phase 2 RBAC ------------------------------------------
    console.log('\nScenario L — Phase 2 role-based access control');
    const studentForbidden = [
      ['GET', '/api/analytics'],
      ['GET', '/api/maintenance'],
      ['GET', '/api/maintenance/stats'],
      ['GET', '/api/geofence/events'],
      ['GET', '/api/geofence/locations'],
      ['GET', '/api/geofence/locations/latest'],
      ['GET', '/api/geofence/history'],
      ['POST', '/api/geofence/locations'],
      ['PUT', '/api/geofence'],
    ];
    for (const [method, endpoint] of studentForbidden) {
      const res = await api(method, endpoint, {
        token: aditi,
        body: method === 'GET' ? undefined : { bicycle_id: 1, ...INSIDE },
      });
      check(res.status === 403, `student ${method} ${endpoint} -> 403`);
    }
    check(
      (await api('PATCH', `/api/maintenance/${minor.data.report.id}/status`, {
        token: aditi,
        body: { status: 'CLOSED', resolution_notes: 'nope' },
      })).status === 403,
      'a student cannot change a maintenance status -> 403'
    );
    const noToken = [
      '/api/analytics',
      '/api/maintenance/me',
      '/api/geofence',
      '/api/stations/map',
      '/api/rentals/1',
    ];
    for (const endpoint of noToken) {
      check((await api('GET', endpoint)).status === 401, `no token GET ${endpoint} -> 401`);
    }

    // No secrets ever leave the API.
    const probe = JSON.stringify([
      (await api('GET', '/api/analytics', { token: admin })).data,
      (await api('GET', '/api/users', { token: admin })).data,
      (await api('GET', '/api/geofence', { token: admin })).data,
      (await api('GET', '/api/maintenance', { token: admin })).data,
    ]);
    check(
      !/password|password_hash|jwt|secret|DATABASE_URL/i.test(probe),
      'no password hashes, JWT secrets or database credentials appear in API responses'
    );
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
