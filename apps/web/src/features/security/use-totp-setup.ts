/**
 * Enrollment wizard state machine (feature plan §Frontend.4/§Frontend.6):
 *   scan QR + enter code → confirm → show recovery codes once.
 *
 * All API/logic lives here so the Security tab component stays presentational.
 */
import { getTotpStatusQueryKey, useTotpConfirm, useTotpSetup } from '@homeops/api-client';
import { totpConfirmSchema, type TotpConfirmInput } from '@homeops/validation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { useForm, type UseFormReturn } from 'react-hook-form';

import { confirmErrorKey } from './error-messages';

export type EnrollmentStep = 'scan' | 'recovery';

interface UseTotpEnrollment {
  step: EnrollmentStep;
  /** otpauth:// URI + base32 secret, available once `start()` has resolved. */
  provisioningUri: string | undefined;
  secret: string | undefined;
  recoveryCodes: string[] | undefined;
  form: UseFormReturn<TotpConfirmInput>;
  start: () => void;
  onConfirm: (e?: React.BaseSyntheticEvent) => void;
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
    // Refresh the card's enabled/remaining state now that the wizard is closing — this is
    // where we pick up a just-completed enrolment (see useTotpConfirm's note).
    void queryClient.invalidateQueries({ queryKey: getTotpStatusQueryKey() });
  }, [setup, confirm, form, queryClient]);

  const onConfirm = form.handleSubmit((values) => {
    confirm.mutate(
      { data: { code: values.code } },
      { onSuccess: (data) => setRecoveryCodes(data.codes) },
    );
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
