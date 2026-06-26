/**
 * Reset-password page (`/reset-password/:token`). Sets a new password using the emailed
 * token. On success the backend revokes all existing sessions; the user signs in again.
 */
import { CheckCircle2Icon, Loader2Icon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';

import { AuthShell } from '@/components/auth-shell';
import { Alert, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { useResetPasswordForm } from '@/features/auth/use-reset-password-form';

export default function ResetPasswordPage() {
  const { t } = useTranslation('auth');
  const { token } = useParams<{ token: string }>();
  const { form, onSubmit, isPending, isError, isSuccess, errorKey } = useResetPasswordForm(token);
  const { errors } = form.formState;

  if (isSuccess) {
    return (
      <AuthShell title={t('resetPassword.title')}>
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <CheckCircle2Icon className="text-primary" />
            </EmptyMedia>
            <EmptyTitle>{t('resetPassword.title')}</EmptyTitle>
            <EmptyDescription>{t('resetPassword.success')}</EmptyDescription>
          </EmptyHeader>
          <Button asChild>
            <Link to="/login">{t('resetPassword.backToLogin')}</Link>
          </Button>
        </Empty>
      </AuthShell>
    );
  }

  return (
    <AuthShell title={t('resetPassword.title')} description={t('resetPassword.description')}>
      <form onSubmit={onSubmit} noValidate>
        <FieldGroup>
          {isError ? (
            <Alert variant="destructive">
              <AlertTitle>{t(errorKey)}</AlertTitle>
            </Alert>
          ) : null}

          <Field data-invalid={!!errors.password}>
            <FieldLabel htmlFor="password">{t('resetPassword.password')}</FieldLabel>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              aria-invalid={!!errors.password}
              {...form.register('password')}
            />
            <FieldError errors={[errors.password]} />
          </Field>

          <Field data-invalid={!!errors.confirmPassword}>
            <FieldLabel htmlFor="confirmPassword">{t('resetPassword.confirmPassword')}</FieldLabel>
            <Input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              aria-invalid={!!errors.confirmPassword}
              {...form.register('confirmPassword')}
            />
            <FieldError errors={[errors.confirmPassword]} />
          </Field>

          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? <Loader2Icon className="size-4 animate-spin" /> : null}
            {t('resetPassword.submit')}
          </Button>
        </FieldGroup>
      </form>
    </AuthShell>
  );
}
