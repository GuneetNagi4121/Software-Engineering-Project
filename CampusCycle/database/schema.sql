-- ===========================================================================
-- CampusCycle — PostgreSQL schema (Phase 1)
-- Smart Campus Bicycle Sharing and Mobility Management System
--
-- Re-runnable: drops existing objects, then recreates them. Intended for
-- development. Run with:  psql -d campuscycle -f database/schema.sql
--          or:            npm run db:migrate   (from backend/)
-- ===========================================================================

BEGIN;

-- Clean slate (safe for dev). Order/CASCADE handles dependencies.
DROP TABLE IF EXISTS rentals   CASCADE;
DROP TABLE IF EXISTS bicycles  CASCADE;
DROP TABLE IF EXISTS stations  CASCADE;
DROP TABLE IF EXISTS users     CASCADE;
DROP FUNCTION IF EXISTS set_updated_at() CASCADE;

-- ---------------------------------------------------------------------------
-- Shared trigger: keep updated_at current on every UPDATE.
-- ---------------------------------------------------------------------------
CREATE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------
CREATE TABLE users (
  id            INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name          VARCHAR(120)  NOT NULL,
  email         VARCHAR(255)  NOT NULL UNIQUE,
  password_hash VARCHAR(255)  NOT NULL,
  role          VARCHAR(20)   NOT NULL DEFAULT 'STUDENT'
                              CHECK (role IN ('STUDENT', 'ADMIN')),
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_users_updated
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- stations
-- ---------------------------------------------------------------------------
CREATE TABLE stations (
  id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name        VARCHAR(120) NOT NULL UNIQUE,
  location    VARCHAR(255) NOT NULL,
  capacity    INTEGER      NOT NULL CHECK (capacity > 0),
  status      VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE'
                          CHECK (status IN ('ACTIVE', 'INACTIVE')),
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_stations_updated
  BEFORE UPDATE ON stations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- bicycles
--   station_id is NULL while a bicycle is IN_USE (it is not parked anywhere).
--   ON DELETE RESTRICT: a station cannot be removed while bikes reference it.
-- ---------------------------------------------------------------------------
CREATE TABLE bicycles (
  id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cycle_code  VARCHAR(40)  NOT NULL UNIQUE,
  qr_code     VARCHAR(80)  NOT NULL UNIQUE,
  station_id  INTEGER      REFERENCES stations(id) ON DELETE RESTRICT,
  status      VARCHAR(20)  NOT NULL DEFAULT 'AVAILABLE'
                          CHECK (status IN ('AVAILABLE', 'RESERVED', 'IN_USE', 'MAINTENANCE')),
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bicycles_station ON bicycles(station_id);
CREATE INDEX idx_bicycles_status  ON bicycles(status);

CREATE TRIGGER trg_bicycles_updated
  BEFORE UPDATE ON bicycles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- rentals
--   Retains start/end station, start/end time, user and bicycle.
--   Two partial unique indexes enforce concurrency invariants at the DB level:
--     * at most one ACTIVE rental per user
--     * at most one ACTIVE rental per bicycle
-- ---------------------------------------------------------------------------
CREATE TABLE rentals (
  id                INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id           INTEGER     NOT NULL REFERENCES users(id)    ON DELETE RESTRICT,
  bicycle_id        INTEGER     NOT NULL REFERENCES bicycles(id) ON DELETE RESTRICT,
  start_station_id  INTEGER     REFERENCES stations(id) ON DELETE RESTRICT,
  end_station_id    INTEGER     REFERENCES stations(id) ON DELETE RESTRICT,
  started_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at          TIMESTAMPTZ,
  status            VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
                              CHECK (status IN ('ACTIVE', 'COMPLETED', 'CANCELLED')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- A completed ride must have an end time; an active ride must not.
  CONSTRAINT chk_ended_at CHECK (
    (status = 'COMPLETED' AND ended_at IS NOT NULL) OR
    (status <> 'COMPLETED')
  )
);

CREATE INDEX idx_rentals_user     ON rentals(user_id);
CREATE INDEX idx_rentals_bicycle  ON rentals(bicycle_id);
CREATE INDEX idx_rentals_status   ON rentals(status);
CREATE INDEX idx_rentals_started  ON rentals(started_at DESC);

CREATE UNIQUE INDEX uq_active_rental_per_user
  ON rentals(user_id) WHERE status = 'ACTIVE';
CREATE UNIQUE INDEX uq_active_rental_per_bicycle
  ON rentals(bicycle_id) WHERE status = 'ACTIVE';

CREATE TRIGGER trg_rentals_updated
  BEFORE UPDATE ON rentals
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;
