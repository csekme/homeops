/**
 * The Security-tab 2FA section: status + enable wizard + disable / regenerate step-ups.
 * Presentational shell over the feature hooks (`useTotpStatus`, `useTotpEnrollment`,
 * `useDisable2fa`, `useRegenerateRecoveryCodes`) — no business logic lives here.
 */
import { useTotpStatus } from '@homeops/api-client';
import { Loader2Icon, ShieldCheckIcon } from 'lucide-react';
import { useState } from 'react';
import { Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { QRCodeSVG } from 'qrcode.react';

import { Alert, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Skeleton } from '@/components/ui/skeleton';
import { useDisable2fa, useRegenerateRecoveryCodes } from '@/features/security/use-disable-2fa';
import { useTotpEnrollment } from '@/features/security/use-totp-setup';
import { RecoveryCodes } from '@/features/security/recovery-codes';

export function TwoFactorCard() {
  const { t } = useTranslation('settings');
  const { data: status, isLoading } = useTotpStatus();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheckIcon className="size-5" />
          {t('security.title')}
        </CardTitle>
        <CardDescription>{t('security.description')}</CardDescription>
      </CardHeader>

      <CardContent className="flex items-center gap-3">
        {isLoading ? (
          <Skeleton className="h-6 w-40" />
        ) : status?.enabled ? (
          <>
            <Badge variant="default">{t('security.statusEnabled')}</Badge>
            <span className="text-sm text-muted-foreground">
              {t('security.recoveryRemaining', { count: status.recovery_codes_remaining })}
            </span>
          </>
        ) : (
          <Badge variant="secondary">{t('security.statusDisabled')}</Badge>
        )}
      </CardContent>

      <CardFooter className="flex flex-wrap gap-2">
        {!isLoading && !status?.enabled ? <EnrollDialog /> : null}
        {status?.enabled ? (
          <>
            <RegenerateDialog />
            <DisableDialog />
          </>
        ) : null}
      </CardFooter>
    </Card>
  );
}

/* ── Enable wizard ─────────────────────────────────────────────────────────────── */

