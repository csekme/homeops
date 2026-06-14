/**
 * E2E config (plan §9/§13). Drives the REAL dev stack through the single-origin proxy at
 * https://homeops.localhost, so cookies/HTTPS/SameSite behave exactly like production.
 *
 * Prerequisites (the full stack must be up — see apps/web/e2e/README.md):
 *   docker compose up -d                                   # db + mailpit + nginx
 *   (cd backend && uv run flask --app app run -p 8080)     # host backend
 *   pnpm --filter @homeops/web dev                         # host frontend :5173
 */
declare const _default: import("@playwright/test").PlaywrightTestConfig<{}, {}>;
export default _default;
