/** Invitation preview + accept/decline (the `/invite/:token` landing). */
import {
  getGetMeQueryKey,
  getListHouseholdsQueryKey,
  getListMyInvitationsQueryKey,
  useAcceptInvitation,
  useDeclineInvitation,
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
  const decline = useDeclineInvitation();

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
    void queryClient.invalidateQueries({ queryKey: getListHouseholdsQueryKey() });
    void queryClient.invalidateQueries({ queryKey: getListMyInvitationsQueryKey() });
  };

  const onAccept = () => {
    if (!token) return;
    accept.mutate(
      { data: { token } },
      {
        onSuccess: () => {
          invalidate();
          navigate(redirectTo, { replace: true });
        },
      },
    );
  };

  // Declining a token-bound invite. The user lands back on the dashboard; the now-declined
  // invite drops out of "my invitations" on the next read.
  const onDecline = () => {
    if (!token) return;
    decline.mutate(
      { data: { token } },
      {
        onSuccess: () => {
          invalidate();
          navigate('/', { replace: true });
        },
      },
    );
  };

  return {
    onAccept,
    onDecline,
    isPending: accept.isPending,
    isDeclining: decline.isPending,
    isError: accept.isError || decline.isError,
    errorKey: acceptErrorKey(accept.error ?? decline.error),
  };
}
