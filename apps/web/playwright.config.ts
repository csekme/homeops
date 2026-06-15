import { defineConfig, devices } from '@playwright/test';

/**
 * E2E config (plan §9/§13). Drives the REAL dev stack through the single-origin proxy at
 * https://homeops.localhost, so cookies/HTTPS/SameSite behave exactly like production.
 *
 * Prerequisites (the full stack must be up — see apps/web/e2e/README.md):
 *   docker compose up -d                                   # db + mailpit + nginx
 *   (cd backend && uv run flask --app app run -p 8080)     # host backend
 *   pnpm --filter @homeops/web dev                         # host frontend :5173
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  timeout: 30_000,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'https://homeops.localhost',
    // mkcert root may not be in the browser's trust store on every machine/CI.
    ignoreHTTPSErrors: true,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
