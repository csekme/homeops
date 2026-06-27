/** Registration form + submit logic (screen stays thin; DTO mapping lives in mappers.ts). */
import { useRegister } from '@homeops/api-client';
import { registerSchema, type RegisterInput } from '@homeops/validation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, type UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { toRegisterRequest } from './mappers';

interface UseRegisterForm {
  form: UseFormReturn<RegisterInput>;
  onSubmit: () => void;
  isPending: boolean;
  isError: boolean;
  isSuccess: boolean;
}

export function useRegisterForm(): UseRegisterForm {
  const { i18n } = useTranslation();
  const register = useRegister();

  const form = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { email: '', password: '', confirmPassword: '', displayName: '' },
  });

  const onSubmit = form.handleSubmit((values) => {
    register.mutate({ data: toRegisterRequest(values, i18n.resolvedLanguage ?? i18n.language) });
  });

  return {
    form,
    onSubmit,
    isPending: register.isPending,
    isError: register.isError,
    isSuccess: register.isSuccess,
  };
}
