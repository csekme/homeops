import { refreshAccessToken } from '@homeops/api-client';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { loadStoredLanguage } from './i18n';

/**
 * Boot auth state (plan §M2) — the RN counterpart of `apps/web/src/lib/auth.tsx`. On
 * startup we run a single silent `refreshAccessToken()` to rehydrate the in-memory access
 * token from the secure-store refresh token (body strategy), and load the stored language.
 * While the boot work is in flight the app shows a splash; `useMe` is gated on `booted`.
 */
interface AuthBootContextValue {
  /** True once the boot refresh + i18n load have settled (success or failure). */
  booted: boolean;
}

const AuthBootContext = createContext<AuthBootContextValue>({ booted: false });

export function AuthBootProvider({ children }: { children: ReactNode }) {
  const [booted, setBooted] = useState(false);

  useEffect(() => {
    let active = true;
    void Promise.allSettled([refreshAccessToken(), loadStoredLanguage()]).finally(() => {
      if (active) setBooted(true);
    });
    return () => {
      active = false;
    };
  }, []);

  return <AuthBootContext.Provider value={{ booted }}>{children}</AuthBootContext.Provider>;
}

export function useAuthBoot(): AuthBootContextValue {
  return useContext(AuthBootContext);
}
