/** Member-list query + role/remove/leave mutations for the active household. */
import {
  getGetMeQueryKey,
  getListHouseholdsQueryKey,
  getListMembersQueryKey,
  useChangeMemberRole,
  useListMembers,
  useRemoveMember,
} from '@homeops/api-client';
import type { Member } from '@homeops/types';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { householdErrorKey } from './error-messages';

export function useMembers(householdId: string | undefined) {
  const query = useListMembers(householdId as string, {
    query: { enabled: Boolean(householdId) },
  });
  return {
    members: (query.data?.members ?? []) as Member[],
    isLoading: query.isLoading,
  };
}

export function useMemberActions(householdId: string, currentUserId: string | undefined) {
  const queryClient = useQueryClient();
  const { t } = useTranslation('households');
  const changeRole = useChangeMemberRole();
  const remove = useRemoveMember();

  const invalidateMembers = () =>
    queryClient.invalidateQueries({ queryKey: getListMembersQueryKey(householdId) });

  const onChangeRole = (userId: string, role: string) => {
    changeRole.mutate(
      { householdId, userId, data: { role: role as never } },
      {
        onSuccess: () => {
          void invalidateMembers();
          toast.success(t('members.roleChanged'));
        },
        onError: (error) => toast.error(t(householdErrorKey(error))),
      },
    );
  };

  const onRemove = (userId: string) => {
    const leaving = userId === currentUserId;
    remove.mutate(
      { householdId, userId },
      {
        onSuccess: () => {
          void invalidateMembers();
          toast.success(t(leaving ? 'members.left' : 'members.removed'));
          // Leaving changes the caller's own membership set / active household.
          if (leaving) {
            void queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
            void queryClient.invalidateQueries({ queryKey: getListHouseholdsQueryKey() });
          }
        },
        onError: (error) => toast.error(t(householdErrorKey(error))),
      },
    );
  };

  return { onChangeRole, onRemove, isPending: changeRole.isPending || remove.isPending };
}
