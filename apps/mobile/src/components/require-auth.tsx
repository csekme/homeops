import { useMe } from '@homeops/api-client';
import { Redirect } from 'expo-router';
import { type ReactNode } from 'react';

import { Splash } from '@/components/splash';
import { useAuthBoot } from '@/lib/auth';

/**
 * Route guard (plan §U2) — RN counterpart of the web `require-auth`. Gated on the boot
 * refresh having settled, then on `useMe`: no session → redirect to /login. A failed `me`
 * (after the reactive refresh) also fires the session-expired handler, which redirects too;
 * both paths converge on /login.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { booted } = useAuthBoot();
  const { data, isLoading, isError } = useMe({ enabled: booted });

  if (!booted || isLoading) return <Splash />;
  if (isError || !data) return <Redirect href="/login" />;

  return <>{children}</>;
}
