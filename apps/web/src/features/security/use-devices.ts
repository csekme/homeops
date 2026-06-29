/**
 * Device/session management hooks (feature plan §Device registration).
 *
 * Thin wrappers over the generated react-query hooks that add cache invalidation so the list
 * reflects a rename/revoke immediately. The Security tab's `DevicesCard` stays presentational.
 */
import {
  getListDevicesQueryKey,
  useListDevices,
  useRenameDevice,
  useRevokeDevice,
  useRevokeOtherDevices,
} from '@homeops/api-client';
import { useQueryClient } from '@tanstack/react-query';

export function useDevices() {
  const queryClient = useQueryClient();
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: getListDevicesQueryKey() });

  const list = useListDevices();
  const rename = useRenameDevice({ mutation: { onSuccess: invalidate } });
  const revoke = useRevokeDevice({ mutation: { onSuccess: invalidate } });
  const revokeOthers = useRevokeOtherDevices({ mutation: { onSuccess: invalidate } });

  return { list, rename, revoke, revokeOthers };
}
