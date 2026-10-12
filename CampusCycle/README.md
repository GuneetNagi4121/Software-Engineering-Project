# 🚲 CampusCycle — Smart Campus Bicycle Sharing & Mobility Management

CampusCycle is a full‑stack web application for running a **campus bicycle‑sharing
service**. Students find and unlock cycles by scanning a QR code, ride between
docking stations, and return the cycle at their destination — while administrators
manage the fleet, stations, and monitor live usage from a dedicated console.

This repository contains **Phase 1** (the core end‑to‑end rental system) and
**Phase 2** — campus maps, ride history, maintenance management, usage analytics
and software‑based geofencing.

---

## Table of Contents

1. [Overview](#overview)
2. [Key Features](#key-features)
3. [Tech Stack](#tech-stack)
4. [Project Structure](#project-structure)
5. [Database Schema](#database-schema)
6. [Prerequisites](#prerequisites)
7. [Environment Variables](#environment-variables)
8. [Setup & Installation](#setup--installation)
9. [Seed Data & Login Credentials](#seed-data--login-credentials)
10. [Running the Application](#running-the-application)
11. [API Reference](#api-reference)
12. [Concurrency & Safety Design](#concurrency--safety-design)
13. [Phase 2 Modules](#phase-2-modules)
14. [Testing](#testing)
15. [Assumptions](#assumptions)
16. [Known Limitations](#known-limitations)
17. [Roadmap — Future Phases](#roadmap--future-phases)

---

## Overview

CampusCycle models the real workflow of a shared‑mobility service on a scale that
fits a single campus:

- **Students** sign in, see available cycles and nearby stations, start a ride by
  scanning/entering a cycle's QR code, watch their ride duration tick live, and end
  the ride by choosing a return station.
- **Administrators** manage the bicycle fleet and stations (full CRUD), change cycle
  status (e.g. send to maintenance / return to service), and view a live campus
  overview with fleet counts, station stats, and recent rentals.

The system is built around **data integrity and concurrency safety** — two students
can never rent the same cycle, and a student can never hold two active rides at once.

---

## Key Features

### Student

- 🔐 **Authentication** — register / login with JWT‑based sessions.
- 🏠 **Dashboard** — active ride card, available‑cycle count, nearby stations, recent rides.
- 📍 **Stations** — browse all docking stations with live availability indicators.
- 📷 **Rent a cycle** — pick an available cycle, scan its QR (camera *or* manual entry), confirm.
- ⏱️ **Active ride** — live duration counter driven by the backend `started_at` timestamp.
- 🅿️ **Return flow** — choose a return station; the cycle becomes available there.
- 🧾 **Ride history** — full list of past and active rides with durations and statuses.
- 👤 **Profile** — view account details and update display name.

### Admin

- 📊 **Campus overview** — total / available / in‑use / maintenance cycles, station counts, active rides, recent rentals.
- 🚲 **Bicycle management** — create, edit, delete; change status; assign to stations; duplicate code/QR prevention.
- 🏢 **Station management** — create, edit, delete; set capacity; activate / deactivate; safe‑delete guards.
- 🛣️ **Rentals** — view every ride, filter by status, and force‑end an active ride if needed.
- 🛡️ **Role‑based access** — students are blocked from all admin APIs (HTTP 403).

---

## Tech Stack

| Layer        | Technology                                                        |
| ------------ | ----------------------------------------------------------------- |
| **Frontend** | React 18, Vite 5, Tailwind CSS 3, React Router 6, Axios, Lucide   |
| **Backend**  | Node.js, Express 4, JSON Web Tokens, bcryptjs                     |
| **Database** | PostgreSQL (via the `pg` driver, connection pooling, transactions)|
| **Tooling**  | Nodemon, Morgan, Helmet, CORS, dotenv                             |

---

## Project Structure

```
CampusCycle/
├── backend/
│   ├── src/
│   │   ├── config/          # env validation, PostgreSQL pool + withTransaction()
│   │   ├── utils/           # ApiError, validators, constants, asyncHandler,
│   │   │                     #   geo (point-in-polygon), availability rules
│   │   ├── middleware/      # authenticate, authorize(role), error handler
│   │   ├── models/          # data access (users, stations, bicycles, rentals,
│   │   │                     #   maintenance, geofence, analytics)
│   │   ├── services/        # business logic (auth, rental, bicycle, station, stats,
│   │   │                     #   maintenance, analytics, geofence)
│   │   ├── controllers/     # thin request/response handlers
│   │   ├── routes/          # REST route definitions
│   │   ├── scripts/         # db migrate & seed runners
│   │   ├── tests/           # end-to-end test scenarios
│   │   ├── app.js           # express app (middleware + routes)
│   │   └── server.js        # http server + graceful shutdown
│   ├── .env.example
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── components/      # UI library + feature components (RentDialog, etc.)
│   │   │   ├── map/         # Leaflet campus map + legend
│   │   │   └── charts/      # Recharts wrappers + validated chart palette
│   │   ├── context/         # AuthContext, ToastContext
│   │   ├── hooks/           # useNow (live timer)
│   │   ├── layouts/         # StudentLayout, AdminLayout
│   │   ├── pages/           # student/* and admin/* screens, Login, Register
│   │   ├── services/        # axios instance + typed API wrappers
│   │   ├── utils/           # formatting helpers
│   │   ├── App.jsx          # routes
│   │   └── main.jsx         # entry point
│   ├── .env.example
│   └── package.json
│
├── database/
│   ├── schema.sql           # Phase 1 base tables, constraints, indexes, triggers
│   ├── migrations/
│   │   └── 002_phase2.sql   # additive Phase 2 schema (idempotent, non-destructive)
│   ├── seed.sql             # demo data (users, stations, bicycles, rentals)
│   └── seed-phase2.sql      # station coordinates, campus geofence, demo reports
│
└── README.md
```

---

## Database Schema

PostgreSQL is the **only** database used. All identifiers use
`INTEGER GENERATED ALWAYS AS IDENTITY` primary keys, enums are enforced with
`CHECK` constraints, and an `updated_at` trigger keeps timestamps current.

### Tables

**`users`**

| Column | Type | Notes |
| --- | --- | --- |
| `id` | int (PK) | identity |
| `name` | varchar | not null |
| `email` | varchar | **unique**, not null |
| `password_hash` | varchar | bcrypt hash, not null |
| `role` | varchar | `STUDENT` \| `ADMIN` (CHECK) |
| `created_at` / `updated_at` | timestamptz | defaults + trigger |

**`stations`**

| Column | Type | Notes |
| --- | --- | --- |
| `id` | int (PK) | identity |
| `name` | varchar | not null |
| `location` | varchar | not null |
| `capacity` | int | > 0 (CHECK) |
| `status` | varchar | `ACTIVE` \| `INACTIVE` (CHECK) |

**`bicycles`**

| Column | Type | Notes |
| --- | --- | --- |
| `id` | int (PK) | identity |
| `cycle_code` | varchar | **unique**, not null |
| `qr_code` | varchar | **unique**, not null |
| `station_id` | int (FK → stations) | nullable, `ON DELETE RESTRICT` |
| `status` | varchar | `AVAILABLE` \| `RESERVED` \| `IN_USE` \| `MAINTENANCE` (CHECK) |

**`rentals`**

| Column | Type | Notes |
| --- | --- | --- |
| `id` | int (PK) | identity |
| `user_id` | int (FK → users) | not null, `ON DELETE RESTRICT` |
| `bicycle_id` | int (FK → bicycles) | not null, `ON DELETE RESTRICT` |
| `start_station_id` | int (FK → stations) | not null |
| `end_station_id` | int (FK → stations) | nullable (set on return) |
| `started_at` | timestamptz | not null |
| `ended_at` | timestamptz | nullable, `CHECK (ended_at IS NULL OR ended_at >= started_at)` |
| `status` | varchar | `ACTIVE` \| `COMPLETED` \| `CANCELLED` (CHECK) |

### Integrity & concurrency invariants (enforced in the database)

- `CREATE UNIQUE INDEX uq_active_rental_per_user ON rentals(user_id) WHERE status = 'ACTIVE'`
  → a student can hold **at most one** active ride.
- `CREATE UNIQUE INDEX uq_active_rental_per_bicycle ON rentals(bicycle_id) WHERE status = 'ACTIVE'`
  → a cycle can be on **at most one** active ride.
- Supporting indexes on foreign keys and status columns for fast lookups.

---

### Phase 2 tables

| Table | Purpose |
|---|---|
| `stations.latitude` / `.longitude` | `NUMERIC(9,6)`, nullable, range‑checked. A station without coordinates is simply "not on the map yet". |
| `maintenance_reports` | Issues reported against a cycle: category, description, severity, status, reporter, resolution. |
| `geofence_config` | The configurable campus boundary, stored as a JSONB polygon of `[lat, lng]` points. One active row at a time. |
| `bicycle_location_pings` | Submitted bicycle locations, each tagged with its `source`. Only `SIMULATED` is accepted in this phase. |
| `geofence_events` | Boundary violations, de‑duplicated to one unresolved alert per cycle. |

Phase 2 invariants enforced in the database:

- `uq_geofence_open_event_per_bicycle` — a partial unique index guaranteeing **at most
  one unresolved alert per cycle**, so repeated breaches cannot flood the dashboard.
- `uq_geofence_single_active` — at most one active boundary configuration.
- `chk_maintenance_resolved` — a `RESOLVED`/`CLOSED` report must carry a resolution time.
- `chk_stations_coords_paired` — latitude and longitude are both present or both absent.
- Range checks on every stored latitude/longitude.

---

## Prerequisites

- **Node.js** ≥ 18
- **PostgreSQL** ≥ 13 (tested against 18) running locally
- **npm** ≥ 9

---

## Environment Variables

Secrets are **never** hard‑coded. Copy the example files and fill in your values.
`.env` files are git‑ignored.

### `backend/.env`

```bash
cp backend/.env.example backend/.env
```

| Variable | Description | Example |
| --- | --- | --- |
| `PORT` | API server port | `4000` |
| `CLIENT_ORIGIN` | Allowed CORS origin (frontend) | `http://localhost:5175` |
| `DATABASE_URL` | Full PostgreSQL connection string | `postgresql://postgres:PASSWORD@localhost:5432/campuscycle` |
| `JWT_SECRET` | Secret for signing JWTs (**required**) | a long random string |
| `JWT_EXPIRES_IN` | Token lifetime | `7d` |
| `BCRYPT_ROUNDS` | bcrypt cost factor | `10` |

> If you prefer discrete settings over `DATABASE_URL`, the backend also reads
> `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`.

### `frontend/.env` (optional)

```bash
cp frontend/.env.example frontend/.env
```

In development the Vite dev server proxies `/api` to the backend, so no config is
needed. Set `VITE_API_URL` only if you host the API elsewhere.

---

## Setup & Installation

```bash
# 1) Clone and enter the project
cd CampusCycle

# 2) Create the database (once)
#    (use your PostgreSQL superuser; you'll be prompted for its password)
psql -U postgres -c "CREATE DATABASE campuscycle;"

# 3) Install dependencies — root tooling + backend + frontend, in one step
npm run install:all

# 4) Configure and seed the backend
cd backend
cp .env.example .env         # then edit .env with your DB password + JWT secret
npm run db:setup             # schema.sql + migrations + seed.sql + seed-phase2.sql
cd ..
```

### Upgrading an existing Phase 1 database

If you already have a database with real data, **do not** run `db:setup` — it rebuilds
the schema from scratch. Apply the additive Phase 2 migration instead:

```bash
cd backend
npm run db:migrate:phase2    # adds Phase 2 tables/columns; never drops or truncates
npm run db:seed:phase2       # station coordinates + campus geofence (idempotent)
```

Both commands are safe to run more than once. `db:seed:phase2` fills in coordinates
for the six demo stations, installs the campus boundary if none is configured, and adds
demo maintenance reports **only when the `maintenance_reports` table is empty**.

Equivalent raw psql:

```bash
psql -d campuscycle -f database/migrations/002_phase2.sql
psql -d campuscycle -f database/seed-phase2.sql
```

> Prefer to install each part yourself? Run `npm install` in the project root
> (for the `concurrently` dev runner), then `npm install` in `backend/` and `frontend/`.

---

## Seed Data & Login Credentials

`npm run db:seed` (part of `db:setup`) loads a realistic demo dataset:

- **6 users** — 1 admin + 5 students
- **6 stations** — Library, Hostel A, Hostel B, Academic Block, Cafeteria, Sports Complex
- **20 bicycles** — 15 available, 3 in maintenance, 2 in use
- **3 rentals** — 2 active rides + 1 completed ride

### Login credentials

| Role | Email | Password |
| --- | --- | --- |
| **Admin** | `admin@campuscycle.edu` | `Admin@123` |
| Student | `guneet@campuscycle.edu` | `Student@123` |
| Student | `rahul@campuscycle.edu` | `Student@123` |
| Student | `aditi@campuscycle.edu` | `Student@123` |
| Student | `karan@campuscycle.edu` | `Student@123` |
| Student | `sneha@campuscycle.edu` | `Student@123` |

> These are development‑only credentials. Change them before any real deployment.

---

## Running the Application

**One command (recommended)** — from the project **root**, start the backend and
frontend together:

```bash
npm run dev
```

This uses [`concurrently`](https://www.npmjs.com/package/concurrently) to run both
dev servers with colour‑prefixed logs (`backend` in cyan, `frontend` in magenta).
Ensure PostgreSQL is running first. Backend → http://localhost:4000, frontend →
http://localhost:5175.

**Or run them in separate terminals:**

```bash
# Terminal 1 — backend API (http://localhost:4000)
cd backend
npm run dev

# Terminal 2 — frontend (http://localhost:5175)
cd frontend
npm run dev
```

Then open **http://localhost:5175** and sign in with any account above.
Students land on the student dashboard; the admin lands on the admin console.

---

## API Reference

All routes are prefixed with `/api`. Protected routes require an
`Authorization: Bearer <token>` header. Admin‑only routes return **403** for students.

### Auth

| Method | Endpoint | Access | Description |
| --- | --- | --- | --- |
| `POST` | `/auth/register` | Public | Register a new **student** account |
| `POST` | `/auth/login` | Public | Log in, returns `{ token, user }` |
| `GET` | `/auth/me` | Authenticated | Current user profile |
| `PATCH` | `/auth/me` | Authenticated | Update display name |

### Stations

| Method | Endpoint | Access | Description |
| --- | --- | --- | --- |
| `GET` | `/stations` | Authenticated | List stations with availability counts |
| `GET` | `/stations/:id` | Authenticated | Station detail |
| `POST` | `/stations` | Admin | Create station |
| `PUT` | `/stations/:id` | Admin | Update station |
| `PATCH` | `/stations/:id/status` | Admin | Activate / deactivate |
| `DELETE` | `/stations/:id` | Admin | Delete (guarded) |

### Bicycles

| Method | Endpoint | Access | Description |
| --- | --- | --- | --- |
| `GET` | `/bicycles` | Authenticated | List / filter (`?status=`, `?station_id=`, `?search=`) |
| `GET` | `/bicycles/stats` | Admin | Fleet counts by status |
| `GET` | `/bicycles/:id` | Authenticated | Bicycle detail |
| `POST` | `/bicycles` | Admin | Create bicycle |
| `PUT` | `/bicycles/:id` | Admin | Update bicycle |
| `PATCH` | `/bicycles/:id/status` | Admin | Change status / reassign station |
| `DELETE` | `/bicycles/:id` | Admin | Delete (guarded) |

### Rentals

| Method | Endpoint | Access | Description |
| --- | --- | --- | --- |
| `POST` | `/rentals` | Student | Start a ride (body: `{ qr_code }`) |
| `POST` | `/rentals/:id/return` | Owner / Admin | End a ride (body: `{ end_station_id }`) |
| `GET` | `/rentals/active` | Student | Current active ride (or `null`) |
| `GET` | `/rentals/me` | Authenticated | Own ride history |
| `GET` | `/rentals` | Admin | All rentals (`?status=` filter) |

### Admin / Users / Health

| Method | Endpoint | Access | Description |
| --- | --- | --- | --- |
| `GET` | `/admin/overview` | Admin | Aggregated dashboard figures |
| `GET` | `/users` | Admin | List all users |
| `GET` | `/health` | Public | Service health check |

---

### Phase 2 — Maintenance

| Method | Endpoint | Role | Description |
|---|---|---|---|
| POST | `/api/maintenance` | any | Report a problem with a cycle |
| GET | `/api/maintenance/me` | any | The caller's own reports (`?status=`, `?limit=`, `?offset=`) |
| GET | `/api/maintenance/:id` | own / admin | One report |
| GET | `/api/maintenance` | admin | All reports (`?status=`, `?severity=`, `?category=`, `?bicycle_id=`, `?from=`, `?to=`) |
| GET | `/api/maintenance/stats` | admin | Counts by status |
| PATCH | `/api/maintenance/:id/status` | admin | Move a report along its lifecycle |

### Phase 2 — Stations, rides & analytics

| Method | Endpoint | Role | Description |
|---|---|---|---|
| GET | `/api/stations` | any | Now supports `?availability=`, `?status=`, `?mapped=true`, `?sort=` |
| GET | `/api/stations/map` | any | Mapped stations + campus boundary + availability rules |
| GET | `/api/rentals/:id` | own / admin | One ride, with `duration_seconds` |
| GET | `/api/rentals` | admin | Filters `?status=`, `?bicycle_id=`, `?station_id=`, `?from=`, `?to=` plus `?limit=`/`?offset=`/`?page=`; returns `{ rentals, pagination }` |
| GET | `/api/analytics` | admin | `?from=`/`?to=` (YYYY‑MM‑DD); lifetime + period figures, chart series and leaderboards |

### Phase 2 — Geofencing

| Method | Endpoint | Role | Description |
|---|---|---|---|
| GET | `/api/geofence` | any | The active boundary and the demonstration‑mode notice |
| PUT | `/api/geofence` | admin | Replace the boundary (`{ name, description?, polygon }`) |
| GET | `/api/geofence/history` | admin | Previous boundary configurations |
| POST | `/api/geofence/locations` | admin | Submit a **simulated** cycle location; evaluates it against the boundary |
| GET | `/api/geofence/locations` | admin | Recent submitted locations |
| GET | `/api/geofence/locations/latest` | admin | Last known position per cycle |
| GET | `/api/geofence/events` | admin | Violation alerts (`?status=`, `?bicycle_id=`) |
| GET | `/api/geofence/events/stats` | admin | Counts by status |
| PATCH | `/api/geofence/events/:id` | admin | Acknowledge or resolve an alert |

---

## Phase 2 Modules

### A — Interactive campus map

Leaflet + OpenStreetMap. `/app/map` (student) and `/admin/map` (admin) draw every
station that has coordinates, coloured by availability, with the campus boundary
overlaid. Markers show the live count of available cycles; the popup carries the
station name, available cycles, total capacity, status and working **View station** /
**Find a bicycle** actions. All figures come from `GET /api/stations/map` — nothing is
hard‑coded in the frontend. Loading, empty and error states are handled, and stations
without coordinates are listed explicitly rather than silently dropped.

### B — Station availability

One availability rule, defined once in `backend/src/utils/availability.js` and applied
to the station list, the station detail page and the map, so they can never disagree:

```
available_count     bicycles with status AVAILABLE parked at the station
availability_pct    round(available_count / capacity * 100), 0 when capacity is 0
availability_level  INACTIVE  station is not in service
                    NONE      no cycles available
                    LOW       ≤ 2 cycles left, or < 20% of capacity
                    GOOD      anything above that
```

Students can filter by availability level and sort by how many cycles are free.

### C — Ride history

`/app/rides` lists the signed‑in student's rides with filters (all / active /
completed / cancelled) and a detail view at `/app/rides/:id`. Admins get the same
detail view at `/admin/rentals/:id`, plus date‑range, cycle, station and status filters
with pagination.

Durations are computed by PostgreSQL from the stored `TIMESTAMPTZ` values —
`ended_at − started_at` for finished rides, `NOW() − started_at` for active ones, and
`NULL` when a timestamp is missing or inconsistent (never a negative or invented value).
The ride detail page re‑computes an active ride's elapsed time in the browser from the
server's start timestamp so it ticks live.

**The user id always comes from the verified JWT**, never from the request, so a student
cannot read another student's rides by passing an id.

### D — Maintenance management

Students report problems at `/app/report` (category, description, optional severity;
the cycle can be picked from a list, pre‑filled from a ride, or identified by its
printed QR code) and track them at `/app/reports`. Admins work through them at
`/admin/maintenance`.

Lifecycle: `OPEN → IN_PROGRESS → RESOLVED → CLOSED`, with reopening allowed from
`IN_PROGRESS` and `RESOLVED`. `CLOSED` is terminal. Invalid transitions are rejected
with **409**, and resolution notes are required to resolve or close a report.

**The safety workflow:**

- A `HIGH` or `CRITICAL` report places the cycle on a **safety hold**. If the cycle is
  parked it is moved to `MAINTENANCE` immediately; if it is out on a ride the rider is
  not interrupted, and the hold is applied when the cycle is returned (it is parked as
  `MAINTENANCE`, not `AVAILABLE`).
- `LOW`/`MEDIUM` reports are recorded for admin review and leave the cycle in service.
- While a safety hold exists, the cycle **cannot be rented** and **cannot be moved back
  to `AVAILABLE`** by any route — not through the rental flow, not through the return
  flow, and not by an admin status change.
- Resolving the report does **not** silently return the cycle to service; an admin puts
  it back explicitly once it is physically parked and ready.

Every one of these operations runs in a PostgreSQL transaction with the bicycle row
locked (`SELECT … FOR UPDATE`), so filing a report, starting a ride, returning a ride
and changing a status cannot interleave.

### E — Usage analytics

`/admin/analytics`, admin‑only, backed by `GET /api/analytics`. Every figure is a
PostgreSQL aggregate over the live tables. The page keeps two groups deliberately
apart:

- **Right now, and all time** — a fleet snapshot plus all‑time totals, *not* affected by
  the date filter.
- **Selected period** — only rides that started inside the chosen range.

Charts (Recharts): rides over time, trips by station, fleet by status, busiest hours,
and reported issues by severity; plus most‑used stations and most‑rented cycles.
Date presets and a custom range are provided, empty datasets render a labelled empty
state rather than a blank box, and every ratio guards against division by zero.

Day and hour buckets are computed in the application's reporting timezone
(`APP_TIMEZONE`), so "today" and "9am" mean the same thing in Node and in PostgreSQL
regardless of how the database session is configured.

### F — Software‑based geofencing

**CampusCycle has no GPS hardware on its bicycles.** There is no continuous real‑world
tracking in this phase, and the application does not pretend otherwise. Every location
it knows about was explicitly submitted to `POST /api/geofence/locations` and is stored
with its `source`; only `SIMULATED` is accepted, and `DEVICE` is rejected with a 422
until a real GPS/IoT integration exists. A student's browser location is never accepted
as a cycle's position — the endpoint is admin‑only and takes an explicit cycle id.

The boundary is a configurable polygon (`geofence_config`), tested with a ray‑casting
point‑in‑polygon check. When a submitted location falls outside it:

1. the violation is detected and recorded as a `geofence_events` row,
2. associated with the cycle (and the active ride, if any),
3. with the time and coordinates,
4. and surfaced on `/admin/geofence`,
5. while **repeated** out‑of‑bounds updates increment that alert's ping count and last
   known position instead of creating duplicates — enforced by a partial unique index,
6. and a cycle seen back inside records `returned_inside_at` but does **not** silently
   close the alert; an admin acknowledges or resolves it.

The admin page includes a clearly labelled demonstration panel for submitting simulated
positions. Electronic locking, GPS hardware and continuous tracking are explicitly out
of scope for this phase.

---

## Concurrency & Safety Design

Renting is the critical section — the design guarantees a cycle is never
double‑booked, even under simultaneous requests:

1. **Serializable unit of work** — `startRental` runs inside a single
   `withTransaction()` (BEGIN/COMMIT/ROLLBACK).
2. **Row‑level lock** — the target cycle is selected `FOR UPDATE` by its QR code, so a
   competing transaction blocks until the first commits.
3. **State re‑check under lock** — the cycle must still be `AVAILABLE`; otherwise the
   ride is rejected with a clear message.
4. **Database‑level invariants** — the two partial unique indexes
   (`uq_active_rental_per_user`, `uq_active_rental_per_bicycle`) are a belt‑and‑braces
   guarantee. If a race somehow slips through, PostgreSQL raises `23505`, which the
   service translates into a friendly `409 Conflict`.

The result: with two students scanning the same cycle at the same instant, **exactly
one** ride starts and the other receives a clean rejection.

---

## Testing

An automated **end‑to‑end** suite exercises the full system against a real database.
It resets the schema, re‑seeds, boots the Express app on an ephemeral port, and drives
the REST API with real HTTP requests.

```bash
cd backend
npm run test:e2e           # Phase 1 + regression
npm run test:e2e:phase2    # Phase 2 modules
npm run test:all           # both, in order
```

Both suites rebuild the database from `schema.sql` + `database/migrations/` before they
run, so **do not point them at a database whose data you care about**.

Covered Phase 1 scenarios:

- **A — Full rental lifecycle:** login → list stations → start ride (QR) → cycle becomes
  `IN_USE` → active ride visible → return → `COMPLETED` → cycle `AVAILABLE` at the
  return station.
- **B — Role‑based access control:** a student is denied admin endpoints (**403**); an
  unauthenticated request is denied (**401**).
- **C — Invalid rentals:** renting a `MAINTENANCE` cycle → **409**; an unknown QR → **404**.
- **D — Concurrency:** two students rent the same cycle simultaneously → exactly **one**
  success, one rejection.
- **E — Admin overview:** totals reflect the seeded fleet (20 cycles, 6 stations, 2 active rides).

Covered Phase 2 scenarios (`npm run test:e2e:phase2`):

- **F — Map & coordinates:** stations load from the backend; coordinates are validated
  (latitude 95 → 422, a latitude without a longitude → 422); availability matches a
  direct SQL count; the map and the list agree; an inactive station is still returned
  and marked `INACTIVE`.
- **G — Availability filters:** `?availability=` and `?sort=` behave; an unknown filter → 400.
- **H — Ride history:** a student sees only their own rides; another student's ride → 403;
  unknown id → 404; a non‑numeric id → 400; an admin can open any ride; durations are
  exact (a seeded 38‑minute ride reports 2280s); filters and pagination work.
- **I — Maintenance:** reports are stored as submitted; a `CRITICAL` report pulls a parked
  cycle out of service; the unsafe cycle cannot be rented (409) and cannot be forced back
  to `AVAILABLE` (409); resolving without notes → 422; `CLOSED` is terminal; a cycle
  reported mid‑ride is parked as `MAINTENANCE` on return.
- **J — Analytics:** figures match direct SQL counts; the chart series follow the
  requested range; lifetime figures ignore the filter; a reversed or unparseable date → 400.
- **K — Geofencing:** inside is accepted; outside opens an alert with time and
  coordinates; three breaches produce **one** alert with `ping_count = 3`; returning
  inside is recorded without closing it; acknowledge and resolve work; a resolved alert
  cannot be reopened; `DEVICE`‑sourced locations are refused.
- **L — Phase 2 RBAC:** every admin endpoint returns 403 for a student and 401 without a
  token, and no password hash, JWT secret or database credential appears in any response.

### Browser flow test (optional)

`frontend/tests/ui-flow.mjs` drives the real UI with Playwright: a student reports a
critical issue, the cycle disappears from "Find a Bicycle", an admin resolves it and is
offered the return‑to‑service action, then simulates a boundary breach and checks that a
repeat breach does not create a second alert. It is **not** wired into `npm test` and
Playwright is not a project dependency — run it only if you want it:

```bash
cd frontend
npm install --no-save playwright && npx playwright install chromium
# with the backend on :4000 and the frontend on :5175 already running
node tests/ui-flow.mjs
```

---

## Assumptions

- **Registration creates students only.** Admin accounts are provisioned via seed data
  (no self‑service admin signup — a deliberate privilege‑escalation guard).
- **A cycle in `IN_USE` has no station** (`station_id = NULL`) until it is returned.
- **Returns are never blocked by capacity.** A student must always be able to end a ride;
  capacity is enforced when an *admin* assigns cycles to a station, not on return.
- **QR code is the unlock key.** Each cycle has a unique QR; the backend validates it and
  the current status before starting a ride.
- **Distances/"nearby" are not geospatial** — the dashboard surfaces active stations
  rather than ranking them by distance from the student.
- **Station coordinates are approximate.** The seeded positions place the six demo
  stations inside the Thapar Institute campus (centre 30.3564 N, 76.3625 E) for
  development and demonstration. They are **not surveyed building positions**, and the
  geofence polygon is an approximation of the campus extent, not a legal property
  boundary. Both are documented in `database/seed-phase2.sql` and can be edited from the
  admin Stations screen or replaced via `PUT /api/geofence`.
- **All bicycle locations are simulated.** See the geofencing module above.

---

## Known Limitations

- No payment, pricing, or wallet — rides are still free.
- **No real GPS tracking.** Bicycle positions are simulated and admin‑submitted; the
  geofence is a software demonstration, not a tracking system.
- No machine‑learning demand prediction (deliberately deferred past Phase 2).
- Map tiles are fetched from OpenStreetMap, so the map needs internet access; without it
  the markers and boundary still render over a blank background.
- Analytics date ranges are capped at three years, and the admin ride list is paginated
  rather than exportable.
- No password reset / email verification flow.
- QR **camera** scanning uses the browser `BarcodeDetector` API where available; on
  unsupported browsers, manual QR entry is the fallback.
- Light theme only; no internationalization.

---

## Roadmap — Future Phases

### Phase 2 — Location, Maintenance & Analytics ✅ *implemented*
- Interactive campus map with station pins and live availability.
- Ride history with detail views, filters and pagination.
- Maintenance reporting, lifecycle management and the safety‑hold workflow.
- Usage analytics with database‑driven charts and date filtering.
- Software‑based campus geofencing with de‑duplicated violation alerts.

Still open from the original Phase 2 sketch:
- Geolocation‑based "nearest station" and turn‑by‑turn to the cycle.
- Reservations / holds with expiry.

### Phase 3 — Payments & Membership
- Ride pricing, wallets, and semester passes.
- Fare rules, penalties for late returns, and receipts.
- Student‑ID / SSO integration.

### Phase 4 — Operations & Intelligence
- Machine‑learning demand prediction and fleet‑rebalancing suggestions.
- IoT smart‑lock integration and genuine GPS tracking, replacing the simulated
  location source behind the existing `bicycle_location_pings.source` column.
- Heatmaps and forecasting on top of the Phase 2 analytics.

---

<p align="center"><em>CampusCycle · Phases 1–2 · Smart Campus Mobility</em></p>
