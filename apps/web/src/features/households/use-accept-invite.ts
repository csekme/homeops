/** Invitation preview + accept (the `/invite/:token` landing). */
import {
  getGetMeQueryKey,
  getListHouseholdsQueryKey,
  useAcceptInvitation,
  usePreviewInvitation,
} from '@homeops/api-client';
import type { InvitationPreview } from '@homeops/types';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

import { acceptErrorKey } from './error-messages';

export function useInvitePreview(token: string | undefined) {
  const query = usePreviewInvitation(token as string, {
    query: { enabled: Boolean(token), retry: false },
  });
  return {
    preview: query.data as InvitationPreview | undefined,
    isLoading: query.isLoading,
    isError: query.isError,
  };
}

export function useAcceptInvite(token: string | undefined, redirectTo = '/') {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const accept = useAcceptInvitation();

  const onAccept = () => {
    if (!token) return;
    accept.mutate(
      { data: { token } },
      {
        onSuccess: () => {
          void queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
          void queryClient.invalidateQueries({ queryKey: getListHouseholdsQueryKey() });
          navigate(redirectTo, { replace: true });
        },
      },
    );
  };

  return {
    onAccept,
    isPending: accept.isPending,
    isError: accept.isError,
    errorKey: acceptErrorKey(accept.error),
  };
}
