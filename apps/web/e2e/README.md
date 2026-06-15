# Web E2E (Playwright)

End-to-end tests that drive the **real dev stack** through the single-origin HTTPS proxy
(`https://homeops.localhost`), so cookies / HTTPS / SameSite / CSRF behave like production.

## One-time
```bash
pnpm install
pnpm --filter @homeops/web test:e2e:install   # downloads the Chromium browser
```

## Run
Bring the full stack up (three terminals or backgrounded), then run the test:
```bash
# 1) infra
docker compose up -d                                   # db + mailpit + nginx

# 2) backend (host)
(cd backend && uv run flask --app app run -p 8080)

# 3) frontend (host)
pnpm --filter @homeops/web dev                          # :5173

# 4) the E2E suite
pnpm --filter @homeops/web test:e2e
```

## What it covers (`auth.spec.ts`)
- **register → activate → login → reload**: registers a unique user, reads the activation
  link from the **Mailpit REST API**, activates, logs in, and asserts the session
  **survives a browser reload** (silent boot refresh).
- **login-before-activation is rejected**: a freshly registered (PENDING) user cannot log
  in and sees the "not activated" message; confirms the activation email was delivered.

Override targets with env vars: `E2E_BASE_URL` (default `https://homeops.localhost`),
`MAILPIT_BASE` (default `http://localhost:8025`).
