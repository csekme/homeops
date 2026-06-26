/**
 * Household feature hooks (mobile). Mirrors the web feature but navigates with expo-router
 * and surfaces errors inline (no toast layer). Active-household state comes from `useGetMe`
 * (`active_household_id` claim); create/switch re-mint the access token via the session
 * MutationCache, so here we only invalidate `me` + the household list.
 */
import {
  getGetMeQueryKey,
  getListHouseholdsQueryKey,
  useCreateHousehold,
  useGetMe,
  useSwitchHousehold,
} from '@homeops/api-client';
import type { Role } from '@homeops/core';
import { householdSchema, type HouseholdInput } from '@homeops/validation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useForm, type UseFormReturn } from 'react-hook-form';

import { householdErrorKey } from './error-messages';

const KNOWN_ROLES: readonly Role[] = ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER', 'CHILD'];

function asRole(value: string | undefined): Role | undefined {
  return value && (KNOWN_ROLES as readonly string[]).includes(value) ? (value as Role) : undefined;
}

export interface ActiveHousehold {
  activeHouseholdId: string | undefined;
  role: Role | undefined;
  isOwner: boolean;
  canManageMembers: boolean;
}

export function useActiveHousehold(): ActiveHousehold {
  const { data: user } = useGetMe();
  const activeHouseholdId = user?.active_household_id ?? undefined;
  const membership = (user?.memberships ?? []).find((m) => m.household_id === activeHouseholdId);
  const role = asRole(membership?.role);
  return {
    activeHouseholdId,
    role,
    isOwner: role === 'OWNER',
    canManageMembers: role === 'OWNER' || role === 'ADMIN',
  };
}

export function useHouseholdSwitcher() {
  const queryClient = useQueryClient();
  const switchHousehold = useSwitchHousehold();

  const switchTo = (householdId: string) =>
    switchHousehold.mutate(
      { householdId },
      {
        onSuccess: () => {
          void queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
          void queryClient.invalidateQueries({ queryKey: getListHouseholdsQueryKey() });
        },
      },
    );

  return { switchTo, isPending: switchHousehold.isPending };
}

interface UseCreateHouseholdForm {
  form: UseFormReturn<HouseholdInput>;
  onSubmit: () => void;
  isPending: boolean;
  isError: boolean;
  errorKey: string;
}

export function useCreateHouseholdForm(onDone?: () => void): UseCreateHouseholdForm {
  const queryClient = useQueryClient();
  const create = useCreateHousehold();

  const form = useForm<HouseholdInput>({
    resolver: zodResolver(householdSchema),
    defaultValues: { name: '', default_currency: 'HUF' },
  });

  const onSubmit = form.handleSubmit((values) => {
    create.mutate(
      { data: values },
      {
        onSuccess: () => {
          void queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
          void queryClient.invalidateQueries({ queryKey: getListHouseholdsQueryKey() });
          form.reset({ name: '', default_currency: 'HUF' });
          onDone?.();
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
