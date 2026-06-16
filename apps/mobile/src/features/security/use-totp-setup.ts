/**
 * Enrollment wizard state machine (mirrors web): scan QR + enter code → confirm → show
 * recovery codes once. Pure logic — no navigation. The `useTotpConfirm` mutation does NOT
 * invalidate the status query (would unmount the wizard before recovery codes render); the
 * status refresh happens on `reset()` when the wizard closes (see api-client note).
 */
import { totpStatusQueryKey, useTotpConfirm, useTotpSetup } from '@homeops/api-client';
import { totpConfirmSchema, type TotpConfirmInput } from '@homeops/validation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { useForm, type UseFormReturn } from 'react-hook-form';

import { confirmErrorKey } from './error-messages';

export type EnrollmentStep = 'scan' | 'recovery';

interface UseTotpEnrollment {
  step: EnrollmentStep;
  provisioningUri: string | undefined;
  secret: string | undefined;
  recoveryCodes: string[] | undefined;
  form: UseFormReturn<TotpConfirmInput>;
  start: () => void;
  onConfirm: () => void;
  reset: () => void;
  isStarting: boolean;
  isConfirming: boolean;
  isError: boolean;
  errorKey: string;
}

export function useTotpEnrollment(): UseTotpEnrollment {
  const queryClient = useQueryClient();
  const setup = useTotpSetup();
  const confirm = useTotpConfirm();
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>();

  const form = useForm<TotpConfirmInput>({
    resolver: zodResolver(totpConfirmSchema),
    defaultValues: { code: '' },
  });

  const start = useCallback(() => {
    setRecoveryCodes(undefined);
    form.reset({ code: '' });
    setup.mutate();
  }, [setup, form]);

  const reset = useCallback(() => {
    setRecoveryCodes(undefined);
    form.reset({ code: '' });
    setup.reset();
    confirm.reset();
    void queryClient.invalidateQueries({ queryKey: totpStatusQueryKey });
  }, [setup, confirm, form, queryClient]);

  const onConfirm = form.handleSubmit((values) => {
    confirm.mutate({ code: values.code }, { onSuccess: (data) => setRecoveryCodes(data.codes) });
  });

  return {
    step: recoveryCodes ? 'recovery' : 'scan',
    provisioningUri: setup.data?.provisioning_uri,
    secret: setup.data?.secret,
    recoveryCodes,
    form,
    start,
    onConfirm,
    reset,
    isStarting: setup.isPending,
    isConfirming: confirm.isPending,
    isError: confirm.isError,
    errorKey: confirmErrorKey(confirm.error),
  };
}
