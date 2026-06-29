import { MutationObserver, QueryClient } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { configureApiClient, type DeviceSecretStore, type RefreshTokenStore } from './config';
import { createSessionMutationCache } from './session';
import {
  clearAccessToken,
  getAccessToken,
  setAccessToken,
  setOnSessionEstablished,
} from './token-store';

/** Unsigned JWT with a future `exp` — setAccessToken only reads `exp`. */
const b64url = (obj: unknown): string =>
  btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
function makeJwt(secondsFromNow = 900): string {
  const exp = Math.floor(Date.now() / 1000) + secondsFromNow;
  return `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url({ sub: 'u1', exp })}.sig`;
}

/** Run one mutation through a client wired with the session MutationCache. */
async function runMutation(mutationKey: string, data: unknown): Promise<void> {
  const client = new QueryClient({ mutationCache: createSessionMutationCache() });
  const observer = new MutationObserver(client, {
    mutationKey: [mutationKey],
    mutationFn: async () => data,
  });
  await observer.mutate();
}

function memoryStore(): RefreshTokenStore & { value: string | null } {
  return {
    value: null,
    save(token: string) {
      this.value = token;
    },
    load() {
      return this.value;
    },
    clear() {
      this.value = null;
    },
  };
}

let established: number;

beforeEach(() => {
  clearAccessToken();
  established = 0;
  setOnSessionEstablished(() => {
    established += 1;
  });
  configureApiClient({ refreshTokenStore: null, deviceIdStore: null, deviceTrustStore: null });
});

afterEach(() => {
  setOnSessionEstablished(null);
  vi.restoreAllMocks();
});

describe('session MutationCache', () => {
  it('seeds the access token and fires session-established when a response carries one', async () => {
    const token = makeJwt();
    await runMutation('login', { access_token: token, token_type: 'Bearer' });

    expect(getAccessToken()).toBe(token);
    // The new-session signal lets the host drop a stale logged-out `me` so the route guard
    // refetches instead of bouncing the just-authenticated user back to /login.
    expect(established).toBe(1);
  });

  it('does NOT fire session-established on logout (and clears the token)', async () => {
    setAccessToken(makeJwt());
    await runMutation('logout', undefined);

    expect(getAccessToken()).toBeNull();
    expect(established).toBe(0);
  });

  it('does NOT fire when the response has no access token (e.g. an invite preview)', async () => {
    await runMutation('preview', { household_name: 'Acme' });

    expect(getAccessToken()).toBeNull();
    expect(established).toBe(0);
  });

  it('persists rotated refresh + device secrets on bearer transport', async () => {
    const refreshTokenStore = memoryStore();
    const deviceIdStore = memoryStore() as DeviceSecretStore & { value: string | null };
    const deviceTrustStore = memoryStore() as DeviceSecretStore & { value: string | null };
    configureApiClient({ refreshTokenStore, deviceIdStore, deviceTrustStore });

    await runMutation('login', {
      access_token: makeJwt(),
      refresh_token: 'r-123',
      device_id: 'd-abc',
      device_trust: 't-xyz',
    });

    expect(refreshTokenStore.value).toBe('r-123');
    expect(deviceIdStore.value).toBe('d-abc');
    expect(deviceTrustStore.value).toBe('t-xyz');
    expect(established).toBe(1);
  });
});
