import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { apiFetch, ApiRequestError, configureApiClient } from './http';
import {
  clearAccessToken,
  getAccessToken,
  isAccessTokenExpiring,
  setAccessToken,
  setOnSessionExpired,
} from './token-store';

/* ---------------------------------------------------------------- helpers */

const b64url = (obj: unknown): string =>
  btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/** Build an unsigned JWT whose `exp` is `secondsFromNow` away (the client only reads exp). */
function makeJwt(secondsFromNow: number): string {
  const exp = Math.floor(Date.now() / 1000) + secondsFromNow;
  return `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url({ sub: 'u1', exp })}.sig`;
}

interface FakeResponse {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
  text: () => Promise<string>;
}

const res = (status: number, body: unknown): FakeResponse => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
  text: async () => JSON.stringify(body),
});

/** A routing fetch mock. `meStatuses` lets a test return 401 then 200 across retries. */
function installFetch(opts: {
  refreshStatus: number;
  refreshToken?: string;
  meStatuses?: number[]; // consumed in order; defaults to always 200
}) {
  const calls: Array<{ url: string; headers: Record<string, string> }> = [];
  let meIdx = 0;
  const fetchMock = vi.fn(async (url: string, init?: { headers?: Record<string, string> }) => {
    const headers = init?.headers ?? {};
    calls.push({ url, headers });
    if (url.endsWith('/auth/refresh')) {
      if (opts.refreshStatus !== 200) return res(opts.refreshStatus, { error: { message: 'no' } });
      return res(200, { access_token: opts.refreshToken ?? makeJwt(900), token_type: 'Bearer' });
    }
    if (url.endsWith('/auth/me')) {
      const status = opts.meStatuses?.[meIdx++] ?? 200;
      if (status !== 200) return res(status, { error: { message: 'unauthorized' } });
      return res(200, { id: 'u1', seenToken: headers['Authorization'] ?? null });
    }
    return res(200, {});
  });
  vi.stubGlobal('fetch', fetchMock);
  return {
    calls,
    refreshCalls: () => calls.filter((c) => c.url.endsWith('/auth/refresh')),
    meCalls: () => calls.filter((c) => c.url.endsWith('/auth/me')),
  };
}

/* ------------------------------------------------------------------- setup */

beforeEach(() => {
  configureApiClient({ baseUrl: '/api' });
  clearAccessToken();
  setOnSessionExpired(null);
  vi.stubGlobal('document', { cookie: 'csrf_token=csrf123' });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/* ------------------------------------------------------------- token-store */

describe('isAccessTokenExpiring', () => {
  it('is false with no token', () => {
    expect(isAccessTokenExpiring()).toBe(false);
  });

  it('is false for a token far from expiry', () => {
    setAccessToken(makeJwt(900));
    expect(isAccessTokenExpiring()).toBe(false);
  });

  it('is true within the 30s skew window (and past expiry)', () => {
    setAccessToken(makeJwt(10));
    expect(isAccessTokenExpiring()).toBe(true);
    setAccessToken(makeJwt(-5));
    expect(isAccessTokenExpiring()).toBe(true);
  });

  it('is false when the token has no readable exp (defer to reactive 401)', () => {
    setAccessToken('not-a-jwt');
    expect(isAccessTokenExpiring()).toBe(false);
  });
});

/* -------------------------------------------------------------- proactive */

describe('apiFetch — proactive refresh', () => {
  it('refreshes BEFORE sending when the token is about to expire, then sends with the new token', async () => {
    const fresh = makeJwt(900);
    const mock = installFetch({ refreshStatus: 200, refreshToken: fresh });
    setAccessToken(makeJwt(5)); // within skew → expiring

    const result = await apiFetch<{ seenToken: string }>('/auth/me');

    // refresh happened first, then /me — and /me carried the NEW token.
    expect(mock.refreshCalls()).toHaveLength(1);
    expect(mock.meCalls()).toHaveLength(1);
    expect(mock.calls[0]?.url).toContain('/auth/refresh');
    expect(mock.calls[0]?.headers['X-CSRF-Token']).toBe('csrf123');
    expect(result.seenToken).toBe(`Bearer ${fresh}`);
    expect(getAccessToken()).toBe(fresh);
  });

  it('does NOT refresh when the token is still fresh', async () => {
    const mock = installFetch({ refreshStatus: 200 });
    setAccessToken(makeJwt(900));

    await apiFetch('/auth/me');

    expect(mock.refreshCalls()).toHaveLength(0);
    expect(mock.meCalls()).toHaveLength(1);
  });

  it('single-flights: concurrent expiring requests share ONE refresh', async () => {
    const mock = installFetch({ refreshStatus: 200 });
    setAccessToken(makeJwt(5));

    await Promise.all([apiFetch('/auth/me'), apiFetch('/auth/me'), apiFetch('/auth/me')]);

    expect(mock.refreshCalls()).toHaveLength(1);
    expect(mock.meCalls()).toHaveLength(3);
  });
});

/* --------------------------------------------------------------- reactive */

describe('apiFetch — reactive 401 retry', () => {
  it('on an unanticipated 401, refreshes once and retries with the new token', async () => {
    const fresh = makeJwt(900);
    const mock = installFetch({ refreshStatus: 200, refreshToken: fresh, meStatuses: [401, 200] });
    setAccessToken(makeJwt(900)); // fresh → no proactive refresh

    const result = await apiFetch<{ seenToken: string }>('/auth/me');

    expect(mock.refreshCalls()).toHaveLength(1);
    expect(mock.meCalls()).toHaveLength(2); // first 401, retry 200
    expect(result.seenToken).toBe(`Bearer ${fresh}`);
  });
});

/* ------------------------------------------------- failed refresh → logout */

describe('apiFetch — failed refresh fires the session-expired handler', () => {
  it('proactive path: refresh fails → handler called, throws 401, no request sent', async () => {
    const onExpired = vi.fn();
    setOnSessionExpired(onExpired);
    const mock = installFetch({ refreshStatus: 401 });
    setAccessToken(makeJwt(5)); // expiring → proactive refresh attempted

    await expect(apiFetch('/auth/me')).rejects.toMatchObject({
      name: 'ApiRequestError',
      status: 401,
    });
    expect(onExpired).toHaveBeenCalledTimes(1);
    expect(mock.meCalls()).toHaveLength(0); // bailed before the doomed request
    expect(getAccessToken()).toBeNull(); // refresh cleared it
  });

  it('reactive path: 401 then failed refresh → handler called and error thrown', async () => {
    const onExpired = vi.fn();
    setOnSessionExpired(onExpired);
    installFetch({ refreshStatus: 401, meStatuses: [401] });
    setAccessToken(makeJwt(900)); // fresh → reactive path

    await expect(apiFetch('/auth/me')).rejects.toBeInstanceOf(ApiRequestError);
    expect(onExpired).toHaveBeenCalledTimes(1);
  });
});
