-- ===========================================================================
-- CampusCycle — seed data (Phase 1)
--
-- Re-runnable: truncates all tables, then inserts a realistic demo dataset.
-- Passwords are hashed with bcrypt via the pgcrypto extension so this file is
-- self-contained (bcryptjs on the backend verifies these $2a$ hashes).
--
-- Run with:  psql -d campuscycle -f database/seed.sql
--       or:  npm run db:seed   (from backend/)
--
-- Development login credentials (see README):
--   Admin    -> admin@campuscycle.edu   / Admin@123
--   Students -> <name>@campuscycle.edu  / Student@123
-- ===========================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

TRUNCATE rentals, bicycles, stations, users RESTART IDENTITY CASCADE;

-- ---------------------------------------------------------------------------
-- Users: 1 admin + 5 students
-- ---------------------------------------------------------------------------
INSERT INTO users (name, email, password_hash, role) VALUES
  ('Admin User',   'admin@campuscycle.edu',  crypt('Admin@123',   gen_salt('bf', 10)), 'ADMIN'),
  ('Guneet Nagi',  'guneet@campuscycle.edu', crypt('Student@123', gen_salt('bf', 10)), 'STUDENT'),
  ('Rahul Verma',  'rahul@campuscycle.edu',  crypt('Student@123', gen_salt('bf', 10)), 'STUDENT'),
  ('Aditi Sharma', 'aditi@campuscycle.edu',  crypt('Student@123', gen_salt('bf', 10)), 'STUDENT'),
  ('Karan Singh',  'karan@campuscycle.edu',  crypt('Student@123', gen_salt('bf', 10)), 'STUDENT'),
  ('Sneha Iyer',   'sneha@campuscycle.edu',  crypt('Student@123', gen_salt('bf', 10)), 'STUDENT');

-- ---------------------------------------------------------------------------
-- Stations
-- ---------------------------------------------------------------------------
INSERT INTO stations (name, location, capacity, status) VALUES
  ('Library',         'Central Library, Ground Floor entrance', 12, 'ACTIVE'),
  ('Hostel A',        'Boys Hostel A, main gate',               15, 'ACTIVE'),
  ('Hostel B',        'Girls Hostel B, main gate',              15, 'ACTIVE'),
  ('Academic Block',  'Academic Block C, north plaza',          10, 'ACTIVE'),
  ('Cafeteria',       'Food Court, outdoor stand',               8, 'ACTIVE'),
  ('Sports Complex',  'Indoor Stadium, parking bay',            10, 'ACTIVE');

-- ---------------------------------------------------------------------------
-- Bicycles parked at stations (18). Station is resolved by name.
-- ---------------------------------------------------------------------------
INSERT INTO bicycles (cycle_code, qr_code, station_id, status)
SELECT v.cycle_code, v.qr_code, s.id, v.status
FROM (VALUES
  ('TC-002', 'CYCLE-TC-002', 'Library',        'AVAILABLE'),
  ('TC-003', 'CYCLE-TC-003', 'Library',        'AVAILABLE'),
  ('TC-004', 'CYCLE-TC-004', 'Library',        'AVAILABLE'),
  ('TC-006', 'CYCLE-TC-006', 'Hostel A',       'AVAILABLE'),
  ('TC-007', 'CYCLE-TC-007', 'Hostel A',       'AVAILABLE'),
  ('TC-014', 'CYCLE-TC-014', 'Hostel A',       'AVAILABLE'),
  ('TC-008', 'CYCLE-TC-008', 'Hostel B',       'AVAILABLE'),
  ('TC-009', 'CYCLE-TC-009', 'Hostel B',       'AVAILABLE'),
  ('TC-010', 'CYCLE-TC-010', 'Hostel B',       'MAINTENANCE'),
  ('TC-011', 'CYCLE-TC-011', 'Academic Block', 'AVAILABLE'),
  ('TC-012', 'CYCLE-TC-012', 'Academic Block', 'AVAILABLE'),
  ('TC-013', 'CYCLE-TC-013', 'Academic Block', 'AVAILABLE'),
  ('TC-015', 'CYCLE-TC-015', 'Cafeteria',      'AVAILABLE'),
  ('TC-016', 'CYCLE-TC-016', 'Cafeteria',      'AVAILABLE'),
  ('TC-017', 'CYCLE-TC-017', 'Cafeteria',      'MAINTENANCE'),
  ('TC-018', 'CYCLE-TC-018', 'Sports Complex', 'AVAILABLE'),
  ('TC-019', 'CYCLE-TC-019', 'Sports Complex', 'AVAILABLE'),
  ('TC-020', 'CYCLE-TC-020', 'Sports Complex', 'MAINTENANCE')
) AS v(cycle_code, qr_code, station_name, status)
JOIN stations s ON s.name = v.station_name;

-- Bicycles currently IN_USE are not parked at any station (station_id NULL).
INSERT INTO bicycles (cycle_code, qr_code, station_id, status) VALUES
  ('TC-001', 'CYCLE-TC-001', NULL, 'IN_USE'),
  ('TC-005', 'CYCLE-TC-005', NULL, 'IN_USE');

-- ---------------------------------------------------------------------------
-- Rentals
--   Two ACTIVE rides (matching the two IN_USE bikes) and one COMPLETED ride.
-- ---------------------------------------------------------------------------

-- Guneet is currently riding TC-001, picked up from the Library ~45 min ago.
INSERT INTO rentals (user_id, bicycle_id, start_station_id, started_at, status)
SELECT u.id, b.id, s.id, NOW() - INTERVAL '45 minutes', 'ACTIVE'
FROM users u, bicycles b, stations s
WHERE u.email = 'guneet@campuscycle.edu' AND b.cycle_code = 'TC-001' AND s.name = 'Library';

-- Karan is currently riding TC-005, picked up from Hostel A ~15 min ago.
INSERT INTO rentals (user_id, bicycle_id, start_station_id, started_at, status)
SELECT u.id, b.id, s.id, NOW() - INTERVAL '15 minutes', 'ACTIVE'
FROM users u, bicycles b, stations s
WHERE u.email = 'karan@campuscycle.edu' AND b.cycle_code = 'TC-005' AND s.name = 'Hostel A';

-- Rahul completed a ride on TC-014 two days ago (Hostel A -> Hostel A).
INSERT INTO rentals (user_id, bicycle_id, start_station_id, end_station_id, started_at, ended_at, status)
SELECT u.id, b.id, s1.id, s2.id,
       NOW() - INTERVAL '2 days',
       NOW() - INTERVAL '2 days' + INTERVAL '38 minutes',
       'COMPLETED'
FROM users u, bicycles b, stations s1, stations s2
WHERE u.email = 'rahul@campuscycle.edu' AND b.cycle_code = 'TC-014'
  AND s1.name = 'Hostel A' AND s2.name = 'Hostel A';

COMMIT;

-- Quick sanity summary (printed by psql).
SELECT
  (SELECT COUNT(*) FROM users)    AS users,
  (SELECT COUNT(*) FROM stations) AS stations,
  (SELECT COUNT(*) FROM bicycles) AS bicycles,
  (SELECT COUNT(*) FROM rentals WHERE status = 'ACTIVE') AS active_rentals;
