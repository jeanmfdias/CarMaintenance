# CarMaintenance Server

Node.js + Express + SQLite backend for the CarMaintenance app. Replaces Supabase
(Auth + Postgres + Storage). Designed so the existing Vue 3 frontend can swap its
API client off `@supabase/supabase-js` with no type changes.

## Stack

- Node.js 20+, TypeScript (ES2022 / NodeNext)
- Express 4
- `better-sqlite3` (single-file SQLite at `data/app.db`)
- `zod` request validation
- `jsonwebtoken` for sessions (stateless JWT, with optional revocation row)
- `nodemailer` for magic-link emails (logs to console in dev when SMTP is not set)
- `cors`, `helmet`, `morgan`, `multer`, `dotenv`
- Tests: `vitest` + `supertest`

## Quick start

```bash
cd server
cp .env.example .env
npm install
npm run migrate
npm run dev
```

Then `curl http://localhost:3001/health` should return `{"status":"ok"}`.

## Scripts

| Script             | What it does                                |
| ------------------ | ------------------------------------------- |
| `npm run dev`      | tsx watch on `src/index.ts`                 |
| `npm run build`    | tsc -> `dist/`                              |
| `npm start`        | run compiled output                         |
| `npm run migrate`  | apply any pending SQL migrations            |
| `npm run migrate:supabase` | one-off: copy data from Supabase into SQLite |
| `npm test`         | run vitest suite                            |

## Configuration

See `.env.example`. Required: `JWT_SECRET`. Defaults are dev-friendly.

## Docker

```bash
docker build -t carmaintenance-server ./server
docker run --rm -p 3001:3001 \
  -e JWT_SECRET=replace-me \
  -e PUBLIC_APP_URL=https://app.example.com \
  -e CORS_ORIGIN=https://app.example.com \
  -v carmaintenance-data:/app/data \
  carmaintenance-server
```

The container runs migrations on start and persists `data/app.db` and uploads
in `/app/data` (mount a named volume).

## Reverse proxy expectations

The frontend is served via nginx (see `infra/nginx.conf` at the repo root). Run
this server as a sibling service and add a proxy to nginx, e.g.:

```nginx
location /api/ {
  proxy_pass http://server:3001/api/;
  proxy_http_version 1.1;
  proxy_set_header Host $host;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
}

location /uploads/ {
  proxy_pass http://server:3001/uploads/;
}
```

## API surface (`/api/v1`)

All routes except `/auth/magic-link` and `/auth/verify` require
`Authorization: Bearer <jwt>`. Responses always have shape `{...}` for objects
or `[...]` for lists; errors are `{ error: { code, message, details? } }`.

### Auth

| Method | Path                | Body                | Notes                                        |
| ------ | ------------------- | ------------------- | -------------------------------------------- |
| POST   | `/auth/magic-link`  | `{ email }`         | Always 200, sends/logs magic link.           |
| POST   | `/auth/verify`      | `{ token }`         | Returns `{ access_token, user }`.            |
| POST   | `/auth/logout`      | -                   | Revokes session row. Limitation below.       |
| GET    | `/auth/me`          | -                   | Current user.                                |

**Session revocation:** JWT is stateless, but each successful verify also
inserts an `auth_sessions` row whose `id` is embedded in the JWT (`sid`). The
auth middleware checks for `revoked_at`. So `POST /auth/logout` is effective
on subsequent requests, with the caveat that any other client holding the same
JWT will also be logged out.

### Vehicles

- `GET    /vehicles`
- `POST   /vehicles`
- `GET    /vehicles/:id`
- `PATCH  /vehicles/:id`
- `DELETE /vehicles/:id`
- `POST   /vehicles/:id/photo` — multipart `file` field, jpeg/png/webp, max 8 MB. Updates `photo_url` to `/uploads/<user_id>/<vehicle_id>.<ext>`.
- `DELETE /vehicles/:id/photo`

### Odometer entries

- `GET    /vehicles/:id/odometer-entries`
- `POST   /vehicles/:id/odometer-entries`
- `DELETE /odometer-entries/:id`

### Maintenance records

- `GET    /vehicles/:id/maintenance-records`
- `POST   /vehicles/:id/maintenance-records`
- `GET    /maintenance-records/:id`
- `PATCH  /maintenance-records/:id`
- `DELETE /maintenance-records/:id`

### Fuel fillups

- `GET    /vehicles/:id/fuel-fillups`
- `POST   /vehicles/:id/fuel-fillups`
- `GET    /fuel-fillups/:id`
- `PATCH  /fuel-fillups/:id`
- `DELETE /fuel-fillups/:id`

`price_per_liter` is computed on read as `total_cost / liters`.

