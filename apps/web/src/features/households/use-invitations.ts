/** Pending-invitations query + invite/resend/revoke mutations + the invite form. */
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
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { householdErrorKey } from './error-messages';

export function useInvitations(householdId: string | undefined) {
  const query = useListInvitations(householdId as string, {
    query: { enabled: Boolean(householdId) },
  });
  return {
    invitations: (query.data?.invitations ?? []) as Invitation[],
    isLoading: query.isLoading,
  };
}

interface UseInviteForm {
  form: UseFormReturn<InviteInput>;
  onSubmit: (e?: React.BaseSyntheticEvent) => void;
  isPending: boolean;
}

export function useInviteForm(householdId: string): UseInviteForm {
  const queryClient = useQueryClient();
  const { t } = useTranslation('households');
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
          toast.success(t('invitations.sent'));
          form.reset({ email: '', role: 'MEMBER' });
        },
        onError: (error) => toast.error(t(householdErrorKey(error))),
      },
    );
  });

  return { form, onSubmit, isPending: create.isPending };
}

export function useInvitationActions(householdId: string) {
  const queryClient = useQueryClient();
  const { t } = useTranslation('households');
  const resend = useResendInvitation();
  const revoke = useRevokeInvitation();

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: getListInvitationsQueryKey(householdId) });

  const onResend = (invitationId: string) =>
    resend.mutate(
      { householdId, invitationId },
      {
        onSuccess: () => {
          void invalidate();
          toast.success(t('invitations.resent'));
        },
        onError: (error) => toast.error(t(householdErrorKey(error))),
      },
    );

  const onRevoke = (invitationId: string) =>
    revoke.mutate(
      { householdId, invitationId },
      {
        onSuccess: () => {
          void invalidate();
          toast.success(t('invitations.revoked'));
        },
        onError: (error) => toast.error(t(householdErrorKey(error))),
      },
    );

  return { onResend, onRevoke, isPending: resend.isPending || revoke.isPending };
}
