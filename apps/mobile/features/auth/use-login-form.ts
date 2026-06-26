/** Login form + submit logic (logic in a hook, screen stays thin). expo-router variant. */
import { useLogin } from '@homeops/api-client';
import { loginSchema, type LoginInput } from '@homeops/validation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { useForm, type UseFormReturn } from 'react-hook-form';

import { setPendingChallenge } from '@/features/security/challenge-store';

import { authErrorKey } from './error-messages';
import { toLoginRequest } from './mappers';

interface UseLoginForm {
  form: UseFormReturn<LoginInput>;
  onSubmit: () => void;
  isPending: boolean;
  isError: boolean;
  errorKey: string;
}

export function useLoginForm(redirectTo = '/'): UseLoginForm {
  const router = useRouter();
  const login = useLogin();

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = form.handleSubmit((values) => {
    login.mutate(
      { data: toLoginRequest(values) },
      {
        onSuccess: (data) => {
          // 2FA enabled: no session yet — stash the challenge token in memory (never the
          // navigable URL) and route to the verify screen instead of entering the app.
          if (data.mfa_required && data.challenge_token) {
            setPendingChallenge({ challengeToken: data.challenge_token, redirectTo });
            router.replace('/login/verify');
            return;
          }
          router.replace(redirectTo);
        },
      },
    );
  });

  return {
    form,
    onSubmit,
    isPending: login.isPending,
    isError: login.isError,
    errorKey: authErrorKey(login.error),
  };
}