### Insurance policies

- `GET    /vehicles/:id/insurance-policies`
- `POST   /vehicles/:id/insurance-policies`
- `GET    /insurance-policies/:id`
- `PATCH  /insurance-policies/:id`
- `DELETE /insurance-policies/:id`

### Service providers

- `GET    /service-providers`
- `POST   /service-providers`
- `GET    /service-providers/:id`
- `PATCH  /service-providers/:id`
- `DELETE /service-providers/:id`

### Settings

- `GET /settings` — auto-creates a default row on first call.
- `PUT /settings` — body `{ locale?, default_reminder_lead_days? }`.

### File serving

- `GET /uploads/:userId/:filename` — auth-gated; only the owner can read.

## Auto side-effects

- Creating a fuel fillup or maintenance record with `odometer_km` updates
  the parent vehicle's `current_odometer` if higher, and inserts a mirrored
  `odometer_entries` row. This mirrors the behaviour the Vue stores currently
  perform client-side.

## Ownership / 404 strategy

For every `:id` route, if the row exists but does not belong to the caller,
the server returns **404 not_found** (not 403) to avoid leaking existence.

## Migrating from Supabase

A one-shot script copies all existing data from the legacy Supabase project
into the local SQLite DB. Run it once, after the schema migration has been
applied (`npm run migrate`).

### Prerequisites

- The Supabase **service-role** key. The anon key cannot read other users'
  rows because RLS blocks it; the script needs full read access.
- Both env vars set, either in `server/.env` or exported in your shell:

  ```bash
  SUPABASE_URL=https://<project-ref>.supabase.co
  SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
  ```

  The script fails with a friendly error if either is missing. These are only
  needed for the migration — never bake them into the runtime app config.

### Run

```bash
cd server
npm install
npm run migrate            # ensure SQLite schema exists
npm run migrate:supabase   # copy data
```

### What it does

- Pulls users from `auth.users` via the admin API (paginated, 1000/page) and
  inserts them into `users`. Users without an email are skipped with a warning.
- Pulls public tables in FK-safe order: `service_providers` and `vehicles`
  (depend only on users) -> `odometer_entries`, `maintenance_records`,
  `fuel_fillups`, `insurance_policies` -> `user_settings`.
- Preserves UUIDs and timestamps verbatim so foreign keys line up.
- Ignores `fuel_fillups.price_per_liter` — the API computes it on read.
- Coerces booleans (`reminder_sent`, `full_tank`) to SQLite 0/1.
- Wraps each table's insert loop in a single transaction.
- Prints `inserted / skipped / total` per table and final SQLite row counts.

### Idempotency

All inserts use `INSERT OR IGNORE` keyed on the primary key, so re-running the
script is safe — already-imported rows count as `skipped`. Updates made on the
SQLite side after a previous run are not overwritten.

### Vehicle photos (follow-up)

`vehicles.photo_url` rows are copied as-is (the URL string still points at
Supabase Storage). Pass `--photos` to download those files and rewrite the
column to a local `/uploads/<user_id>/<vehicle_id>.<ext>` path:

```bash
npm run migrate:supabase -- --photos
```

The flag is currently a stub — it logs a "not implemented" warning. The plan
is documented inline in `src/scripts/migrate-from-supabase.ts`. Treat photo
migration as a separate follow-up task.

## Frontend follow-up

The next task is to add `src/lib/api.ts` to the Vue app that mirrors the
existing `src/lib/supabase.ts` surface area. Endpoints to wire up:

- `auth.store.ts`: `POST /auth/magic-link`, `POST /auth/verify`, `POST /auth/logout`, `GET /auth/me`.
- `vehicles.store.ts`: `GET/POST /vehicles`, `PATCH/DELETE /vehicles/:id`, `POST /vehicles/:id/photo`.
- `odometer.store.ts`: `GET/POST /vehicles/:id/odometer-entries`, `DELETE /odometer-entries/:id`.
- `maintenance.store.ts`: `GET/POST /vehicles/:id/maintenance-records`, `GET/PATCH/DELETE /maintenance-records/:id`.
- `fuel.store.ts`: `GET/POST /vehicles/:id/fuel-fillups`, `GET/PATCH/DELETE /fuel-fillups/:id`.
- `insurance.store.ts`: `GET/POST /vehicles/:id/insurance-policies`, `GET/PATCH/DELETE /insurance-policies/:id`.
- `providers.store.ts`: `GET/POST /service-providers`, `GET/PATCH/DELETE /service-providers/:id`.
- `settings.store.ts`: `GET/PUT /settings`.

The frontend `src/types/index.ts` shapes are honoured 1:1 by the API.
