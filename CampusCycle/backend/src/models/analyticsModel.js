'use strict';

const { pool } = require('../config/db');
const env = require('../config/env');

/** Reporting timezone for day/hour buckets — see config/env.js. */
const TZ = env.appTimezone;

/**
 * Aggregate queries for the admin analytics dashboard.
 *
 * Every figure here is computed by PostgreSQL from the live tables — nothing
 * is hard-coded or cached. All queries are safe on an empty database: counts
 * come back as 0 and averages as null (never a divide-by-zero).
 *
 * Date-filtered queries take a half-open [from, to) instant pair and filter
 * on rentals.started_at. Lifetime queries take no range.
 *
 * Day and hour buckets are computed in the application's reporting timezone
 * (APP_TIMEZONE, see config/env.js) rather than the database session's zone,
 * so "today" and "9am" mean the same thing in Node and in PostgreSQL no
 * matter how the server is configured.
 */

// --- lifetime (not affected by the date filter) ----------------------------

async function lifetimeTotals(db = pool) {
  const { rows } = await db.query(`
    SELECT
      (SELECT COUNT(*)::int FROM bicycles)                                     AS total_bicycles,
      (SELECT COUNT(*)::int FROM bicycles WHERE status = 'AVAILABLE')          AS available_bicycles,
      (SELECT COUNT(*)::int FROM bicycles WHERE status = 'IN_USE')             AS in_use_bicycles,
      (SELECT COUNT(*)::int FROM bicycles WHERE status = 'MAINTENANCE')        AS maintenance_bicycles,
      (SELECT COUNT(*)::int FROM bicycles WHERE status = 'RESERVED')           AS reserved_bicycles,
      (SELECT COUNT(*)::int FROM stations)                                     AS total_stations,
      (SELECT COUNT(*)::int FROM stations WHERE status = 'ACTIVE')             AS active_stations,
      (SELECT COUNT(*)::int FROM stations WHERE latitude IS NOT NULL)          AS mapped_stations,
      (SELECT COUNT(*)::int FROM users WHERE role = 'STUDENT')                 AS total_students,
      (SELECT COUNT(*)::int FROM rentals WHERE status = 'ACTIVE')              AS active_rentals,
      (SELECT COUNT(*)::int FROM rentals WHERE status = 'COMPLETED')           AS completed_rentals,
      (SELECT COUNT(*)::int FROM rentals WHERE status = 'CANCELLED')           AS cancelled_rentals,
      (SELECT COUNT(*)::int FROM rentals)                                      AS total_rentals,
      (SELECT COUNT(*)::int FROM rentals
         WHERE status = 'COMPLETED'
           AND ended_at >= (date_trunc('day', NOW() AT TIME ZONE $1)
                            AT TIME ZONE $1))                                  AS completed_today,
      (SELECT ROUND(AVG(EXTRACT(EPOCH FROM (ended_at - started_at))))::int
         FROM rentals
        WHERE status = 'COMPLETED' AND ended_at IS NOT NULL
          AND ended_at >= started_at)                                          AS avg_completed_seconds,
      (SELECT COUNT(*)::int FROM maintenance_reports
         WHERE status IN ('OPEN', 'IN_PROGRESS'))                              AS open_maintenance,
      (SELECT COUNT(*)::int FROM maintenance_reports)                          AS total_maintenance,
      (SELECT COUNT(*)::int FROM geofence_events WHERE status = 'OPEN')        AS open_geofence_alerts
  `, [TZ]);
  return rows[0];
}

// --- date-filtered ---------------------------------------------------------

async function rangeTotals({ from, to }, db = pool) {
  const { rows } = await db.query(
    `
    SELECT
      COUNT(*)::int                                                      AS rides_started,
      COUNT(*) FILTER (WHERE status = 'COMPLETED')::int                  AS rides_completed,
      COUNT(*) FILTER (WHERE status = 'ACTIVE')::int                     AS rides_active,
      COUNT(*) FILTER (WHERE status = 'CANCELLED')::int                  AS rides_cancelled,
      COUNT(DISTINCT user_id)::int                                       AS unique_riders,
      COUNT(DISTINCT bicycle_id)::int                                    AS bicycles_used,
      ROUND(AVG(EXTRACT(EPOCH FROM (ended_at - started_at)))
            FILTER (WHERE status = 'COMPLETED' AND ended_at IS NOT NULL
                      AND ended_at >= started_at))::int                  AS avg_completed_seconds,
      ROUND(SUM(EXTRACT(EPOCH FROM (ended_at - started_at)))
            FILTER (WHERE status = 'COMPLETED' AND ended_at IS NOT NULL
                      AND ended_at >= started_at))::bigint               AS total_completed_seconds
    FROM rentals
    WHERE started_at >= $1 AND started_at < $2
  `,
    [from, to]
  );
  const row = rows[0];
  return {
    ...row,
    total_completed_seconds:
      row.total_completed_seconds === null ? 0 : Number(row.total_completed_seconds),
  };
}

/**
 * Rides per day across the range, with empty days filled in by
 * generate_series so the chart has a continuous x-axis.
 */
