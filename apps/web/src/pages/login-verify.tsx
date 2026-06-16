import { Loader2Icon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useLocation } from 'react-router-dom';

import { AuthShell } from '@/components/auth-shell';
import { Alert, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { useTotpChallenge } from '@/features/security/use-totp-challenge';

interface ChallengeState {
  challengeToken?: string;
  redirectTo?: string;
}

export default function LoginVerifyPage() {
  const location = useLocation();
  const state = (location.state ?? {}) as ChallengeState;

  // No challenge token in router state (e.g. a reload or direct visit) → restart login.
  if (!state.challengeToken) {
    return <Navigate to="/login" replace />;
  }

  return <ChallengeForm challengeToken={state.challengeToken} redirectTo={state.redirectTo} />;
}

function ChallengeForm({
  challengeToken,
  redirectTo,
}: {
  challengeToken: string;
  redirectTo?: string;
}) {
  const { t } = useTranslation('settings');
  const { form, onSubmit, isPending, isError, errorKey } = useTotpChallenge(
    challengeToken,
    redirectTo ?? '/',
  );
  const { errors } = form.formState;

  return (
    <AuthShell
      title={t('twofactor.challenge.title')}
      footer={
        <Link to="/login" className="font-medium text-primary hover:underline">
          {t('twofactor.challenge.back')}
        </Link>
      }
    >
      <form onSubmit={onSubmit} noValidate>
        <FieldGroup>
          <p className="text-sm text-muted-foreground">{t('twofactor.challenge.instruction')}</p>

          {isError ? (
            <Alert variant="destructive">
              <AlertTitle>{t(errorKey)}</AlertTitle>
            </Alert>
          ) : null}

          <Field data-invalid={!!errors.code}>
            <FieldLabel htmlFor="code">{t('twofactor.challenge.codeLabel')}</FieldLabel>
            <Input
              id="code"
              inputMode="text"
              autoComplete="one-time-code"
              autoFocus
              aria-invalid={!!errors.code}
              {...form.register('code')}
            />
            <FieldError errors={[errors.code]} />
          </Field>

          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? <Loader2Icon className="size-4 animate-spin" /> : null}
            {t('twofactor.challenge.submit')}
          </Button>
        </FieldGroup>
      </form>
    </AuthShell>
  );
}
