-- ===========================================================================
-- CampusCycle — Phase 2 migration (002)
-- Campus maps, ride history, maintenance management, usage analytics and
-- software-based geofencing.
--
-- ADDITIVE AND IDEMPOTENT. This script never drops or truncates a Phase 1
-- table, so existing users, stations, bicycles and rentals are preserved.
-- Safe to run more than once.
--
-- Run with:  psql -d campuscycle -f database/migrations/002_phase2.sql
--      or:   npm run db:migrate:phase2   (from backend/)
-- ===========================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. stations — geographic coordinates for the campus map.
--    Nullable so that stations created in Phase 1 remain valid; the API and
--    the map treat a station without coordinates as "not yet mapped".
--    NUMERIC(9,6) gives ~0.1 m resolution and avoids floating-point drift.
-- ---------------------------------------------------------------------------
ALTER TABLE stations ADD COLUMN IF NOT EXISTS latitude  NUMERIC(9,6);
ALTER TABLE stations ADD COLUMN IF NOT EXISTS longitude NUMERIC(9,6);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_stations_latitude'
  ) THEN
    ALTER TABLE stations ADD CONSTRAINT chk_stations_latitude
      CHECK (latitude IS NULL OR (latitude >= -90 AND latitude <= 90));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_stations_longitude'
  ) THEN
    ALTER TABLE stations ADD CONSTRAINT chk_stations_longitude
      CHECK (longitude IS NULL OR (longitude >= -180 AND longitude <= 180));
  END IF;

  -- Either both coordinates are present or neither is.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_stations_coords_paired'
  ) THEN
    ALTER TABLE stations ADD CONSTRAINT chk_stations_coords_paired
      CHECK ((latitude IS NULL) = (longitude IS NULL));
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. maintenance_reports — issues reported against a bicycle.
--
--    Lifecycle: OPEN -> IN_PROGRESS -> RESOLVED -> CLOSED
--    Severity drives the safety workflow (see backend maintenanceService):
--      HIGH / CRITICAL  = safety hold; the bicycle cannot be rented while an
--                         OPEN or IN_PROGRESS report of that severity exists.
--      LOW / MEDIUM     = flagged for admin review; the bicycle stays usable.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS maintenance_reports (
  id               INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  bicycle_id       INTEGER     NOT NULL REFERENCES bicycles(id) ON DELETE RESTRICT,
  reported_by      INTEGER     NOT NULL REFERENCES users(id)    ON DELETE RESTRICT,
  category         VARCHAR(40) NOT NULL
                   CHECK (category IN ('BRAKES', 'TYRE', 'CHAIN', 'LIGHT', 'SEAT', 'OTHER')),
  description      TEXT        NOT NULL CHECK (length(btrim(description)) > 0),
  severity         VARCHAR(20) NOT NULL DEFAULT 'MEDIUM'
                   CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  status           VARCHAR(20) NOT NULL DEFAULT 'OPEN'
                   CHECK (status IN ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED')),
  reported_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at      TIMESTAMPTZ,
  resolved_by      INTEGER     REFERENCES users(id) ON DELETE RESTRICT,
  resolution_notes TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- A report is only resolved/closed together with a resolution timestamp.
  CONSTRAINT chk_maintenance_resolved CHECK (
    (status IN ('RESOLVED', 'CLOSED') AND resolved_at IS NOT NULL) OR
    (status NOT IN ('RESOLVED', 'CLOSED') AND resolved_at IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_maintenance_bicycle  ON maintenance_reports(bicycle_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_status   ON maintenance_reports(status);
CREATE INDEX IF NOT EXISTS idx_maintenance_reporter ON maintenance_reports(reported_by);
CREATE INDEX IF NOT EXISTS idx_maintenance_reported ON maintenance_reports(reported_at DESC);

-- Fast lookup for the safety-hold check (open high-severity issues per bike).
CREATE INDEX IF NOT EXISTS idx_maintenance_safety_hold
  ON maintenance_reports(bicycle_id)
  WHERE status IN ('OPEN', 'IN_PROGRESS') AND severity IN ('HIGH', 'CRITICAL');

DROP TRIGGER IF EXISTS trg_maintenance_updated ON maintenance_reports;
CREATE TRIGGER trg_maintenance_updated
  BEFORE UPDATE ON maintenance_reports
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- 3. geofence_config — the configurable campus boundary.
--
--    The boundary is a polygon stored as JSONB: [[lat, lng], [lat, lng], ...]
--    with at least 3 vertices. Exactly one row may be active at a time.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS geofence_config (
  id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name        VARCHAR(120) NOT NULL,
  description TEXT,
  polygon     JSONB        NOT NULL,
  is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
  updated_by  INTEGER      REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_geofence_polygon_shape CHECK (
    jsonb_typeof(polygon) = 'array' AND jsonb_array_length(polygon) >= 3
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_geofence_single_active
  ON geofence_config((is_active)) WHERE is_active;

DROP TRIGGER IF EXISTS trg_geofence_config_updated ON geofence_config;
CREATE TRIGGER trg_geofence_config_updated
  BEFORE UPDATE ON geofence_config
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- 4. bicycle_location_pings — the (demonstration) bicycle location source.
--
--    CampusCycle has no GPS hardware on the bicycles. Every row here is an
--    explicitly submitted location update, and `source` records where it came
--    from so simulated data is never silently mixed with real data. Only
--    'SIMULATED' is accepted in Phase 2; 'DEVICE' is reserved for a future
--    GPS/IoT integration.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bicycle_location_pings (
  id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  bicycle_id  INTEGER      NOT NULL REFERENCES bicycles(id) ON DELETE CASCADE,
  rental_id   INTEGER      REFERENCES rentals(id) ON DELETE SET NULL,
  latitude    NUMERIC(9,6) NOT NULL CHECK (latitude  >= -90  AND latitude  <= 90),
  longitude   NUMERIC(9,6) NOT NULL CHECK (longitude >= -180 AND longitude <= 180),
  source      VARCHAR(20)  NOT NULL DEFAULT 'SIMULATED'
                           CHECK (source IN ('SIMULATED', 'DEVICE')),
  inside_boundary BOOLEAN,
  geofence_id INTEGER      REFERENCES geofence_config(id) ON DELETE SET NULL,
  recorded_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pings_bicycle  ON bicycle_location_pings(bicycle_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_pings_recorded ON bicycle_location_pings(recorded_at DESC);

-- ---------------------------------------------------------------------------
-- 5. geofence_events — boundary violations.
--
--    One OPEN/ACKNOWLEDGED event per bicycle at a time. Repeated out-of-bounds
--    pings update `last_seen_at`, `ping_count` and the last known coordinates
--    on the existing event instead of creating duplicates. A partial unique
--    index enforces that even under concurrent updates.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS geofence_events (
  id              INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  bicycle_id      INTEGER      NOT NULL REFERENCES bicycles(id) ON DELETE RESTRICT,
  rental_id       INTEGER      REFERENCES rentals(id) ON DELETE SET NULL,
  geofence_id     INTEGER      REFERENCES geofence_config(id) ON DELETE SET NULL,
  latitude        NUMERIC(9,6) NOT NULL CHECK (latitude  >= -90  AND latitude  <= 90),
  longitude       NUMERIC(9,6) NOT NULL CHECK (longitude >= -180 AND longitude <= 180),
  last_latitude   NUMERIC(9,6),
  last_longitude  NUMERIC(9,6),
  source          VARCHAR(20)  NOT NULL DEFAULT 'SIMULATED'
                               CHECK (source IN ('SIMULATED', 'DEVICE')),
  status          VARCHAR(20)  NOT NULL DEFAULT 'OPEN'
                               CHECK (status IN ('OPEN', 'ACKNOWLEDGED', 'RESOLVED')),
  ping_count      INTEGER      NOT NULL DEFAULT 1 CHECK (ping_count > 0),
  occurred_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  last_seen_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  returned_inside_at TIMESTAMPTZ,
  acknowledged_by INTEGER      REFERENCES users(id) ON DELETE SET NULL,
  acknowledged_at TIMESTAMPTZ,
  resolved_by     INTEGER      REFERENCES users(id) ON DELETE SET NULL,
  resolved_at     TIMESTAMPTZ,
  notes           TEXT,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_geofence_event_resolved CHECK (
    (status = 'RESOLVED' AND resolved_at IS NOT NULL) OR
    (status <> 'RESOLVED' AND resolved_at IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_geofence_events_bicycle  ON geofence_events(bicycle_id);
CREATE INDEX IF NOT EXISTS idx_geofence_events_status   ON geofence_events(status);
CREATE INDEX IF NOT EXISTS idx_geofence_events_occurred ON geofence_events(occurred_at DESC);

-- At most one unresolved event per bicycle — the de-duplication guarantee.
CREATE UNIQUE INDEX IF NOT EXISTS uq_geofence_open_event_per_bicycle
  ON geofence_events(bicycle_id) WHERE status <> 'RESOLVED';

DROP TRIGGER IF EXISTS trg_geofence_events_updated ON geofence_events;
CREATE TRIGGER trg_geofence_events_updated
  BEFORE UPDATE ON geofence_events
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;
