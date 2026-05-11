# Infrastructure

How to run the CarMaintenance stack locally and on the home VPS.

## Layout

- `docker-compose.yml` — three services: `frontend`, `backend`, `proxy`.
- `Dockerfile` (root) — builds the Vue app, served by nginx in `frontend`.
- `infra/nginx.conf` — config for the **frontend's internal nginx** (SPA + PWA).
- `infra/proxy.conf` — config for the **front-of-stack nginx** that fans out
  `/api/` and `/uploads/` to the backend, everything else to `frontend`.
- `server/Dockerfile` — Node + Express + SQLite backend. Persists data in the
  named volume `carm_data` mounted at `/app/data`.
- `Makefile` — wraps the common operations. Run `make help` for the full list.

The split between `nginx.conf` and `proxy.conf` is intentional: the frontend
image is unchanged from the previous prod setup (so existing deployments keep
working), and the new front-of-stack proxy lives next to it.

## First-time setup

```bash
cp server/.env.example server/.env   # edit JWT_SECRET, SMTP, PUBLIC_APP_URL...
cp .env.example .env                 # edit only if you need non-defaults
make up                               # build + start frontend, backend, proxy
make migrate                          # apply backend SQL migrations
```

The app is then reachable at `http://localhost:8080` (override with
`PROXY_PORT=80`). Backend health: `http://localhost:8080/health`.

## One-shot Supabase import

After provisioning, copy your existing Supabase data into SQLite:

1. Edit `server/.env` and add:
   ```
   SUPABASE_URL=https://<project-ref>.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
   ```
2. `make migrate-supabase` — runs the importer inside the running container.
   The Make target fails fast if either var is missing.
3. Remove the two keys from `server/.env` once the import is verified — they
   are not needed at runtime.

## Backup and restore

```bash
make backup                                  # ./backups/<UTC-timestamp>/
make restore FROM=./backups/2026-05-05T12-00-00Z         # interactive prompt
make restore FROM=./backups/...  CONFIRM=1               # non-interactive
```

`backup` works whether the stack is up or down — it copies from the
`carm_data` volume via a throwaway alpine container. `restore` stops the
backend, replaces the volume contents, then restarts the backend.

## Deploying to the VPS

Defaults: `DEPLOY_HOST=h61user@192.168.100.63`, `DEPLOY_PATH=~/CarMaintenance`.

```bash
make deploy                       # rsync repo + docker compose up + migrate
make deploy-logs                  # tail remote logs
make remote-shell                 # SSH into the deploy path
```

Override either variable inline: `make deploy DEPLOY_HOST=user@host`.

The deploy excludes `node_modules`, `dist`, `backups`, and `.git`. SSH key
auth must already be configured for `$DEPLOY_HOST`.

## Destroying local state

```bash
make clean CONFIRM=1              # removes containers AND the data volume
```
