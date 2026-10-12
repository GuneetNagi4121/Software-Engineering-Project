'use strict';

const { pool } = require('../config/db');

/**
 * Data access for the geofence tables:
 *   geofence_config         — the configurable campus boundary
 *   bicycle_location_pings  — submitted (demonstration) bicycle locations
 *   geofence_events         — boundary violations, de-duplicated per bicycle
 */

// --- boundary configuration ------------------------------------------------

const CONFIG_COLUMNS = `
  id, name, description, polygon, is_active, updated_by, created_at, updated_at`;

function normalizeConfig(row) {
  if (!row) return row;
  return {
    ...row,
    // JSONB comes back as JS arrays already; coerce the numbers defensively.
    polygon: Array.isArray(row.polygon)
      ? row.polygon.map((p) => [Number(p[0]), Number(p[1])])
      : [],
  };
}

async function findActiveConfig(db = pool) {
  const { rows } = await db.query(
    `SELECT ${CONFIG_COLUMNS} FROM geofence_config WHERE is_active LIMIT 1`
  );
  return rows[0] ? normalizeConfig(rows[0]) : null;
}

async function listConfigs(db = pool) {
  const { rows } = await db.query(
    `SELECT ${CONFIG_COLUMNS} FROM geofence_config ORDER BY is_active DESC, id DESC`
  );
  return rows.map(normalizeConfig);
}

/**
 * Replace the active boundary: deactivate whatever is active, then insert the
 * new configuration as active. Must run inside a transaction so the partial
 * unique index (one active row) is never violated.
 */
async function replaceActiveConfig({ name, description, polygon, updatedBy }, db) {
  await db.query('UPDATE geofence_config SET is_active = FALSE WHERE is_active');
  const { rows } = await db.query(
    `INSERT INTO geofence_config (name, description, polygon, is_active, updated_by)
     VALUES ($1, $2, $3::jsonb, TRUE, $4)
     RETURNING ${CONFIG_COLUMNS}`,
    [name, description ?? null, JSON.stringify(polygon), updatedBy ?? null]
  );
  return normalizeConfig(rows[0]);
}

// --- location pings --------------------------------------------------------

async function insertPing(
  { bicycleId, rentalId, latitude, longitude, source, insideBoundary, geofenceId },
  db = pool
) {
  const { rows } = await db.query(
    `INSERT INTO bicycle_location_pings
       (bicycle_id, rental_id, latitude, longitude, source, inside_boundary, geofence_id, recorded_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
     RETURNING id, bicycle_id, rental_id, latitude, longitude, source,
               inside_boundary, geofence_id, recorded_at`,
    [
      bicycleId,
      rentalId ?? null,
      latitude,
      longitude,
      source,
      insideBoundary,
      geofenceId ?? null,
    ]
  );
  const row = rows[0];
  return {
    ...row,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
  };
}

async function listRecentPings({ bicycleId, limit = 50 } = {}, db = pool) {
  const params = [];
  let where = '';
  if (bicycleId) {
    params.push(bicycleId);
    where = `WHERE p.bicycle_id = $${params.length}`;
  }
  params.push(limit);
  const { rows } = await db.query(
    `SELECT p.id, p.bicycle_id, p.rental_id, p.latitude, p.longitude, p.source,
            p.inside_boundary, p.recorded_at,
            b.cycle_code AS bicycle_code
     FROM bicycle_location_pings p
     JOIN bicycles b ON b.id = p.bicycle_id
     ${where}
     ORDER BY p.recorded_at DESC, p.id DESC
     LIMIT $${params.length}`,
    params
  );
  return rows.map((r) => ({
    ...r,
    latitude: Number(r.latitude),
    longitude: Number(r.longitude),
  }));
}

/** Latest known location per bicycle (for the admin map overlay). */
async function latestPingPerBicycle(db = pool) {
  const { rows } = await db.query(
    `SELECT DISTINCT ON (p.bicycle_id)
            p.bicycle_id, p.latitude, p.longitude, p.source, p.inside_boundary,
            p.recorded_at, b.cycle_code AS bicycle_code, b.status AS bicycle_status
     FROM bicycle_location_pings p
     JOIN bicycles b ON b.id = p.bicycle_id
     ORDER BY p.bicycle_id, p.recorded_at DESC, p.id DESC`
  );
  return rows.map((r) => ({
    ...r,
    latitude: Number(r.latitude),
    longitude: Number(r.longitude),
  }));
}

// --- violation events ------------------------------------------------------

const EVENT_DETAIL = `
  SELECT e.id, e.bicycle_id, e.rental_id, e.geofence_id,
         e.latitude, e.longitude, e.last_latitude, e.last_longitude,
         e.source, e.status, e.ping_count,
         e.occurred_at, e.last_seen_at, e.returned_inside_at,
         e.acknowledged_by, e.acknowledged_at,
         e.resolved_by, e.resolved_at, e.notes,
         e.created_at, e.updated_at,
         b.cycle_code AS bicycle_code,
         ru.name      AS rider_name,
         ack.name     AS acknowledged_by_name,
         res.name     AS resolved_by_name,
         g.name       AS geofence_name
  FROM geofence_events e
  JOIN bicycles b          ON b.id = e.bicycle_id
  LEFT JOIN rentals r      ON r.id = e.rental_id
  LEFT JOIN users ru       ON ru.id = r.user_id
  LEFT JOIN users ack      ON ack.id = e.acknowledged_by
  LEFT JOIN users res      ON res.id = e.resolved_by
  LEFT JOIN geofence_config g ON g.id = e.geofence_id`;

