import { Stack } from 'expo-router';

/** Public auth stack (plan §M.10): login, verify, register, activate, invite. */
export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
