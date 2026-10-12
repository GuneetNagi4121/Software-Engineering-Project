-- ===========================================================================
-- CampusCycle — Phase 2 seed / configuration data
--
-- NON-DESTRUCTIVE AND IDEMPOTENT. This file never truncates a table. It only:
--   1. fills in latitude/longitude for the six development stations,
--   2. installs a campus geofence boundary if none is configured yet,
--   3. adds a small set of demo maintenance reports, but only when the
--      maintenance_reports table is still empty (so a real database with
--      genuine reports is left alone).
--
-- Run with:  psql -d campuscycle -f database/seed-phase2.sql
--      or:   npm run db:seed:phase2   (from backend/)
--
-- ---------------------------------------------------------------------------
-- COORDINATE PROVENANCE — read before trusting these numbers
-- ---------------------------------------------------------------------------
-- Campus: Thapar Institute of Engineering and Technology, Patiala, Punjab.
-- Campus centre 30.3564 N, 76.3625 E and area ~250 acres are taken from the
-- institute's Wikipedia entry.
--
-- The per-station coordinates below are APPROXIMATE PLACEMENTS inside that
-- campus, chosen so the map is usable for development and demonstration.
-- They are NOT surveyed positions of the real buildings. Replace them with
-- surveyed values (or values read off a map) before treating the map as
-- operationally accurate — each station's coordinates can also be edited from
-- the admin Stations screen.
--
-- The geofence polygon is likewise an approximation of the campus extent
-- (~1 km x ~1.1 km around the centre), not the legal property boundary.
-- ===========================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Station coordinates (matched by the Phase 1 seed station names).
--    Only fills stations that exist; unknown names are ignored.
-- ---------------------------------------------------------------------------
UPDATE stations s
SET latitude = v.lat, longitude = v.lng
FROM (VALUES
  ('Library',        30.356800, 76.362800),
  ('Hostel A',       30.359300, 76.360000),
  ('Hostel B',       30.359000, 76.365400),
  ('Academic Block', 30.355600, 76.361200),
  ('Cafeteria',      30.356100, 76.364100),
  ('Sports Complex', 30.353800, 76.363300)
) AS v(name, lat, lng)
WHERE s.name = v.name;

-- ---------------------------------------------------------------------------
-- 2. Campus geofence boundary — installed only if nothing is configured.
--    Polygon vertices are [latitude, longitude] pairs, anticlockwise.
-- ---------------------------------------------------------------------------
INSERT INTO geofence_config (name, description, polygon, is_active, updated_by)
SELECT
  'Thapar Institute main campus (approximate)',
  'Approximate ~1 km x 1.1 km boundary around the campus centre (30.3564 N, 76.3625 E). Demonstration boundary, not a surveyed property line.',
  '[[30.3609,76.3585],[30.3609,76.3665],[30.3580,76.3685],[30.3519,76.3677],[30.3519,76.3573],[30.3580,76.3565]]'::jsonb,
  TRUE,
  (SELECT id FROM users WHERE role = 'ADMIN' ORDER BY id LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM geofence_config);

-- ---------------------------------------------------------------------------
-- 3. Demo maintenance reports — only when the table is completely empty.
--    Gives the admin maintenance screen and the analytics page something to
--    show on a fresh development database.
-- ---------------------------------------------------------------------------
INSERT INTO maintenance_reports
  (bicycle_id, reported_by, category, description, severity, status,
   reported_at, resolved_at, resolved_by, resolution_notes)
SELECT b.id, u.id, v.category, v.description, v.severity, v.status,
       NOW() - (v.days_ago || ' days')::interval,
       CASE WHEN v.status IN ('RESOLVED', 'CLOSED')
            THEN NOW() - (v.days_ago || ' days')::interval + INTERVAL '2 days'
       END,
       CASE WHEN v.status IN ('RESOLVED', 'CLOSED')
            THEN (SELECT id FROM users WHERE role = 'ADMIN' ORDER BY id LIMIT 1)
       END,
       v.resolution_notes
FROM (VALUES
  ('TC-010', 'rahul@campuscycle.edu', 'BRAKES', 'Rear brake lever goes all the way to the grip with almost no bite.', 'CRITICAL', 'IN_PROGRESS', 3, NULL),
  ('TC-017', 'aditi@campuscycle.edu', 'TYRE',   'Front tyre is flat again within an hour of pumping it up.',           'HIGH',     'OPEN',        1, NULL),
  ('TC-020', 'sneha@campuscycle.edu', 'CHAIN',  'Chain slips off the rear sprocket when pedalling uphill.',            'HIGH',     'OPEN',        2, NULL),
  ('TC-003', 'guneet@campuscycle.edu','LIGHT',  'Front light flickers and then cuts out.',                             'LOW',      'OPEN',        4, NULL),
  ('TC-012', 'karan@campuscycle.edu', 'SEAT',   'Saddle will not stay at the height I set it to.',                     'MEDIUM',   'RESOLVED',    9,
   'Seat clamp replaced and torqued; tested on site.')
) AS v(cycle_code, email, category, description, severity, status, days_ago, resolution_notes)
JOIN bicycles b ON b.cycle_code = v.cycle_code
JOIN users    u ON u.email      = v.email
WHERE NOT EXISTS (SELECT 1 FROM maintenance_reports);

COMMIT;

-- Quick sanity summary (printed by psql).
SELECT
  (SELECT COUNT(*) FROM stations WHERE latitude IS NOT NULL) AS stations_mapped,
  (SELECT COUNT(*) FROM geofence_config WHERE is_active)     AS active_geofences,
  (SELECT COUNT(*) FROM maintenance_reports)                 AS maintenance_reports;
