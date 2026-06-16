/** Login form + submit logic (RN). Mirrors web, but navigates via Expo Router. */
import { useLogin } from '@homeops/api-client';
import { loginSchema, type LoginInput } from '@homeops/validation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { useForm, type UseFormReturn } from 'react-hook-form';

import { authErrorKey } from './error-messages';
import { toLoginRequest } from './mappers';

interface UseLoginForm {
  form: UseFormReturn<LoginInput>;
  onSubmit: () => void;
  isPending: boolean;
  isError: boolean;
  errorKey: string;
}

export function useLoginForm(): UseLoginForm {
  const router = useRouter();
  const login = useLogin();

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = form.handleSubmit((values) => {
    login.mutate(toLoginRequest(values), {
      onSuccess: (data) => {
        // 2FA enabled: no session yet — carry the challenge token in router params (volatile,
        // never the secure store/URL), exactly like the web carries it in router state.
        if (data.mfa_required && data.challenge_token) {
          router.replace({
            pathname: '/login/verify',
            params: { challengeToken: data.challenge_token },
          });
          return;
        }
        router.replace('/');
      },
    });
  });

  return {
    form,
    onSubmit,
    isPending: login.isPending,
    isError: login.isError,
    errorKey: authErrorKey(login.error),
  };
}
