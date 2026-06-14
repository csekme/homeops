import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';

import { AuthShell } from '@/components/auth-shell';
import { Button } from '@/components/ui/button';
import { MailIcon } from 'lucide-react';

import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';

/**
 * Household invite landing (plan §3.13 route list). Phase 0 has no invite-accept
 * API yet, so this is a placeholder that surfaces the token and routes the user
 * to register/sign in. Wire the accept flow when the backend endpoint lands.
 */
export default function InvitePage() {
  const { t } = useTranslation('auth');
  const { token } = useParams<{ token: string }>();

  return (
    <AuthShell title={t('register.title')}>
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <MailIcon className="text-primary" />
          </EmptyMedia>
          <EmptyTitle>{t('register.title')}</EmptyTitle>
          <EmptyDescription>
            {t('register.hasAccount')}
            {token ? <code className="mt-2 block break-all text-xs">{token}</code> : null}
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent className="flex-row justify-center gap-2">
          <Button asChild>
            <Link to="/register">{t('register.submit')}</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/login">{t('login.submit')}</Link>
          </Button>
        </EmptyContent>
      </Empty>
    </AuthShell>
  );
}
