import './index.css';
import '@/lib/i18n';
import '@/lib/zod-i18n';
import { configureApiClient } from '@homeops/api-client';
import { QueryClientProvider } from '@tanstack/react-query';
import { StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from '@/App';
import { Splash } from '@/components/splash';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AuthBootProvider } from '@/lib/auth';
import { queryClient } from '@/lib/query';
import { ThemeProvider } from '@/lib/theme';
// Same-origin behind the reverse proxy → relative `/api` base (plan §3.12).
configureApiClient({ baseUrl: '/api' });
createRoot(document.getElementById('root')).render(<StrictMode>
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AuthBootProvider>
          <TooltipProvider>
            <BrowserRouter>
              <Suspense fallback={<Splash />}>
                <App />
              </Suspense>
            </BrowserRouter>
            <Toaster richColors/>
          </TooltipProvider>
        </AuthBootProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>);
