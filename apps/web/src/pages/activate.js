import { CheckCircle2Icon, Loader2Icon, XCircleIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { AuthShell } from '@/components/auth-shell';
import { Button } from '@/components/ui/button';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { useActivation } from '@/features/auth/use-activation';
export default function ActivatePage() {
    const { t } = useTranslation('auth');
    const { token } = useParams();
    const status = useActivation(token);
    if (status === 'pending') {
        return (<AuthShell title={t('activate.title')}>
        <div className="flex flex-col items-center gap-3 py-6 text-muted-foreground">
          <Loader2Icon className="size-8 animate-spin text-primary"/>
          <p className="text-sm">{t('activate.pending')}</p>
        </div>
      </AuthShell>);
    }
    const ok = status === 'success';
    return (<AuthShell title={t('activate.title')}>
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            {ok ? (<CheckCircle2Icon className="text-primary"/>) : (<XCircleIcon className="text-destructive"/>)}
          </EmptyMedia>
          <EmptyTitle>{t('activate.title')}</EmptyTitle>
          <EmptyDescription>{ok ? t('activate.success') : t('activate.error')}</EmptyDescription>
        </EmptyHeader>
        <Button asChild variant={ok ? 'default' : 'outline'}>
          <Link to="/login">{t('login.submit')}</Link>
        </Button>
      </Empty>
    </AuthShell>);
}