async function rentalsOverTime({ from, to }, db = pool) {
  const { rows } = await db.query(
    `
    WITH days AS (
      SELECT generate_series(
               date_trunc('day', $1::timestamptz AT TIME ZONE $3),
               date_trunc('day', ($2::timestamptz - INTERVAL '1 microsecond') AT TIME ZONE $3),
               INTERVAL '1 day'
             ) AS day
    )
    SELECT to_char(d.day, 'YYYY-MM-DD') AS day,
           COUNT(r.id)::int                                   AS rides,
           COUNT(r.id) FILTER (WHERE r.status = 'COMPLETED')::int AS completed
    FROM days d
    LEFT JOIN rentals r
      ON (r.started_at AT TIME ZONE $3) >= d.day
     AND (r.started_at AT TIME ZONE $3) <  d.day + INTERVAL '1 day'
    GROUP BY d.day
    ORDER BY d.day
  `,
    [from, to, TZ]
  );
  return rows;
}

/** Rides that started or ended at each station within the range. */
async function rentalsByStation({ from, to }, db = pool) {
  const { rows } = await db.query(
    `
    SELECT s.id, s.name, s.status,
           COUNT(r_start.id)::int AS started_here,
           COUNT(r_end.id)::int   AS ended_here,
           (COUNT(r_start.id) + COUNT(r_end.id))::int AS total_trips
    FROM stations s
    LEFT JOIN rentals r_start
      ON r_start.start_station_id = s.id
     AND r_start.started_at >= $1 AND r_start.started_at < $2
    LEFT JOIN rentals r_end
      ON r_end.end_station_id = s.id
     AND r_end.started_at >= $1 AND r_end.started_at < $2
    GROUP BY s.id, s.name, s.status
    ORDER BY total_trips DESC, s.name
  `,
    [from, to]
  );
  return rows;
}

/** Snapshot of the fleet by status (a current state, not a range figure). */
async function bicycleStatusDistribution(db = pool) {
  const { rows } = await db.query(`
    SELECT v.status, COALESCE(COUNT(b.id), 0)::int AS count
    FROM (VALUES ('AVAILABLE'), ('IN_USE'), ('RESERVED'), ('MAINTENANCE')) AS v(status)
    LEFT JOIN bicycles b ON b.status = v.status
    GROUP BY v.status
    ORDER BY v.status
  `);
  return rows;
}

/** Rides by hour of day (0-23) within the range, every hour present. */
async function usageByHour({ from, to }, db = pool) {
  const { rows } = await db.query(
    `
    WITH hours AS (SELECT generate_series(0, 23) AS hour)
    SELECT h.hour, COUNT(r.id)::int AS rides
    FROM hours h
    LEFT JOIN rentals r
      ON EXTRACT(HOUR FROM (r.started_at AT TIME ZONE $3)) = h.hour
     AND r.started_at >= $1 AND r.started_at < $2
    GROUP BY h.hour
    ORDER BY h.hour
  `,
    [from, to, TZ]
  );
  return rows;
}

/** Most-rented bicycles within the range. */
async function topBicycles({ from, to, limit = 5 }, db = pool) {
  const { rows } = await db.query(
    `
    SELECT b.id, b.cycle_code, b.status,
           COUNT(r.id)::int AS rides,
           ROUND(AVG(EXTRACT(EPOCH FROM (r.ended_at - r.started_at)))
                 FILTER (WHERE r.status = 'COMPLETED' AND r.ended_at IS NOT NULL
                           AND r.ended_at >= r.started_at))::int AS avg_seconds
    FROM bicycles b
    JOIN rentals r ON r.bicycle_id = b.id
                  AND r.started_at >= $1 AND r.started_at < $2
    GROUP BY b.id, b.cycle_code, b.status
    ORDER BY rides DESC, b.cycle_code
    LIMIT $3
  `,
    [from, to, limit]
  );
  return rows;
}

/** Maintenance reports grouped by category and by status, within the range. */
async function maintenanceBreakdown({ from, to }, db = pool) {
  const [byCategory, byStatus, bySeverity] = await Promise.all([
    db.query(
      `SELECT category, COUNT(*)::int AS count
       FROM maintenance_reports
       WHERE reported_at >= $1 AND reported_at < $2
       GROUP BY category ORDER BY count DESC, category`,
      [from, to]
    ),
    db.query(
      `SELECT v.status, COALESCE(COUNT(m.id), 0)::int AS count
       FROM (VALUES ('OPEN'), ('IN_PROGRESS'), ('RESOLVED'), ('CLOSED')) AS v(status)
       LEFT JOIN maintenance_reports m
         ON m.status = v.status AND m.reported_at >= $1 AND m.reported_at < $2
       GROUP BY v.status ORDER BY v.status`,
      [from, to]
    ),
    db.query(
      `SELECT v.severity, COALESCE(COUNT(m.id), 0)::int AS count
       FROM (VALUES ('LOW'), ('MEDIUM'), ('HIGH'), ('CRITICAL')) AS v(severity)
       LEFT JOIN maintenance_reports m
         ON m.severity = v.severity AND m.reported_at >= $1 AND m.reported_at < $2
       GROUP BY v.severity ORDER BY v.severity`,
      [from, to]
    ),
  ]);
  return {
    byCategory: byCategory.rows,
    byStatus: byStatus.rows,
    bySeverity: bySeverity.rows,
  };
}

module.exports = {
  lifetimeTotals,
  rangeTotals,
  rentalsOverTime,
  rentalsByStation,
  bicycleStatusDistribution,
  usageByHour,
  topBicycles,
  maintenanceBreakdown,
};
