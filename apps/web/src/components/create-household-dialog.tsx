/**
 * Create-household dialog. Controlled by the parent (`open`/`onOpenChange`) so it can be
 * triggered from the sidebar switcher or the dashboard onboarding empty state.
 */
import { Loader2Icon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { useCreateHouseholdForm } from '@/features/households/use-households';

export function CreateHouseholdDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation('households');
  const { form, onSubmit, isPending } = useCreateHouseholdForm(() => onOpenChange(false));
  const { errors } = form.formState;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <img
            src="/res/household/create_household.svg"
            alt=""
            aria-hidden="true"
            className="mx-auto"
          />
          <DialogTitle>{t('create.title')}</DialogTitle>
          <DialogDescription>{t('create.description')}</DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <Field data-invalid={!!errors.name}>
            <FieldLabel htmlFor="household-name">{t('create.nameLabel')}</FieldLabel>
            <Input
              id="household-name"
              autoFocus
              placeholder={t('create.namePlaceholder')}
              aria-invalid={!!errors.name}
              {...form.register('name')}
            />
            <FieldError errors={[errors.name]} />
          </Field>

          <Field data-invalid={!!errors.default_currency}>
            <FieldLabel htmlFor="household-currency">{t('create.currencyLabel')}</FieldLabel>
            <Input
              id="household-currency"
              maxLength={3}
              className="uppercase"
              aria-invalid={!!errors.default_currency}
              {...form.register('default_currency')}
            />
            <FieldError errors={[errors.default_currency]} />
          </Field>

          <Button type="submit" disabled={isPending}>
            {isPending ? <Loader2Icon className="size-4 animate-spin" /> : null}
            {t('create.submit')}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
