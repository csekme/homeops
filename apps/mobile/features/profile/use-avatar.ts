/**
 * Avatar mutations for mobile (feature plan §Avatar): upload a cropped image and remove the
 * current one. Both invalidate the `getMe` query so the drawer avatar + profile screen update
 * immediately. The upload sends multipart/form-data — the shared `apiFetch` passes a FormData
 * body straight through (bearer transport + device headers are added automatically).
 */
import { getGetMeQueryKey, useDeleteAvatar, useSetAvatar } from '@homeops/api-client';
import { useQueryClient } from '@tanstack/react-query';

export function useAvatar() {
  const queryClient = useQueryClient();
  const setAvatar = useSetAvatar();
  const deleteAvatar = useDeleteAvatar();

  const refreshMe = () =>
    void queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });

  /** Upload a cropped square image by local file URI. Resolves true on success. */
  const upload = (uri: string): Promise<boolean> =>
    new Promise((resolve) => {
      // The generated `setAvatar` appends `data.file` to a FormData; React Native accepts a
      // `{ uri, name, type }` file descriptor there (it stands in for a Blob at runtime).
      const file = { uri, name: 'avatar.jpg', type: 'image/jpeg' } as unknown as Blob;
      setAvatar.mutate(
        { data: { file } },
        {
          onSuccess: () => {
            refreshMe();
            resolve(true);
          },
          onError: () => resolve(false),
        },
      );
    });

  const remove = (): Promise<boolean> =>
    new Promise((resolve) => {
      deleteAvatar.mutate(undefined, {
        onSuccess: () => {
          refreshMe();
          resolve(true);
        },
        onError: () => resolve(false),
      });
    });

  return {
    upload,
    remove,
    isUploading: setAvatar.isPending,
    isRemoving: deleteAvatar.isPending,
  };
}
