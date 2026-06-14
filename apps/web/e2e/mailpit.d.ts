import type { APIRequestContext } from '@playwright/test';
/**
 * Poll the Mailpit REST API for the activation email sent to `email` and extract the
 * single-use token from its `/activate/<token>` link (plan §9 — E2E reads the link from
 * Mailpit instead of a real inbox).
 */
export declare function waitForActivationToken(api: APIRequestContext, email: string, timeoutMs?: number): Promise<string>;
