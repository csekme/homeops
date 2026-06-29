import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { configureApiClient, type RefreshTokenStore } from './config';
import { apiFetch, ApiRequestError, refreshAccessToken } from './http';
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
  // Reset to the full web defaults — config is module state shared across tests, so a
  // bearer-transport test must not leak into the next cookie-transport one.
  configureApiClient({
    baseUrl: '/api',
    includeCredentials: true,
    authTransport: 'cookie',
    readCsrfToken: () => 'csrf123',
    refreshTokenStore: null,
  });
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
  it('proactive path: refresh fails → handler called (wasAuthenticated), throws 401, no request sent', async () => {
    const onExpired = vi.fn();
    setOnSessionExpired(onExpired);
    const mock = installFetch({ refreshStatus: 401 });
    setAccessToken(makeJwt(5)); // expiring → proactive refresh attempted

    await expect(apiFetch('/auth/me')).rejects.toMatchObject({
      name: 'ApiRequestError',
      status: 401,
    });
    expect(onExpired).toHaveBeenCalledTimes(1);
    expect(onExpired).toHaveBeenCalledWith({ wasAuthenticated: true });
    expect(mock.meCalls()).toHaveLength(0); // bailed before the doomed request
    expect(getAccessToken()).toBeNull(); // refresh cleared it
  });

  it('reactive path with a session: 401 then failed refresh → handler called (wasAuthenticated: true)', async () => {
    const onExpired = vi.fn();
    setOnSessionExpired(onExpired);
    installFetch({ refreshStatus: 401, meStatuses: [401] });
    setAccessToken(makeJwt(900)); // fresh token present → real session lost

    await expect(apiFetch('/auth/me')).rejects.toBeInstanceOf(ApiRequestError);
    expect(onExpired).toHaveBeenCalledWith({ wasAuthenticated: true });
  });

  it('reactive path without a session (boot probe): 401 then failed refresh → wasAuthenticated: false', async () => {
    const onExpired = vi.fn();
    setOnSessionExpired(onExpired);
    installFetch({ refreshStatus: 401, meStatuses: [401] });
    // no setAccessToken → request carried no token (first-visit / boot probe)

    await expect(apiFetch('/auth/me')).rejects.toBeInstanceOf(ApiRequestError);
    expect(onExpired).toHaveBeenCalledWith({ wasAuthenticated: false });
  });
});

/* ----------------------------------------------------- multipart (uploads) */

describe('apiFetch — multipart body', () => {
  it('passes a FormData body through untouched and does not force a JSON Content-Type', async () => {
    const captured: Array<{ body: unknown; headers: Record<string, string> }> = [];
    const fetchMock = vi.fn(
      async (_url: string, init?: { headers?: Record<string, string>; body?: unknown }) => {
        captured.push({ body: init?.body, headers: init?.headers ?? {} });
        return res(200, { ok: true });
      },
    );
    vi.stubGlobal('fetch', fetchMock);
    setAccessToken(makeJwt(900));

    const form = new FormData();
    form.append('file', new Blob(['x'], { type: 'image/webp' }), 'avatar.webp');
    await apiFetch('/auth/avatar', { method: 'PUT', body: form });

    // The exact FormData instance is forwarded (not JSON.stringified)…
    expect(captured[0]?.body).toBe(form);
    // …and we let fetch set the multipart boundary instead of forcing application/json.
    expect(captured[0]?.headers['Content-Type']).toBeUndefined();
    expect(captured[0]?.headers['Authorization']).toBe(`Bearer ${makeJwt(900)}`);
  });
});

/* ------------------------------------------------- mobile (bearer transport) */

describe('bearer transport (mobile)', () => {
  /** A fake secure-store that records save/clear and serves a seeded refresh token. */
  function fakeStore(initial: string | null = null) {
    let value = initial;
    const store: RefreshTokenStore = {
      load: () => value,
      save: vi.fn((t: string) => {
        value = t;
      }),
      clear: vi.fn(() => {
        value = null;
      }),
    };
    return { store, get: () => value };
  }

  /** Records request bodies/headers; refresh returns a rotated token. */
  function installBearerFetch(opts: { refreshStatus?: number; rotated?: string } = {}) {
    const calls: Array<{ url: string; headers: Record<string, string>; body?: unknown }> = [];
    const fetchMock = vi.fn(
      async (url: string, init?: { headers?: Record<string, string>; body?: string }) => {
        calls.push({
          url,
          headers: init?.headers ?? {},
          body: init?.body ? JSON.parse(init.body) : undefined,
        });
        if (url.endsWith('/auth/refresh')) {
          const status = opts.refreshStatus ?? 200;
          if (status !== 200) return res(status, { error: { message: 'no' } });
          return res(200, {
            access_token: makeJwt(900),
            token_type: 'Bearer',
            refresh_token: opts.rotated ?? 'rt-rotated',
          });
        }
        return res(200, { ok: true });
      },
    );
    vi.stubGlobal('fetch', fetchMock);
    return { calls };
  }

  it('apiFetch flags every request with X-Auth-Transport and omits credentials', async () => {
    const mock = installBearerFetch();
    const { store } = fakeStore('rt-1');
    configureApiClient({
      baseUrl: 'https://api.test/api',
      includeCredentials: false,
      authTransport: 'bearer',
      readCsrfToken: () => null,
      refreshTokenStore: store,
    });
    setAccessToken(makeJwt(900));

    await apiFetch('/auth/me');

    expect(mock.calls[0]?.url).toBe('https://api.test/api/auth/me');
    expect(mock.calls[0]?.headers['X-Auth-Transport']).toBe('bearer');
  });

  it('refresh sends the stored token in the body (no CSRF) and persists the rotated one', async () => {
    const mock = installBearerFetch({ rotated: 'rt-2' });
    const fs = fakeStore('rt-1');
    configureApiClient({
      baseUrl: '/api',
      includeCredentials: false,
      authTransport: 'bearer',
      readCsrfToken: () => null,
      refreshTokenStore: fs.store,
    });

    const token = await refreshAccessToken();

    expect(token).toBeTruthy();
    const refreshCall = mock.calls.find((c) => c.url.endsWith('/auth/refresh'));
    expect(refreshCall?.body).toEqual({ refresh_token: 'rt-1' });
    expect(refreshCall?.headers['X-Auth-Transport']).toBe('bearer');
    expect(refreshCall?.headers['X-CSRF-Token']).toBeUndefined();
    expect(fs.store.save).toHaveBeenCalledWith('rt-2');
    expect(fs.get()).toBe('rt-2');
  });

  it('with no stored token, refresh fails fast without a round-trip', async () => {
    const mock = installBearerFetch();
    const fs = fakeStore(null);
    configureApiClient({
      baseUrl: '/api',
      includeCredentials: false,
      authTransport: 'bearer',
      readCsrfToken: () => null,
      refreshTokenStore: fs.store,
    });

    expect(await refreshAccessToken()).toBeNull();
    expect(mock.calls).toHaveLength(0);
  });

  it('a failed refresh clears the secure store', async () => {
    installBearerFetch({ refreshStatus: 401 });
    const fs = fakeStore('rt-1');
    configureApiClient({
      baseUrl: '/api',
      includeCredentials: false,
      authTransport: 'bearer',
      readCsrfToken: () => null,
      refreshTokenStore: fs.store,
    });

    expect(await refreshAccessToken()).toBeNull();
    expect(fs.store.clear).toHaveBeenCalled();
    expect(fs.get()).toBeNull();
  });
});
