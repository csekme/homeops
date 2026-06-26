/**
 * "My invitations" — the pending household invites addressed to the signed-in user
 * (feature plan §#4). Surfaced as a dashboard banner so a freshly-registered invitee isn't
 * dropped onto an empty dashboard with no way to act on a waiting invite.
 *
 * Accept/decline here act by invitation **id** (the raw email token isn't available), guarded
 * server-side by the same email-binding check as the token flow.
 */
import {
  getGetMeQueryKey,
  getListHouseholdsQueryKey,
  getListMyInvitationsQueryKey,
  useAcceptInvitation,
  useDeclineInvitation,
  useListMyInvitations,
} from '@homeops/api-client';
import type { MyInvitationOut } from '@homeops/types';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { householdErrorKey } from './error-messages';

export function useMyInvitations() {
  const query = useListMyInvitations({
    query: { retry: false, queryKey: getListMyInvitationsQueryKey() },
  });
  return {
    invitations: (query.data?.invitations ?? []) as MyInvitationOut[],
    isLoading: query.isLoading,
  };
}

/** Accept/decline a pending invitation by id; re-scopes the app and refreshes the banner. */
export function useRespondToInvitation() {
  const queryClient = useQueryClient();
  const { t } = useTranslation('households');
  const accept = useAcceptInvitation();
  const decline = useDeclineInvitation();

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
    void queryClient.invalidateQueries({ queryKey: getListHouseholdsQueryKey() });
    void queryClient.invalidateQueries({ queryKey: getListMyInvitationsQueryKey() });
  };

  const onAccept = (invitationId: string) => {
    accept.mutate(
      { data: { invitation_id: invitationId } },
      {
        onSuccess: invalidate,
        onError: (error) => toast.error(t(householdErrorKey(error))),
      },
    );
  };

  const onDecline = (invitationId: string) => {
    decline.mutate(
      { data: { invitation_id: invitationId } },
      {
        onSuccess: invalidate,
        onError: (error) => toast.error(t(householdErrorKey(error))),
      },
    );
  };

  return {
    onAccept,
    onDecline,
    // The id currently being mutated, so a row can show its own spinner.
    acceptingId: accept.isPending ? accept.variables?.data.invitation_id : undefined,
    decliningId: decline.isPending ? decline.variables?.data.invitation_id : undefined,
    isPending: accept.isPending || decline.isPending,
  };
}
