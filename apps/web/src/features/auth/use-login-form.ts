/** Login form + submit logic (industry-standard: logic in a hook, page stays thin). */
import { useLogin } from '@homeops/api-client';
import { loginSchema, type LoginInput } from '@homeops/validation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, type UseFormReturn } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';

import { authErrorKey } from './error-messages';
import { toLoginRequest } from './mappers';

interface UseLoginForm {
  form: UseFormReturn<LoginInput>;
  onSubmit: (e?: React.BaseSyntheticEvent) => void;
  isPending: boolean;
  isError: boolean;
  errorKey: string;
}

export function useLoginForm(redirectTo = '/'): UseLoginForm {
  const navigate = useNavigate();
  const login = useLogin();

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = form.handleSubmit((values) => {
    login.mutate(toLoginRequest(values), {
      onSuccess: () => navigate(redirectTo, { replace: true }),
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