function normalizeEvent(row) {
  if (!row) return row;
  const num = (v) => (v === null || v === undefined ? null : Number(v));
  return {
    ...row,
    latitude: num(row.latitude),
    longitude: num(row.longitude),
    last_latitude: num(row.last_latitude),
    last_longitude: num(row.last_longitude),
  };
}

/** The unresolved (OPEN or ACKNOWLEDGED) event for a bicycle, locked. */
async function findUnresolvedByBicycleForUpdate(bicycleId, db) {
  const { rows } = await db.query(
    `SELECT id, status, ping_count FROM geofence_events
     WHERE bicycle_id = $1 AND status <> 'RESOLVED'
     FOR UPDATE`,
    [bicycleId]
  );
  return rows[0] || null;
}

async function createEvent(
  { bicycleId, rentalId, geofenceId, latitude, longitude, source },
  db
) {
  const { rows } = await db.query(
    `INSERT INTO geofence_events
       (bicycle_id, rental_id, geofence_id, latitude, longitude,
        last_latitude, last_longitude, source, status, ping_count,
        occurred_at, last_seen_at)
     VALUES ($1, $2, $3, $4, $5, $4, $5, $6, 'OPEN', 1, NOW(), NOW())
     RETURNING id`,
    [bicycleId, rentalId ?? null, geofenceId ?? null, latitude, longitude, source]
  );
  return findEventById(rows[0].id, db);
}

/** Fold a repeated out-of-bounds ping into the existing event. */
async function touchEvent({ id, latitude, longitude, rentalId }, db) {
  const { rows } = await db.query(
    `UPDATE geofence_events
     SET ping_count = ping_count + 1,
         last_seen_at = NOW(),
         last_latitude = $2,
         last_longitude = $3,
         rental_id = COALESCE($4::int, rental_id)
     WHERE id = $1
     RETURNING id`,
    [id, latitude, longitude, rentalId ?? null]
  );
  if (rows.length === 0) return null;
  return findEventById(id, db);
}

/** Record that the bicycle has been seen back inside the boundary. */
async function markReturnedInside(id, db) {
  await db.query(
    `UPDATE geofence_events
     SET returned_inside_at = COALESCE(returned_inside_at, NOW())
     WHERE id = $1`,
    [id]
  );
  return findEventById(id, db);
}

async function findEventById(id, db = pool) {
  const { rows } = await db.query(`${EVENT_DETAIL} WHERE e.id = $1`, [id]);
  return rows[0] ? normalizeEvent(rows[0]) : null;
}

async function listEventsPaged({ status, bicycleId } = {}, { limit = 25, offset = 0 } = {}, db = pool) {
  const params = [];
  const conditions = [];
  if (status) {
    params.push(status);
    conditions.push(`e.status = $${params.length}`);
  }
  if (bicycleId) {
    params.push(bicycleId);
    conditions.push(`e.bicycle_id = $${params.length}`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const countResult = await db.query(
    `SELECT COUNT(*)::int AS total FROM geofence_events e ${where}`,
    params
  );

  const pageParams = params.slice();
  pageParams.push(limit);
  const limitPh = `$${pageParams.length}`;
  pageParams.push(offset);
  const offsetPh = `$${pageParams.length}`;

  const { rows } = await db.query(
    `${EVENT_DETAIL} ${where}
     ORDER BY
       CASE e.status WHEN 'OPEN' THEN 0 WHEN 'ACKNOWLEDGED' THEN 1 ELSE 2 END,
       e.last_seen_at DESC, e.id DESC
     LIMIT ${limitPh} OFFSET ${offsetPh}`,
    pageParams
  );

  return { events: rows.map(normalizeEvent), total: countResult.rows[0].total };
}

/** Lock an event for an acknowledge/resolve transition. */
async function findEventByIdForUpdate(id, db) {
  const { rows } = await db.query(
    'SELECT id, status FROM geofence_events WHERE id = $1 FOR UPDATE',
    [id]
  );
  return rows[0] || null;
}

async function setEventStatus({ id, status, userId, notes }, db) {
  const { rows } = await db.query(
    `UPDATE geofence_events
     SET status = $2::text,
         acknowledged_by = CASE WHEN $2::text = 'ACKNOWLEDGED' THEN $3::int ELSE acknowledged_by END,
         acknowledged_at = CASE WHEN $2::text = 'ACKNOWLEDGED' THEN COALESCE(acknowledged_at, NOW())
                                ELSE acknowledged_at END,
         resolved_by = CASE WHEN $2::text = 'RESOLVED' THEN $3::int ELSE NULL END,
         resolved_at = CASE WHEN $2::text = 'RESOLVED' THEN NOW() ELSE NULL END,
         notes = COALESCE($4::text, notes)
     WHERE id = $1
     RETURNING id`,
    [id, status, userId ?? null, notes ?? null]
  );
  if (rows.length === 0) return null;
  return findEventById(id, db);
}

async function countEventsByStatus(db = pool) {
  const { rows } = await db.query(
    'SELECT status, COUNT(*)::int AS count FROM geofence_events GROUP BY status'
  );
  const counts = { OPEN: 0, ACKNOWLEDGED: 0, RESOLVED: 0 };
  for (const r of rows) counts[r.status] = r.count;
  counts.TOTAL = Object.values(counts).reduce((a, b) => a + b, 0);
  return counts;
}

module.exports = {
  findActiveConfig,
  listConfigs,
  replaceActiveConfig,
  insertPing,
  listRecentPings,
  latestPingPerBicycle,
  findUnresolvedByBicycleForUpdate,
  createEvent,
  touchEvent,
  markReturnedInside,
  findEventById,
  findEventByIdForUpdate,
  listEventsPaged,
  setEventStatus,
  countEventsByStatus,
};
