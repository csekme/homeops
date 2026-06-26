# HomeOps — Developer Experience (dev setup)

Single-origin HTTPS dev stack (spec §5.7): everything runs behind
`https://homeops.localhost`. Postgres + Mailpit + nginx run in Docker; the **web frontend**
(Vite `:5173`) and **backend** (Flask `:8080`) run on the host for fast HMR and native
debugging. nginx terminates TLS and routes `/api/` → backend, `/` → frontend. The
**mobile app** (`apps/mobile`, Expo) runs via Metro and talks to the same backend over the
LAN (see [Mobile (Expo)](#mobile-expo)).

## Prerequisites
- Docker + Docker Compose
- Node ≥ 22 and **pnpm** 10 (`corepack enable`)
- **uv** (Python toolchain) — provisions Python 3.12 automatically
- **mkcert** (locally-trusted TLS certs)
- _Mobile only:_ the **Expo Go** app on a phone, or an **iOS Simulator** (Xcode) /
  **Android emulator** (Android Studio)

## One-time setup (per machine)

```bash
# 1) Trusted local TLS for the dev domain (spec §5.7)
mkcert -install
cd certs && mkcert homeops.localhost && cd ..
#   → certs/homeops.localhost.pem + homeops.localhost-key.pem (gitignored)

# 2) Map the dev domain to loopback (most browsers resolve *.localhost already,
#    but add it for full compatibility):
echo "127.0.0.1 homeops.localhost" | sudo tee -a /etc/hosts

# 3) Environment file (no secrets committed)
cp .env.example .env

# 4) Install JS deps (one lockfile for the whole monorepo)
pnpm install

# 5) Backend deps + DB schema (Postgres must be up — see daily loop)
cd backend && uv sync && uv run alembic upgrade head && cd ..
```

`alembic upgrade head` runs as the privileged owner role and, as part of the first
migration, creates the **non-privileged `homeops_app`** login role (NOSUPERUSER,
NOBYPASSRLS) that the app connects with — so PostgreSQL RLS is actually enforced
(spec §7.2). It also enables RLS + seeds the role catalogue.

## Daily loop (web)

```bash
docker compose up -d                          # db + mailpit + nginx
(cd backend && uv run flask --app app run -p 8080)   # host backend  (terminal 1)
pnpm --filter @homeops/web dev                       # host frontend (terminal 2)
```

Then open **https://homeops.localhost** — trusted cert, working Vite HMR through the
proxy, real `Secure`/`HttpOnly`/`SameSite` cookies (same-origin, no CORS).

| What | Where |
|------|-------|
| App | https://homeops.localhost |
| API | https://homeops.localhost/api |
| OpenAPI JSON | https://homeops.localhost/api/openapi.json |
| Swagger UI | https://homeops.localhost/api/docs |
| ReDoc | https://homeops.localhost/api/redoc |
| Mailpit (caught emails) | http://localhost:8025 |

> Interactive API docs are dev-only — disabled in production (`ENABLE_API_DOCS=false`).

## Mobile (Expo)

The mobile app (`apps/mobile`) is a separate client that reuses the shared packages
(`@homeops/api-client`, `@homeops/validation`, `@homeops/i18n`, …). It does **not** go
through the nginx proxy at `homeops.localhost` — a phone/emulator can't resolve that name,
nor does it trust the mkcert root CA — so in dev it talks **plain HTTP straight to the Flask
backend**, using the backend's **bearer token transport** (refresh token in the body +
`expo-secure-store`, no cookies/CSRF; React Native isn't subject to CORS). Details:
[`apps/mobile/README.md`](../apps/mobile/README.md).

```bash
# 1) Run the backend bound to the LAN (the default 127.0.0.1 isn't reachable from a device):
(cd backend && uv run flask --app app run -p 8080 --host 0.0.0.0)

# 2) Point the app at it (in apps/mobile/.env so it survives restarts), then start Metro.
#    -c clears the cache: EXPO_PUBLIC_* vars are inlined at bundle time.
echo "EXPO_PUBLIC_API_URL=http://<your-LAN-IP>:8080/api" > apps/mobile/.env
pnpm --filter @homeops/mobile start -c
#   press i  → iOS Simulator (can also use http://localhost:8080/api)
#   press a  → Android emulator (use http://10.0.2.2:8080/api)
#   or scan the QR with Expo Go on a physical device (use the machine's LAN IP)
```

- Find your LAN IP with `ipconfig getifaddr en0`. It changes with DHCP — if login starts
  failing after a network change, re-check it and update `.env` (then restart with `-c`).
- **`EXPO_PUBLIC_API_URL`** must be an absolute URL the device can reach. `EXPO_PUBLIC_*`
  vars are baked into the bundle, so editing `.env` requires restarting the dev server.
- **Production parity (HTTPS):** to test against the nginx TLS path instead, regenerate the
  cert with the current IP — `cd certs && mkcert -cert-file homeops.localhost.pem
  -key-file homeops.localhost-key.pem homeops.localhost <your-LAN-IP>` — restart nginx, and
  install `$(mkcert -CAROOT)/rootCA.pem` as a trusted CA on the device (iOS: install profile
  → Certificate Trust Settings; Android needs a user-CA network-security exception). Then
  use `https://<your-LAN-IP>/api`.
- **Activation deep link:** open the Mailpit link as `homeops://activate/<token>`.

## Poking at the database (the RLS gotcha)

Tenant tables (`households`, `memberships`, `invitations`, and future content tables) have
**`FORCE ROW LEVEL SECURITY`**. The policy is:

```sql
current_setting('app.bypass_tenant', true) = 'on'
OR <discriminator> = NULLIF(current_setting('app.current_household', true), '')::uuid
```

So if you connect as the **app role `homeops_app`** and just run `SELECT * FROM households`,
you get **zero rows** — not because the table is empty, but because neither GUC is set, so
the policy filters *everything*. This trips people up after archiving: a soft delete only
sets `deleted_at` (the row is still there), and even live rows are hidden without the GUCs.

Two ways to look around:

```bash
# A) As the dev SUPERUSER (POSTGRES_USER=homeops). Superusers bypass RLS — even FORCE —
#    so you see every row, including soft-deleted ones. Easiest for spelunking.
docker compose exec db psql -U homeops -d homeops -c \
  "SELECT id, name, deleted_at FROM households;"

# B) As the app role homeops_app (how the backend connects). RLS is enforced, so opt out
#    explicitly for the query — mirrors the backend's no-tenant mode (session_scope bypass).
docker compose exec db psql -U homeops_app -d homeops <<'SQL'
SET app.bypass_tenant = 'on';
SELECT id, name, deleted_at FROM households;
SELECT * FROM memberships;
SQL
```

Scope to a single tenant instead of full bypass (what a request actually does):

```sql
SET app.current_household = '<household-uuid>';   -- only that household's rows appear
SELECT * FROM memberships;                          -- (still hides other tenants)
```

Notes:
- `deleted_at IS NOT NULL` = **archived** (soft delete). RLS does **not** filter on it; the
  app layer (`households_repo` / `users_repo.list_memberships`) is what hides archived rows
  from `/me`, the household list, and active-household selection.
- `SET` lasts for the connection; inside a transaction use `SET LOCAL`.
- `homeops_app` is `NOSUPERUSER NOBYPASSRLS` on purpose — that's what makes the RLS tests
  meaningful. Don't grant it BYPASSRLS to "fix" a query; set the GUC instead.

## Quality gates (run before pushing — mirrors CI)

```bash
# Frontend (web)
pnpm turbo run lint typecheck test build

# Mobile (Expo) — type-check + a full Metro bundle catches resolution/config breakage
pnpm --filter @homeops/mobile typecheck
pnpm --filter @homeops/mobile exec expo export --platform ios --output-dir /tmp/homeops-mobile-bundle

# Backend
cd backend
uv run ruff check . && uv run ruff format --check .
uv run mypy app
uv run pytest                 # unit + integration (Testcontainers spins up Postgres 16)
uv run pip-audit

# API contract: live spec must match the pinned snapshot
#   (with the backend running on :8080)
curl -s http://localhost:8080/api/openapi.json > /tmp/live.json
pnpm codegen:lint             # Spectral lint of openapi.snapshot.json
```

## Auth flow smoke test (manual)
1. Register at `/register` → an activation email lands in Mailpit (`:8025`).
2. Open the activation link → account becomes `ACTIVE` (login before this returns 403).
3. Log in → access token in the response body (memory), refresh + CSRF cookies set.
4. The token auto-refreshes on 401 (single-flight); replaying a consumed refresh token
   revokes the whole family (reuse detection).

## Reset the database
```bash
docker compose down -v        # drops the pgdata volume
docker compose up -d db
(cd backend && uv run alembic upgrade head)
```
