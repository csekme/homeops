/** Registration form + submit logic (page stays thin; DTO mapping lives in mappers.ts). */
import { useRegister } from '@homeops/api-client';
import { registerSchema } from '@homeops/validation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toRegisterRequest } from './mappers';
export function useRegisterForm() {
    const { i18n } = useTranslation();
    const register = useRegister();
    const form = useForm({
        resolver: zodResolver(registerSchema),
        defaultValues: { email: '', password: '', displayName: '' },
    });
    const onSubmit = form.handleSubmit((values) => {
        register.mutate(toRegisterRequest(values, i18n.resolvedLanguage ?? i18n.language));
    });
    return {
        form,
        onSubmit,
        isPending: register.isPending,
        isError: register.isError,
        isSuccess: register.isSuccess,
    };
}
