/** Login step 2 (TOTP/backup code) form + submit logic. Page stays thin. */
import { useTotpVerify } from '@homeops/api-client';
import { totpChallengeSchema, type TotpChallengeInput } from '@homeops/validation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, type UseFormReturn } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';

import { challengeErrorKey } from './error-messages';

interface UseTotpChallenge {
  form: UseFormReturn<TotpChallengeInput>;
  onSubmit: (e?: React.BaseSyntheticEvent) => void;
  isPending: boolean;
  isError: boolean;
  errorKey: string;
}

export function useTotpChallenge(challengeToken: string, redirectTo = '/'): UseTotpChallenge {
  const navigate = useNavigate();
  const verify = useTotpVerify();

  const form = useForm<TotpChallengeInput>({
    resolver: zodResolver(totpChallengeSchema),
    defaultValues: { code: '' },
  });

  const onSubmit = form.handleSubmit((values) => {
    verify.mutate(
      { data: { challenge_token: challengeToken, code: values.code } },
      { onSuccess: () => navigate(redirectTo, { replace: true }) },
    );
  });

  return {
    form,
    onSubmit,
    isPending: verify.isPending,
    isError: verify.isError,
    errorKey: challengeErrorKey(),
  };
}
