# 🚲 CampusCycle — Smart Campus Bicycle Sharing & Mobility Management

CampusCycle is a full‑stack web application for running a **campus bicycle‑sharing
service**. Students find and unlock cycles by scanning a QR code, ride between
docking stations, and return the cycle at their destination — while administrators
manage the fleet, stations, and monitor live usage from a dedicated console.

This repository contains **Phase 1** — the core end‑to‑end rental system.

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
13. [Testing](#testing)
14. [Assumptions](#assumptions)
15. [Known Limitations](#known-limitations)
16. [Roadmap — Future Phases](#roadmap--future-phases)

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
│   │   ├── utils/           # ApiError, validators, constants, asyncHandler
│   │   ├── middleware/      # authenticate, authorize(role), error handler
│   │   ├── models/          # data access (users, stations, bicycles, rentals)
│   │   ├── services/        # business logic (auth, rental, bicycle, station, stats)
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
│   ├── schema.sql           # tables, constraints, indexes, triggers
│   └── seed.sql             # demo data (users, stations, bicycles, rentals)
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
npm run db:setup             # runs schema.sql then seed.sql
cd ..
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
npm run test:e2e
```

Covered scenarios:

- **A — Full rental lifecycle:** login → list stations → start ride (QR) → cycle becomes
  `IN_USE` → active ride visible → return → `COMPLETED` → cycle `AVAILABLE` at the
  return station.
- **B — Role‑based access control:** a student is denied admin endpoints (**403**); an
  unauthenticated request is denied (**401**).
- **C — Invalid rentals:** renting a `MAINTENANCE` cycle → **409**; an unknown QR → **404**.
- **D — Concurrency:** two students rent the same cycle simultaneously → exactly **one**
  success, one rejection.
- **E — Admin overview:** totals reflect the seeded fleet (20 cycles, 6 stations, 2 active rides).

---

## Assumptions

- **Registration creates students only.** Admin accounts are provisioned via seed data
  (no self‑service admin signup — a deliberate privilege‑escalation guard).
- **A cycle in `IN_USE` has no station** (`station_id = NULL`) until it is returned.
- **Returns are never blocked by capacity.** A student must always be able to end a ride;
  capacity is enforced when an *admin* assigns cycles to a station, not on return.
- **QR code is the unlock key.** Each cycle has a unique QR; the backend validates it and
  the current status before starting a ride.
- **Distances/"nearby" are not geospatial** in Phase 1 — the dashboard simply surfaces
  active stations. Real proximity is a Phase 2 concern.

---

## Known Limitations

- No payment, pricing, or wallet — rides are free in Phase 1.
- No live map / GPS tracking of cycles in transit.
- No password reset / email verification flow.
- QR **camera** scanning uses the browser `BarcodeDetector` API where available; on
  unsupported browsers, manual QR entry is the fallback.
- Light theme only; no internationalization.

---

## Roadmap — Future Phases

### Phase 2 — Location & Discovery
- Interactive campus map with station pins and live availability.
- Geolocation‑based "nearest station" and turn‑by‑turn to the cycle.
- Reservations / holds with expiry.

### Phase 3 — Payments & Membership
- Ride pricing, wallets, and semester passes.
- Fare rules, penalties for late returns, and receipts.
- Student‑ID / SSO integration.

### Phase 4 — Operations & Intelligence
- Maintenance scheduling and IoT smart‑lock integration.
- Fleet‑rebalancing suggestions from demand analytics.
- Admin dashboards with usage trends, heatmaps, and forecasting.

---

<p align="center"><em>CampusCycle · Phase 1 · Smart Campus Mobility</em></p>
