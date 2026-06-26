/** Reset-password form + submit. On success the backend revokes all sessions; the user signs in. */
import { useResetPassword } from '@homeops/api-client';
import { resetPasswordSchema, type ResetPasswordInput } from '@homeops/validation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, type UseFormReturn } from 'react-hook-form';

import { resetPasswordErrorKey } from './error-messages';
import { toResetPasswordRequest } from './mappers';

interface UseResetPasswordForm {
  form: UseFormReturn<ResetPasswordInput>;
  onSubmit: (e?: React.BaseSyntheticEvent) => void;
  isPending: boolean;
  isError: boolean;
  isSuccess: boolean;
  errorKey: string;
}

export function useResetPasswordForm(token: string | undefined): UseResetPasswordForm {
  const reset = useResetPassword();

  const form = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  const onSubmit = form.handleSubmit((values) => {
    if (!token) return;
    reset.mutate({ data: toResetPasswordRequest(values, token) });
  });

  return {
    form,
    onSubmit,
    isPending: reset.isPending,
    isError: reset.isError,
    isSuccess: reset.isSuccess,
    errorKey: resetPasswordErrorKey(reset.error),
  };
}
