/** General-tab admin actions: rename + archive (owner/admin gated; backend authoritative). */
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
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { householdErrorKey } from './error-messages';

interface UseRenameForm {
  form: UseFormReturn<HouseholdInput>;
  onSubmit: (e?: React.BaseSyntheticEvent) => void;
  isPending: boolean;
}

export function useRenameForm(
  householdId: string,
  currentName: string,
  currentCurrency: string,
): UseRenameForm {
  const queryClient = useQueryClient();
  const { t } = useTranslation('households');
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
          toast.success(t('general.renamed'));
        },
        onError: (error) => toast.error(t(householdErrorKey(error))),
      },
    );
  });

  return { form, onSubmit, isPending: rename.isPending };
}

export function useArchiveHouseholdAction(householdId: string, onDone?: () => void) {
  const queryClient = useQueryClient();
  const { t } = useTranslation('households');
  const archive = useArchiveHousehold();

  const onArchive = () =>
    archive.mutate(
      { householdId },
      {
        onSuccess: () => {
          void queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
          void queryClient.invalidateQueries({ queryKey: getListHouseholdsQueryKey() });
          toast.success(t('general.archived'));
          onDone?.();
        },
        onError: (error) => toast.error(t(householdErrorKey(error))),
      },
    );

  return { onArchive, isPending: archive.isPending };
}
