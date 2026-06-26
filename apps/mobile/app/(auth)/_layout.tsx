import { useMe } from '@homeops/api-client';
import { Redirect, Stack } from 'expo-router';

import { useAuthBoot } from '@/lib/auth';

/**
 * Public auth stack (phase0-mobile §7). If the boot refresh already established a session,
 * bounce into the app; otherwise show the auth screens (login / register / activate).
 */
export default function AuthLayout() {
  const { booted } = useAuthBoot();
  const { data: user } = useMe({ enabled: booted });

  if (booted && user) {
    return <Redirect href="/" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
