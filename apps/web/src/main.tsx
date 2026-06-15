import './index.css';
import '@/lib/i18n';
import '@/lib/zod-i18n';

import {
  clearAccessToken,
  configureApiClient,
  meQueryKey,
  setOnSessionExpired,
} from '@homeops/api-client';
import { QueryClientProvider } from '@tanstack/react-query';
import { StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import { toast } from 'sonner';

import App from '@/App';
import { Splash } from '@/components/splash';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import i18n from '@/lib/i18n';
import { AuthBootProvider } from '@/lib/auth';
import { queryClient } from '@/lib/query';
import { ThemeProvider } from '@/lib/theme';

// Same-origin behind the reverse proxy → relative `/api` base (plan §3.12).
configureApiClient({ baseUrl: '/api' });

// When a refresh ultimately fails (refresh token expired/revoked/reused), drop the
// session: clear the in-memory token and mark `me` as null so <RequireAuth> redirects
// to /login. Setting the cache (rather than removing it) keeps it fresh → no refetch loop.
// Only show a "session expired" notice when a real session was lost — boot/first-visit
// probes (no token) just redirect silently.
setOnSessionExpired(({ wasAuthenticated }) => {
  clearAccessToken();
  queryClient.setQueryData(meQueryKey, null);
  if (wasAuthenticated) toast.error(i18n.t('sessionExpired'));
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AuthBootProvider>
          <TooltipProvider>
            <BrowserRouter>
              <Suspense fallback={<Splash />}>
                <App />
              </Suspense>
            </BrowserRouter>
            <Toaster richColors />
          </TooltipProvider>
        </AuthBootProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>,
);
