/**
 * Device/session management hooks (feature plan §Device registration).
 *
 * Wraps the generated react-query hooks with cache invalidation so the list reflects a
 * rename/revoke immediately. Revoking the *current* device also tears down the local
 * session + device secrets (bearer transport keeps no cookie, so the client clears itself).
 */
import {
  getListDevicesQueryKey,
  useListDevices,
  useRenameDevice,
  useRevokeDevice,
  useRevokeOtherDevices,
} from '@homeops/api-client';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';

import { clearSession } from '@/lib/api';
import { clearDeviceSecrets } from '@/lib/secure-device-store';

export function useDevices() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: getListDevicesQueryKey() });

  const list = useListDevices();
  const rename = useRenameDevice({ mutation: { onSuccess: invalidate } });
  const revoke = useRevokeDevice({ mutation: { onSuccess: invalidate } });
  const revokeOthers = useRevokeOtherDevices({ mutation: { onSuccess: invalidate } });

  /** Revoke a device; if it's the one we're on, end the local session and bounce to login. */
  const revokeDevice = (deviceId: string, isCurrent: boolean) => {
    revoke.mutate(
      { deviceId },
      {
        onSuccess: () => {
          if (isCurrent) {
            void clearDeviceSecrets();
            clearSession();
            router.replace('/login');
          }
        },
      },
    );
  };

  return { list, rename, revoke, revokeDevice, revokeOthers };
}
