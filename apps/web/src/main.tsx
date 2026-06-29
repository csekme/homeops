import './index.css';
import '@/lib/i18n';
import '@/lib/zod-i18n';

import { configureApiClient } from '@homeops/api-client';
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
import { installSessionHandlers } from '@/lib/session-handlers';
import { ThemeProvider } from '@/lib/theme';

// Same-origin behind the reverse proxy → relative `/api` base (plan §3.12).
configureApiClient({ baseUrl: '/api' });

// Wire session lifecycle → QueryClient. Only show a "session expired" notice when a real
// session was lost — boot/first-visit probes (no token) just redirect silently.
installSessionHandlers(queryClient, {
  onExpired: ({ wasAuthenticated }) => {
    if (wasAuthenticated) toast.error(i18n.t('sessionExpired'));
  },
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
