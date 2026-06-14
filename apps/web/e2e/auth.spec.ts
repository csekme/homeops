import { expect, test } from '@playwright/test';

import { waitForActivationToken } from './mailpit';

/**
 * Critical-path auth flow (plan §9/§13):
 * register → activation email (Mailpit) → activate → login → session survives reload.
 *
 * Selectors use stable input ids / submit type rather than localized labels, so the test
 * is language-independent (the app defaults to HU).
 */
const PASSWORD = 'correct horse battery staple';

test('register → activate → login → stays signed in after reload', async ({ page, request }) => {
  const email = `e2e_${Date.now()}@example.com`;

  // 1) Register
  await page.goto('/register');
  await page.locator('#displayName').fill('E2E User');
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(PASSWORD);
  await page.locator('form button[type="submit"]').click();

  // Generic "check your email" confirmation (HU default / EN).
  await expect(page.getByText(/aktiváló|activation email/i)).toBeVisible();

  // 2) Pull the activation token out of Mailpit and visit the link.
  const token = await waitForActivationToken(request, email);
  await page.goto(`/activate/${token}`);
  await expect(page.getByText(/sikeresen aktiválva|has been activated/i)).toBeVisible();

  // 3) Log in.
  await page.goto('/login');
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(PASSWORD);
  await page.locator('form button[type="submit"]').click();

  // Landed in the authenticated shell (no longer on /login).
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText('HomeOps')).toBeVisible();

  // 4) A browser reload must NOT log the user out (silent boot refresh rehydrates).
  await page.reload();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText('HomeOps')).toBeVisible();
  await expect(page).not.toHaveURL(/\/login/);
});

test('login before activation is rejected', async ({ page, request }) => {
  const email = `e2e_pending_${Date.now()}@example.com`;

  await page.goto('/register');
  await page.locator('#displayName').fill('Pending User');
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(PASSWORD);
  await page.locator('form button[type="submit"]').click();
  await expect(page.getByText(/aktiváló|activation email/i)).toBeVisible();

  // Do NOT activate. Logging in must fail with the "not activated" message.
  await page.goto('/login');
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(PASSWORD);
  await page.locator('form button[type="submit"]').click();

  await expect(page.getByText(/nincs aktiválva|not activated/i)).toBeVisible();
  await expect(page).toHaveURL(/\/login/);

  // Sanity: the activation email did arrive (proves the Mailpit pipeline).
  await waitForActivationToken(request, email);
});