function EnrollDialog() {
  const { t } = useTranslation('settings');
  const [open, setOpen] = useState(false);
  const wizard = useTotpEnrollment();

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) wizard.start();
    else wizard.reset();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <Button onClick={() => onOpenChange(true)}>{t('security.enableButton')}</Button>
      <DialogContent>
        {wizard.step === 'recovery' && wizard.recoveryCodes ? (
          <>
            <DialogHeader>
              <DialogTitle>{t('twofactor.recovery.title')}</DialogTitle>
            </DialogHeader>
            <RecoveryCodes codes={wizard.recoveryCodes} onDone={() => onOpenChange(false)} />
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{t('twofactor.setup.title')}</DialogTitle>
              <DialogDescription>{t('twofactor.setup.instruction')}</DialogDescription>
            </DialogHeader>

            {wizard.isStarting || !wizard.provisioningUri ? (
              <div className="flex justify-center py-8">
                <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <form onSubmit={wizard.onConfirm} className="flex flex-col gap-4" noValidate>
                <div className="flex justify-center rounded-md bg-white p-4">
                  <QRCodeSVG value={wizard.provisioningUri} size={176} />
                </div>

                <p className="text-sm text-muted-foreground">
                  {t('twofactor.setup.manualEntry')}
                </p>
                <code className="block break-all rounded-md border bg-muted/40 p-2 text-center text-sm">
                  {wizard.secret}
                </code>

                {wizard.isError ? (
                  <Alert variant="destructive">
                    <AlertTitle>{t(wizard.errorKey)}</AlertTitle>
                  </Alert>
                ) : null}

                <Field>
                  <FieldLabel htmlFor="totp-code">{t('twofactor.setup.codeLabel')}</FieldLabel>
                  <Controller
                    control={wizard.form.control}
                    name="code"
                    render={({ field }) => (
                      <InputOTP
                        id="totp-code"
                        maxLength={6}
                        value={field.value}
                        onChange={field.onChange}
                        containerClassName="justify-center"
                      >
                        <InputOTPGroup>
                          {[0, 1, 2, 3, 4, 5].map((i) => (
                            <InputOTPSlot key={i} index={i} />
                          ))}
                        </InputOTPGroup>
                      </InputOTP>
                    )}
                  />
                  <FieldError errors={[wizard.form.formState.errors.code]} />
                </Field>

                <Button type="submit" disabled={wizard.isConfirming}>
                  {wizard.isConfirming ? <Loader2Icon className="size-4 animate-spin" /> : null}
                  {t('twofactor.setup.confirmButton')}
                </Button>
              </form>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ── Disable (password step-up) ───────────────────────────────────────────────── */

function DisableDialog() {
  const { t } = useTranslation('settings');
  const [open, setOpen] = useState(false);
  const { form, onSubmit, isPending, isError, errorKey } = useDisable2fa(() => setOpen(false));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="destructive" onClick={() => setOpen(true)}>
        {t('security.disableButton')}
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('twofactor.disable.title')}</DialogTitle>
          <DialogDescription>{t('twofactor.disable.description')}</DialogDescription>
        </DialogHeader>
        <PasswordStepUpForm
          form={form}
          onSubmit={onSubmit}
          isPending={isPending}
          isError={isError}
          errorKey={errorKey}
          submitLabel={t('twofactor.disable.submit')}
          submitVariant="destructive"
        />
      </DialogContent>
    </Dialog>
  );
}

/* ── Regenerate recovery codes (password step-up → new codes) ─────────────────── */

function RegenerateDialog() {
  const { t } = useTranslation('settings');
  const [open, setOpen] = useState(false);
  const [codes, setCodes] = useState<string[]>();
  const { form, onSubmit, isPending, isError, errorKey } = useRegenerateRecoveryCodes(setCodes);

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setCodes(undefined);
      form.reset({ password: '' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <Button variant="outline" onClick={() => onOpenChange(true)}>
        {t('security.regenerateButton')}
      </Button>
      <DialogContent>
        {codes ? (
          <>
            <DialogHeader>
              <DialogTitle>{t('twofactor.recovery.title')}</DialogTitle>
            </DialogHeader>
            <RecoveryCodes codes={codes} onDone={() => onOpenChange(false)} />
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{t('twofactor.regenerate.title')}</DialogTitle>
              <DialogDescription>{t('twofactor.regenerate.description')}</DialogDescription>
            </DialogHeader>
            <PasswordStepUpForm
              form={form}
              onSubmit={onSubmit}
              isPending={isPending}
              isError={isError}
              errorKey={errorKey}
              submitLabel={t('twofactor.regenerate.submit')}
            />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ── Shared password form for the two step-up dialogs ─────────────────────────── */

interface PasswordStepUpFormProps {
  form: ReturnType<typeof useDisable2fa>['form'];
  onSubmit: (e?: React.BaseSyntheticEvent) => void;
  isPending: boolean;
  isError: boolean;
  errorKey: string;
  submitLabel: string;
  submitVariant?: 'default' | 'destructive';
}

function PasswordStepUpForm({
  form,
  onSubmit,
  isPending,
  isError,
  errorKey,
  submitLabel,
  submitVariant = 'default',
}: PasswordStepUpFormProps) {
  const { t } = useTranslation('settings');
  const { errors } = form.formState;

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      {isError ? (
        <Alert variant="destructive">
          <AlertTitle>{t(errorKey)}</AlertTitle>
        </Alert>
      ) : null}

      <Field data-invalid={!!errors.password}>
        <FieldLabel htmlFor="step-up-password">{t('twofactor.disable.passwordLabel')}</FieldLabel>
        <Input
          id="step-up-password"
          type="password"
          autoComplete="current-password"
          aria-invalid={!!errors.password}
          {...form.register('password')}
        />
        <FieldError errors={[errors.password]} />
      </Field>

      <Button type="submit" variant={submitVariant} disabled={isPending}>
        {isPending ? <Loader2Icon className="size-4 animate-spin" /> : null}
        {submitLabel}
      </Button>
    </form>
  );
}
