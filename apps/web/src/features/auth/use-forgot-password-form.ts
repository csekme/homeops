/** Forgot-password form + submit (page stays thin). Always reports success generically. */
import { useForgotPassword } from '@homeops/api-client';
import { forgotPasswordSchema, type ForgotPasswordInput } from '@homeops/validation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, type UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { toForgotPasswordRequest } from './mappers';

interface UseForgotPasswordForm {
  form: UseFormReturn<ForgotPasswordInput>;
  onSubmit: (e?: React.BaseSyntheticEvent) => void;
  isPending: boolean;
  // The backend returns a generic 202 whether or not the address exists (no enumeration), so
  // the UI shows the same "check your inbox" confirmation on success.
  isSuccess: boolean;
}

export function useForgotPasswordForm(): UseForgotPasswordForm {
  const { i18n } = useTranslation();
  const forgot = useForgotPassword();

  const form = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = form.handleSubmit((values) => {
    forgot.mutate({
      data: toForgotPasswordRequest(values, i18n.resolvedLanguage ?? i18n.language),
    });
  });

  return { form, onSubmit, isPending: forgot.isPending, isSuccess: forgot.isSuccess };
}
