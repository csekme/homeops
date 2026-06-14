import { CheckCircle2Icon, Loader2Icon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { AuthShell } from '@/components/auth-shell';
import { Alert, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { useRegisterForm } from '@/features/auth/use-register-form';

export default function RegisterPage() {
  const { t } = useTranslation('auth');
  const { form, onSubmit, isPending, isError, isSuccess } = useRegisterForm();
  const { errors } = form.formState;

  if (isSuccess) {
    return (
      <AuthShell title={t('register.title')}>
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <CheckCircle2Icon className="text-primary" />
            </EmptyMedia>
            <EmptyTitle>{t('register.title')}</EmptyTitle>
            <EmptyDescription>{t('register.checkEmail')}</EmptyDescription>
          </EmptyHeader>
          <Button asChild variant="outline">
            <Link to="/login">{t('register.loginLink')}</Link>
          </Button>
        </Empty>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title={t('register.title')}
      footer={
        <span className="text-muted-foreground">
          {t('register.hasAccount')}{' '}
          <Link to="/login" className="font-medium text-primary hover:underline">
            {t('register.loginLink')}
          </Link>
        </span>
      }
    >
      <form onSubmit={onSubmit} noValidate>
        <FieldGroup>
          {isError ? (
            <Alert variant="destructive">
              <AlertTitle>{t('errors.generic')}</AlertTitle>
            </Alert>
          ) : null}

          <Field data-invalid={!!errors.displayName}>
            <FieldLabel htmlFor="displayName">{t('register.displayName')}</FieldLabel>
            <Input
              id="displayName"
              autoComplete="name"
              aria-invalid={!!errors.displayName}
              {...form.register('displayName')}
            />
            <FieldError errors={[errors.displayName]} />
          </Field>

          <Field data-invalid={!!errors.email}>
            <FieldLabel htmlFor="email">{t('register.email')}</FieldLabel>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              aria-invalid={!!errors.email}
              {...form.register('email')}
            />
            <FieldError errors={[errors.email]} />
          </Field>

          <Field data-invalid={!!errors.password}>
            <FieldLabel htmlFor="password">{t('register.password')}</FieldLabel>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              aria-invalid={!!errors.password}
              {...form.register('password')}
            />
            <FieldError errors={[errors.password]} />
          </Field>

          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? <Loader2Icon className="size-4 animate-spin" /> : null}
            {t('register.submit')}
          </Button>
        </FieldGroup>
      </form>
    </AuthShell>
  );
}
