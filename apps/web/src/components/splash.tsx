import { Loader2Icon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/** Full-screen boot splash shown while the silent refresh is in flight. */
export function Splash() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-3 bg-background text-muted-foreground">
      <Loader2Icon className="size-8 animate-spin text-primary" />
      <p className="text-sm">{t('loading')}</p>
    </div>
  );
}
