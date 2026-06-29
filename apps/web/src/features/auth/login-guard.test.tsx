/**
 * Regression test for the "log in → bounced back to /login" bug (feature plan §Device).
 *
 * Repro: the app first lands on a protected route while logged out, so the guard caches
 * `me = null` (kept "fresh" by staleTime). A subsequent login must NOT be defeated by that
 * stale null — `installSessionHandlers` drops it on session-established so <RequireAuth>
 * refetches and renders the app. Remove that handler and this test goes red (the user is
 * stuck on the login page). Only `fetch` is mocked; the guard, boot, http + session layers
 * are the real thing.
 */
import {
  clearAccessToken,
  configureApiClient,
  createSessionMutationCache,
  setOnSessionEstablished,
  setOnSessionExpired,
  useLogin,
} from '@homeops/api-client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { RequireAuth } from '@/components/require-auth';
import { AuthBootProvider } from '@/lib/auth';
import { installSessionHandlers } from '@/lib/session-handlers';

// The guard pulls in components that call useTranslation; this test isn't about i18n, so stub
// it (keeps output clean and the test independent of the i18next instance).
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'hu' } }),
}));

const b64url = (obj: unknown): string =>
  btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
function makeJwt(secondsFromNow = 900): string {
  const exp = Math.floor(Date.now() / 1000) + secondsFromNow;
  return `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url({ sub: 'u1', exp })}.sig`;
}

const json = (status: number, body: unknown) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
  text: async () => JSON.stringify(body),
});

/**
 * Backend stand-in: `/refresh` always fails (logged out, no cookie); `/login` mints a
 * session; `/me` is 200 only once a Bearer token is presented (i.e. after login).
 */
function installFetch() {
  const fetchMock = vi.fn(async (url: string, init?: { method?: string; headers?: Record<string, string> }) => {
    if (url.endsWith('/auth/refresh')) return json(401, { error: { message: 'no session' } });
    if (url.endsWith('/auth/login')) {
      return json(200, { access_token: makeJwt(), token_type: 'Bearer' });
    }
    if (url.endsWith('/auth/me')) {
      const authed = Boolean(init?.headers?.['Authorization']);
      return authed
        ? json(200, { id: 'u1', email: 'a@b.c', status: 'ACTIVE', memberships: [] })
        : json(401, { error: { message: 'unauthorized' } });
    }
    return json(200, {});
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function LoginStub() {
  const navigate = useNavigate();
  const login = useLogin();
  return (
    <div>
      <span>LOGIN-PAGE</span>
      <button
        onClick={() =>
          login.mutate(
            { data: { email: 'a@b.c', password: 'pw', remember_me: false, grant_trust: false } },
            { onSuccess: () => navigate('/', { replace: true }) },
          )
        }
      >
        do-login
      </button>
    </div>
  );
}

function renderApp() {
  const queryClient = new QueryClient({
    mutationCache: createSessionMutationCache(),
    // Mirror the app: a logged-out `me=null` stays "fresh" for staleTime — the bug's setup.
    defaultOptions: { queries: { retry: false, staleTime: 30_000 } },
  });
  installSessionHandlers(queryClient);

  return render(
    <QueryClientProvider client={queryClient}>
      <AuthBootProvider>
        <MemoryRouter initialEntries={['/']}>
          <Routes>
            <Route path="/login" element={<LoginStub />} />
            <Route element={<RequireAuth />}>
              <Route path="/" element={<div>PROTECTED-APP</div>} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </MemoryRouter>
      </AuthBootProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  clearAccessToken();
  configureApiClient({
    baseUrl: '/api',
    includeCredentials: true,
    authTransport: 'cookie',
    readCsrfToken: () => null,
    refreshTokenStore: null,
    deviceIdStore: null,
    deviceTrustStore: null,
  });
});

afterEach(() => {
  setOnSessionExpired(null);
  setOnSessionEstablished(null);
  clearAccessToken();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it('does not bounce back to /login after a successful login from a protected route', async () => {
  installFetch();
  renderApp();

  // Landing on "/" while logged out → guard caches me=null → redirected to the login page.
  await waitFor(() => expect(screen.getByText('LOGIN-PAGE')).toBeInTheDocument());

  // Log in. The session-established handler must clear the stale me=null so the guard
  // refetches instead of reading the cached null and bouncing us straight back.
  fireEvent.click(screen.getByText('do-login'));

  await waitFor(() => expect(screen.getByText('PROTECTED-APP')).toBeInTheDocument());
  expect(screen.queryByText('LOGIN-PAGE')).not.toBeInTheDocument();
});
