# HomeOps Mobile (Expo)

React Native client for HomeOps, built per [`docs/phase0-mobile.md`](../../docs/phase0-mobile.md).
Reaches functional parity with the web app's Phase 0 auth: **register → email activation →
login (+ optional 2FA) → session → logout**.

## Stack

- **Expo SDK 54** (managed) + **expo-router** (file-based routing)
- **gluestack-ui v4** + **NativeWind** (Tailwind for RN)
- **expo-secure-store** for the refresh token (OS keychain/keystore)
- Shared packages reused verbatim: `@homeops/api-client`, `@homeops/validation`,
  `@homeops/i18n`, `@homeops/types`, `@homeops/tokens`, `@homeops/core`
- `react-hook-form` + `zod` (shared schemas) + `react-i18next`

## How auth differs from web (token transport)

The web app keeps the refresh token in an **HttpOnly cookie** (+ CSRF). A mobile app can't,
so it uses the backend's **bearer transport** (`docs/phase0-mobile.md` §3/§4):

- Every request sends `X-Auth-Transport: bearer`.
- The refresh token travels in the JSON **body** and is stored in **expo-secure-store**.
- No cookies, no CSRF.

This is configured once in [`lib/api.ts`](lib/api.ts) via `configureApiClient(...)` against the
seam in `@homeops/api-client`. The access token stays in memory; on boot a silent
`refreshAccessToken()` rehydrates it from secure-store ([`lib/auth.tsx`](lib/auth.tsx)).

## Configuration

The API base URL **must be absolute** (a device can't reach the web app's relative `/api`).
Default: `https://homeops.localhost/api`. Override with an env var:

```bash
# .env (or shell) — note the EXPO_PUBLIC_ prefix is required for client-side env
EXPO_PUBLIC_API_URL=https://192.168.1.50/api   # your machine's LAN IP behind the proxy
# Android emulator reaching a host-side proxy:
# EXPO_PUBLIC_API_URL=http://10.0.2.2/api
```

The dev reverse proxy uses a self-signed cert; a physical device must trust it (or point
`EXPO_PUBLIC_API_URL` at an http endpoint reachable from the device).

## Run

```bash
pnpm install                      # from the repo root (uses the hoisted node-linker)
pnpm --filter @homeops/mobile start   # then press i / a, or scan with Expo Go
```

Deep link for activation (mirrors the email link): `homeops://activate/<token>`.

## Routes

```
app/
  _layout.tsx              providers + boot splash
  (auth)/                  public; redirects to / when already signed in
    login/index.tsx        email + password
    login/verify.tsx       2FA / recovery-code step (challenge token held in memory)
    register.tsx           sign up → "check your email"
    activate/[token].tsx   deep-link target
  (app)/                   protected; redirects to /login when signed out
    index.tsx              dashboard placeholder + logout
```

## Theme

`components/ui/gluestack-ui-provider/config.ts` holds the HomeOps palette as the mobile
mirror of the web design tokens — the OKLCH values in `@homeops/tokens`
(`packages/tokens/src/theme.css`) converted to sRGB so web and native look identical.

## Verification

- `pnpm --filter @homeops/mobile typecheck` — type-checks app + shared packages.
- `pnpm --filter @homeops/mobile exec expo export --platform ios` — full Metro bundle.
- Backend mobile-transport tests: `backend/tests/integration/test_auth_flow.py`
  (`test_mobile_*`) — require Docker (testcontainers).
- End-to-end (manual): register → open the Mailpit activation link as
  `homeops://activate/<token>` → activate → login → (2FA) → dashboard → logout.
