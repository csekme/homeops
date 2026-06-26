/** Member-list query + role/remove/leave mutations for the active household (mobile). */
import {
  getGetMeQueryKey,
  getListHouseholdsQueryKey,
  getListMembersQueryKey,
  useChangeMemberRole,
  useListMembers,
  useRemoveMember,
} from '@homeops/api-client';
// expo's stricter tsconfig requires the queryKey in the query options object.
import type { Member } from '@homeops/types';
import { useQueryClient } from '@tanstack/react-query';

export function useMembers(householdId: string | undefined) {
  const query = useListMembers(householdId as string, {
    query: {
      enabled: Boolean(householdId),
      queryKey: getListMembersQueryKey(householdId as string),
    },
  });
  return {
    members: (query.data?.members ?? []) as Member[],
    isLoading: query.isLoading,
  };
}

export function useMemberActions(householdId: string, currentUserId: string | undefined) {
  const queryClient = useQueryClient();
  const changeRole = useChangeMemberRole();
  const remove = useRemoveMember();

  const invalidateMembers = () =>
    queryClient.invalidateQueries({ queryKey: getListMembersQueryKey(householdId) });

  const onChangeRole = (userId: string, role: string) =>
    changeRole.mutate(
      { householdId, userId, data: { role: role as never } },
      { onSuccess: () => void invalidateMembers() },
    );

  const onRemove = (userId: string) => {
    const leaving = userId === currentUserId;
    remove.mutate(
      { householdId, userId },
      {
        onSuccess: () => {
          void invalidateMembers();
          if (leaving) {
            void queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
            void queryClient.invalidateQueries({ queryKey: getListHouseholdsQueryKey() });
          }
        },
      },
    );
  };

  return { onChangeRole, onRemove, isPending: changeRole.isPending || remove.isPending };
}
