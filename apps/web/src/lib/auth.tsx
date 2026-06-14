import { refreshAccessToken } from '@homeops/api-client';
import { createContext, useContext, useEffect, useState } from 'react';

/**
 * Boot auth state (plan §3.12). On startup we run a single silent
 * `refreshAccessToken()` to rehydrate the in-memory access token from the
 * HttpOnly refresh cookie, THEN allow `useMe` to run. While the boot refresh is
 * in flight the app shows a splash.
 */
interface AuthBootContextValue {
  /** True once the boot refresh round-trip has settled (success or failure). */
  booted: boolean;
}

const AuthBootContext = createContext<AuthBootContextValue>({ booted: false });

export function AuthBootProvider({ children }: { children: React.ReactNode }) {
  const [booted, setBooted] = useState(false);

  useEffect(() => {
    let active = true;
    void refreshAccessToken().finally(() => {
      if (active) setBooted(true);
    });
    return () => {
      active = false;
    };
  }, []);

  return <AuthBootContext.Provider value={{ booted }}>{children}</AuthBootContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuthBoot(): AuthBootContextValue {
  return useContext(AuthBootContext);
}
