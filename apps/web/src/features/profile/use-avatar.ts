/**
 * Avatar mutations (feature plan §Avatar, web §10): upload a cropped image and remove the
 * current one. Both invalidate the `getMe` query so the sidebar avatar + profile card update
 * live, and surface success/error via sonner toasts (mirrors the household admin hooks).
 */
import { getGetMeQueryKey, useDeleteAvatar, useSetAvatar } from '@homeops/api-client';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { avatarErrorKey } from './error-messages';

export function useAvatar() {
  const queryClient = useQueryClient();
  const { t } = useTranslation('settings');
  const setAvatar = useSetAvatar();
  const deleteAvatar = useDeleteAvatar();

  const refreshMe = () =>
    void queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });

  /** Upload a cropped square image (resolves true on success so callers can close the dialog). */
  const upload = (blob: Blob): Promise<boolean> =>
    new Promise((resolve) => {
      const file = new File([blob], 'avatar.png', { type: blob.type || 'image/png' });
      setAvatar.mutate(
        { data: { file } },
        {
          onSuccess: () => {
            refreshMe();
            toast.success(t('profile.saved'));
            resolve(true);
          },
          onError: (error) => {
            toast.error(t(avatarErrorKey(error)));
            resolve(false);
          },
        },
      );
    });

  const remove = (): Promise<boolean> =>
    new Promise((resolve) => {
      deleteAvatar.mutate(undefined, {
        onSuccess: () => {
          refreshMe();
          toast.success(t('profile.removed'));
          resolve(true);
        },
        onError: (error) => {
          toast.error(t(avatarErrorKey(error)));
          resolve(false);
        },
      });
    });

  return {
    upload,
    remove,
    isUploading: setAvatar.isPending,
    isRemoving: deleteAvatar.isPending,
  };
}
