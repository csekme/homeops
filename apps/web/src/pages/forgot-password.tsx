/**
 * Forgot-password page (`/forgot-password`). Collects an email and triggers a reset link.
 * The backend responds generically (no user enumeration), so a submitted form always shows
 * the same "check your inbox" confirmation.
 */
import { CheckCircle2Icon, Loader2Icon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { AuthShell } from '@/components/auth-shell';
import { Button } from '@/components/ui/button';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { useForgotPasswordForm } from '@/features/auth/use-forgot-password-form';

export default function ForgotPasswordPage() {
  const { t } = useTranslation('auth');
  const { form, onSubmit, isPending, isSuccess } = useForgotPasswordForm();
  const { errors } = form.formState;

  if (isSuccess) {
    return (
      <AuthShell title={t('forgotPassword.title')}>
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <CheckCircle2Icon className="text-primary" />
            </EmptyMedia>
            <EmptyTitle>{t('forgotPassword.title')}</EmptyTitle>
            <EmptyDescription>{t('forgotPassword.checkEmail')}</EmptyDescription>
          </EmptyHeader>
          <Button asChild variant="outline">
            <Link to="/login">{t('forgotPassword.backToLogin')}</Link>
          </Button>
        </Empty>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title={t('forgotPassword.title')}
      description={t('forgotPassword.description')}
      footer={
        <Link to="/login" className="font-medium text-primary hover:underline">
          {t('forgotPassword.backToLogin')}
        </Link>
      }
    >
      <form onSubmit={onSubmit} noValidate>
        <FieldGroup>
          <Field data-invalid={!!errors.email}>
            <FieldLabel htmlFor="email">{t('forgotPassword.email')}</FieldLabel>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              aria-invalid={!!errors.email}
              {...form.register('email')}
            />
            <FieldError errors={[errors.email]} />
          </Field>

          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? <Loader2Icon className="size-4 animate-spin" /> : null}
            {t('forgotPassword.submit')}
          </Button>
        </FieldGroup>
      </form>
    </AuthShell>
  );
}
