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

## Mobile app (Expo / React Native) — `apps/mobile`

The mobile app reaches the **same backend** as the web, but a phone/emulator **cannot**
resolve `homeops.localhost` and isn't behind the nginx proxy. So the mobile client talks to
the backend over a host-reachable HTTPS URL and uses a different transport: refresh token in
`expo-secure-store` + request body (not cookies), signalled by the `X-Client-Type: mobile`
header (plan §M.4–M.8). Access token stays in memory; on cold start a silent refresh
rehydrates it.

### Extra prerequisites
- **Expo Go** app on a physical device (App Store / Play Store), **or** the iOS Simulator
  (Xcode) / Android Emulator (Android Studio).
- The backend must be reachable from the device over **HTTPS with a trusted cert**.

### One-time mobile setup
```bash
cd apps/mobile
cp .env.example .env          # then edit EXPO_PUBLIC_API_BASE (origin only, no /api)
```
`EXPO_PUBLIC_API_BASE` is the backend **origin** (e.g. `https://192.168.1.10`); the app
appends `/api` itself.

### Make the backend reachable from the device

Pick **one** of these. The device must trust the TLS cert, so plain `homeops.localhost`
won't work as-is.

**Option A — LAN IP + mkcert (recommended on a home network).**
```bash
# 1) Find your host LAN IP
ipconfig getifaddr en0            # macOS Wi-Fi (en1 for some setups)

# 2) Re-issue the dev cert WITH the LAN IP as a SAN, keeping the filenames nginx
#    already expects (reverse-proxy/nginx.conf → homeops.localhost{,-key}.pem):
cd certs && mkcert -cert-file homeops.localhost.pem -key-file homeops.localhost-key.pem \
  homeops.localhost 192.168.1.10 && cd ..
docker compose restart nginx     # pick up the regenerated cert

# 3) Trust the mkcert ROOT CA on the device
mkcert -CAROOT                    # prints the folder holding rootCA.pem
#   iOS: AirDrop/email rootCA.pem → install profile → Settings ▸ General ▸ About ▸
#        Certificate Trust Settings ▸ enable full trust.
#   Android: push rootCA.pem → Settings ▸ Security ▸ Install a certificate ▸ CA cert.

# 4) In apps/mobile/.env:
#   EXPO_PUBLIC_API_BASE=https://192.168.1.10
```

**Option B — HTTPS tunnel (works off any network, no cert juggling).**
Expose the backend through a tunnel that provides its own trusted HTTPS cert (e.g.
`cloudflared tunnel --url http://localhost:8080`), then set
`EXPO_PUBLIC_API_BASE=https://<your-tunnel-host>` in `apps/mobile/.env`.

**Simulator/emulator shortcuts** (no device cert needed):
- **iOS Simulator** shares the host network and trusts the host keychain after
  `mkcert -install` — `EXPO_PUBLIC_API_BASE=https://homeops.localhost` works directly.
- **Android Emulator** reaches the host at `10.0.2.2`; issue a cert for that name
  (`mkcert 10.0.2.2`) and set `EXPO_PUBLIC_API_BASE=https://10.0.2.2`.

### Run it
```bash
# Backend + infra running as in the daily loop above, then:
pnpm --filter @homeops/mobile start      # starts Metro + prints a QR code

# In the Metro terminal:
#   i  → open iOS Simulator     a → open Android Emulator
#   or scan the QR with Expo Go on a physical device (same Wi-Fi as the host)
```

### Mobile auth smoke test (manual)
1. **Register** on the login screen → "check your email"; the activation email lands in
   **Mailpit** (`:8025`).
2. **Activate**: the email link points at the *web* origin, so on mobile either
   - open `homeops://activate/<token>` (deep link), or
   - copy the token from the Mailpit message and paste it on the **Activate** screen
     (dev fallback, plan §8.5).
3. **Log in** → lands in the tab shell. For a 2FA account you get the **verify** step
   (6-digit code or a recovery code).
4. **Cold start**: kill and reopen the app → splash → silent refresh from secure-store →
   straight back into the shell (no re-login).
5. **2FA**: Settings ▸ Security ▸ Enable → scan the QR / copy the key → confirm → save the
   one-time recovery codes; disable/regenerate require the password.
6. **Logout** (avatar menu) → back to login; the secure-store refresh token is wiped.

### Mobile quality gates (mirrors CI — run before pushing)
```bash
# From repo root, all workspaces incl. mobile:
pnpm turbo run typecheck lint test

# Or just the mobile package:
pnpm --filter @homeops/mobile typecheck
pnpm --filter @homeops/mobile lint
pnpm --filter @homeops/mobile test       # jest-expo RN component tests
```

> The native **EAS build** and **Detox** E2E are gated/Phase-later (plan §12); Phase 0
> verifies on Expo Go / the dev client.

### UI: gluestack-ui v3
The mobile UI uses **gluestack-ui v3** (NativeWind v4 under the hood) — the RN counterpart of
shadcn on web. Components are vendored into `apps/mobile/src/components/ui/` via the CLI:
```bash
cd apps/mobile
npx gluestack-ui@latest add <component>     # e.g. button, input, actionsheet
```
- The brand color (`primary`) is set to the HomeOps blue (`#2563eb`, from `@homeops/tokens`)
  in `src/components/ui/gluestack-ui-provider/config.ts`.
- Light/dark follows the theme context: `GluestackUIProvider mode={theme}` drives NativeWind's
  color scheme (see `app/_layout.tsx`).
- Thin app-specific adapters live in `src/components/`: `form-field.tsx` (react-hook-form ↔
  `FormControl`+`Input`) and `code-input.tsx` (segmented TOTP entry).
- Vendored `src/components/ui/**` is lint-ignored (CLI-generated).

### Troubleshooting
- **Use `pnpm`, never `npm`/`yarn`.** This is a pnpm workspace; `npm install` corrupts the
  layout. After pulling dep changes run `pnpm install` from the repo root.
- Metro needs a hoisted `node_modules` (root `.npmrc` → `shamefully-hoist=true`) and a
  resolver shim for the shared packages' `.js` import extensions
  ([apps/mobile/metro.config.js](../apps/mobile/metro.config.js)). If Metro reports a module
  it "could not be found", re-run `pnpm install` and `npx expo start -c` (clears the cache).
- Sanity-check the toolchain anytime with `cd apps/mobile && npx expo-doctor`.
- **Don't press `w` (web target).** `apps/mobile` is native-only — it uses
  `expo-secure-store` (Keychain/Keystore), which has no web implementation, so a web bundle
  errors on `react-native-web` (and would crash even if added). Use `i` / `a` / Expo Go. The
  browser build of HomeOps is the separate `apps/web`.

## Reset the database
```bash
docker compose down -v        # drops the pgdata volume
docker compose up -d db
(cd backend && uv run alembic upgrade head)
```
