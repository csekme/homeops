import { Loader2Icon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { AuthShell } from '@/components/auth-shell';
import { Alert, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { useLoginForm } from '@/features/auth/use-login-form';
export default function LoginPage() {
    const { t } = useTranslation('auth');
    const { form, onSubmit, isPending, isError, errorKey } = useLoginForm();
    const { errors } = form.formState;
    return (<AuthShell title={t('login.title')} footer={<span className="text-muted-foreground">
          {t('login.noAccount')}{' '}
          <Link to="/register" className="font-medium text-primary hover:underline">
            {t('login.registerLink')}
          </Link>
        </span>}>
      <form onSubmit={onSubmit} noValidate>
        <FieldGroup>
          {isError ? (<Alert variant="destructive">
              <AlertTitle>{t(errorKey)}</AlertTitle>
            </Alert>) : null}

          <Field data-invalid={!!errors.email}>
            <FieldLabel htmlFor="email">{t('login.email')}</FieldLabel>
            <Input id="email" type="email" autoComplete="email" aria-invalid={!!errors.email} {...form.register('email')}/>
            <FieldError errors={[errors.email]}/>
          </Field>

          <Field data-invalid={!!errors.password}>
            <FieldLabel htmlFor="password">{t('login.password')}</FieldLabel>
            <Input id="password" type="password" autoComplete="current-password" aria-invalid={!!errors.password} {...form.register('password')}/>
            <FieldError errors={[errors.password]}/>
          </Field>

          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? <Loader2Icon className="size-4 animate-spin"/> : null}
            {t('login.submit')}
          </Button>
        </FieldGroup>
      </form>
    </AuthShell>);
}
