import { getGetMeQueryKey, useGetMe } from '@homeops/api-client';
import { Redirect, Stack } from 'expo-router';

import { Splash } from '@/components/splash';
import { useAuthBoot } from '@/lib/auth';

/**
 * Protected app stack (phase0-mobile §7; the RequireAuth equivalent). Waits for the boot
 * refresh, then uses `useGetMe` to decide: unauthenticated → redirect to the login stack.
 */
export default function AppLayout() {
  const { booted } = useAuthBoot();
  const { data: user, isLoading, isError } = useGetMe({
    query: { enabled: booted, queryKey: getGetMeQueryKey() },
  });

  if (!booted || (isLoading && !user)) {
    return <Splash />;
  }

  if (isError || !user) {
    return <Redirect href="/login" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
