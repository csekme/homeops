# HomeOps — Developer Experience (dev setup)

Single-origin HTTPS dev stack (spec §5.7): everything runs behind
`https://homeops.localhost`. Postgres + Mailpit + nginx run in Docker; the **frontend**
(Vite `:5173`) and **backend** (Flask `:8080`) run on the host for fast HMR and native
debugging. nginx terminates TLS and routes `/api/` → backend, `/` → frontend.

## Prerequisites
- Docker + Docker Compose
- Node ≥ 22 and **pnpm** 10 (`corepack enable`)
- **uv** (Python toolchain) — provisions Python 3.12 automatically
- **mkcert** (locally-trusted TLS certs)

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

## Daily loop

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

## Quality gates (run before pushing — mirrors CI)

```bash
# Frontend
pnpm turbo run lint typecheck test build

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
