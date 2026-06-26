/** General-tab admin actions: rename + archive (mobile). */
import {
  getGetMeQueryKey,
  getListHouseholdsQueryKey,
  useArchiveHousehold,
  useRenameHousehold,
} from '@homeops/api-client';
import { householdSchema, type HouseholdInput } from '@homeops/validation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useForm, type UseFormReturn } from 'react-hook-form';

import { householdErrorKey } from './error-messages';

interface UseRenameForm {
  form: UseFormReturn<HouseholdInput>;
  onSubmit: () => void;
  isPending: boolean;
  isError: boolean;
  errorKey: string;
}

export function useRenameForm(
  householdId: string,
  currentName: string,
  currentCurrency: string,
): UseRenameForm {
  const queryClient = useQueryClient();
  const rename = useRenameHousehold();

  const form = useForm<HouseholdInput>({
    resolver: zodResolver(householdSchema),
    values: { name: currentName, default_currency: currentCurrency },
  });

  const onSubmit = form.handleSubmit((values) => {
    rename.mutate(
      { householdId, data: { name: values.name } },
      {
        onSuccess: () => {
          void queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
          void queryClient.invalidateQueries({ queryKey: getListHouseholdsQueryKey() });
        },
      },
    );
  });

  return {
    form,
    onSubmit,
    isPending: rename.isPending,
    isError: rename.isError,
    errorKey: householdErrorKey(rename.error),
  };
}

export function useArchiveHouseholdAction(householdId: string, onDone?: () => void) {
  const queryClient = useQueryClient();
  const archive = useArchiveHousehold();

  const onArchive = () =>
    archive.mutate(
      { householdId },
      {
        onSuccess: () => {
          void queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
          void queryClient.invalidateQueries({ queryKey: getListHouseholdsQueryKey() });
          onDone?.();
        },
      },
    );

  return { onArchive, isPending: archive.isPending };
}
