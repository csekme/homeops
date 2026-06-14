import type { APIRequestContext } from '@playwright/test';

const MAILPIT_BASE = process.env.MAILPIT_BASE ?? 'http://localhost:8025';

/**
 * Poll the Mailpit REST API for the activation email sent to `email` and extract the
 * single-use token from its `/activate/<token>` link (plan §9 — E2E reads the link from
 * Mailpit instead of a real inbox).
 */
export async function waitForActivationToken(
  api: APIRequestContext,
  email: string,
  timeoutMs = 15_000,
): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const search = await api.get(
      `${MAILPIT_BASE}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`,
    );
    if (search.ok()) {
      const data = (await search.json()) as { messages?: Array<{ ID: string }> };
      const id = data.messages?.[0]?.ID;
      if (id) {
        const message = await api.get(`${MAILPIT_BASE}/api/v1/message/${id}`);
        const body = (await message.json()) as { Text?: string; HTML?: string };
        const match = `${body.Text ?? ''}${body.HTML ?? ''}`.match(
          /\/activate\/([A-Za-z0-9_-]+)/,
        );
        if (match) return match[1]!;
      }
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`No activation email for ${email} within ${timeoutMs}ms`);
}
