/** Pending-invitations query + invite/resend/revoke mutations + invite form (mobile). */
import {
  getListInvitationsQueryKey,
  useCreateInvitation,
  useListInvitations,
  useResendInvitation,
  useRevokeInvitation,
} from '@homeops/api-client';
import type { Invitation } from '@homeops/types';
import { inviteSchema, type InviteInput } from '@homeops/validation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useForm, type UseFormReturn } from 'react-hook-form';

import { householdErrorKey } from './error-messages';

export function useInvitations(householdId: string | undefined) {
  const query = useListInvitations(householdId as string, {
    query: {
      enabled: Boolean(householdId),
      queryKey: getListInvitationsQueryKey(householdId as string),
    },
  });
  return {
    invitations: (query.data?.invitations ?? []) as Invitation[],
    isLoading: query.isLoading,
  };
}

interface UseInviteForm {
  form: UseFormReturn<InviteInput>;
  onSubmit: () => void;
  isPending: boolean;
  isError: boolean;
  errorKey: string;
}

export function useInviteForm(householdId: string): UseInviteForm {
  const queryClient = useQueryClient();
  const create = useCreateInvitation();

  const form = useForm<InviteInput>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { email: '', role: 'MEMBER' },
  });

  const onSubmit = form.handleSubmit((values) => {
    create.mutate(
      { householdId, data: values },
      {
        onSuccess: () => {
          void queryClient.invalidateQueries({
            queryKey: getListInvitationsQueryKey(householdId),
          });
          form.reset({ email: '', role: 'MEMBER' });
        },
      },
    );
  });

  return {
    form,
    onSubmit,
    isPending: create.isPending,
    isError: create.isError,
    errorKey: householdErrorKey(create.error),
  };
}

export function useInvitationActions(householdId: string) {
  const queryClient = useQueryClient();
  const resend = useResendInvitation();
  const revoke = useRevokeInvitation();

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: getListInvitationsQueryKey(householdId) });

  const onResend = (invitationId: string) =>
    resend.mutate({ householdId, invitationId }, { onSuccess: () => void invalidate() });

  const onRevoke = (invitationId: string) =>
    revoke.mutate({ householdId, invitationId }, { onSuccess: () => void invalidate() });

  return { onResend, onRevoke, isPending: resend.isPending || revoke.isPending };
}
