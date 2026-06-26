/**
 * Household feature hooks (logic lives here; pages/components stay presentational).
 *
 * Active-household state comes from `useGetMe` (`active_household_id` claim + memberships).
 * Create/switch re-mint the access token (handled by the session MutationCache); here we
 * just invalidate `me` + the household list so the UI reflects the new active tenant.
 *
 * UI permission gates are role-based and advisory only — the backend re-checks every
 * privileged action against the live membership (a stale token can't escalate).
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
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { householdErrorKey } from './error-messages';

const KNOWN_ROLES: readonly Role[] = ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER', 'CHILD'];

function asRole(value: string | undefined): Role | undefined {
  return value && (KNOWN_ROLES as readonly string[]).includes(value) ? (value as Role) : undefined;
}

export interface ActiveHousehold {
  activeHouseholdId: string | undefined;
  role: Role | undefined;
  isOwner: boolean;
  /** Owner or admin — may invite and manage members (UI gate; backend is authoritative). */
  canManageMembers: boolean;
}

/** Derives the active household + role from the `me` query (single source of truth). */
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

/** Switch the active household; invalidates `me` so the whole app re-scopes. */
export function useHouseholdSwitcher() {
  const queryClient = useQueryClient();
  const { t } = useTranslation('households');
  const switchHousehold = useSwitchHousehold();

  const switchTo = (householdId: string) => {
    switchHousehold.mutate(
      { householdId },
      {
        onSuccess: () => {
          void queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
          void queryClient.invalidateQueries({ queryKey: getListHouseholdsQueryKey() });
        },
        onError: (error) => toast.error(t(householdErrorKey(error))),
      },
    );
  };

  return { switchTo, isPending: switchHousehold.isPending };
}

interface UseCreateHouseholdForm {
  form: UseFormReturn<HouseholdInput>;
  onSubmit: (e?: React.BaseSyntheticEvent) => void;
  isPending: boolean;
}

/** Create-household form; on success re-scopes to the new household and runs `onDone`. */
export function useCreateHouseholdForm(onDone?: () => void): UseCreateHouseholdForm {
  const queryClient = useQueryClient();
  const { t } = useTranslation('households');
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
          toast.success(t('create.success'));
          form.reset({ name: '', default_currency: 'HUF' });
          onDone?.();
        },
        onError: (error) => toast.error(t(householdErrorKey(error))),
      },
    );
  });

  return { form, onSubmit, isPending: create.isPending };
}
