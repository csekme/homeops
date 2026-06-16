/**
 * Password step-up forms (mirrors web): disabling 2FA and regenerating recovery codes both
 * re-verify the password. One hook, parameterized by action. Pure — no navigation.
 */
import { useRegenerateRecovery, useTotpDisable } from '@homeops/api-client';
import { totpDisableSchema, type TotpDisableInput } from '@homeops/validation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, type UseFormReturn } from 'react-hook-form';

import { passwordStepUpErrorKey } from './error-messages';

interface UsePasswordStepUp {
  form: UseFormReturn<TotpDisableInput>;
  onSubmit: () => void;
  isPending: boolean;
  isError: boolean;
  errorKey: string;
}

/** Disable 2FA after re-entering the password. `onDone` fires on success (close dialog). */
export function useDisable2fa(onDone: () => void): UsePasswordStepUp {
  const disable = useTotpDisable();
  const form = useForm<TotpDisableInput>({
    resolver: zodResolver(totpDisableSchema),
    defaultValues: { password: '' },
  });

  const onSubmit = form.handleSubmit((values) => {
    disable.mutate(
      { password: values.password },
      {
        onSuccess: () => {
          form.reset({ password: '' });
          onDone();
        },
      },
    );
  });

  return {
    form,
    onSubmit,
    isPending: disable.isPending,
    isError: disable.isError,
    errorKey: passwordStepUpErrorKey(disable.error),
  };
}

/** Regenerate recovery codes after re-entering the password; hands the new codes to `onDone`. */
export function useRegenerateRecoveryCodes(
  onDone: (codes: string[]) => void,
): UsePasswordStepUp {
  const regenerate = useRegenerateRecovery();
  const form = useForm<TotpDisableInput>({
    resolver: zodResolver(totpDisableSchema),
    defaultValues: { password: '' },
  });

  const onSubmit = form.handleSubmit((values) => {
    regenerate.mutate(
      { password: values.password },
      {
        onSuccess: (data) => {
          form.reset({ password: '' });
          onDone(data.codes);
        },
      },
    );
  });

  return {
    form,
    onSubmit,
    isPending: regenerate.isPending,
    isError: regenerate.isError,
    errorKey: passwordStepUpErrorKey(regenerate.error),
  };
}
