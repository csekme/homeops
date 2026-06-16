import { Redirect, useLocalSearchParams } from 'expo-router';

import { ActivationView } from '@/features/auth/activation-view';

/** Deep-link target `homeops://activate/<token>` (plan §M.9). */
export default function ActivateTokenScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  if (!token) return <Redirect href="/activate" />;
  return <ActivationView token={token} />;
}
