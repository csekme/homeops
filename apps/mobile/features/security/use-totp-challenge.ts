/** Login step 2 (TOTP/backup code) form + submit logic. expo-router variant. */
import { useTotpVerify } from '@homeops/api-client';
import { totpChallengeSchema, type TotpChallengeInput } from '@homeops/validation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { useForm, type UseFormReturn } from 'react-hook-form';

import { clearPendingChallenge } from './challenge-store';
import { challengeErrorKey } from './error-messages';

interface UseTotpChallenge {
  form: UseFormReturn<TotpChallengeInput>;
  onSubmit: () => void;
  isPending: boolean;
  isError: boolean;
  errorKey: string;
}

export function useTotpChallenge(challengeToken: string, redirectTo = '/'): UseTotpChallenge {
  const router = useRouter();
  const verify = useTotpVerify();

  const form = useForm<TotpChallengeInput>({
    resolver: zodResolver(totpChallengeSchema),
    defaultValues: { code: '' },
  });

  const onSubmit = form.handleSubmit((values) => {
    verify.mutate(
      { data: { challenge_token: challengeToken, code: values.code } },
      {
        onSuccess: () => {
          clearPendingChallenge();
          router.replace(redirectTo);
        },
      },
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
