/**
 * Household invite landing (`/invite/:token`). Previews the invitation (public), then:
 *  - signed in with the matching email → accept and enter the household;
 *  - not signed in / wrong account → route to register or login carrying the token, so the
 *    user returns here to accept after authenticating (register-then-join).
 */
import { useGetMe } from '@homeops/api-client';
import { Loader2Icon, MailIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';

import { AuthShell } from '@/components/auth-shell';
import { Alert, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { useAcceptInvite, useInvitePreview } from '@/features/households/use-accept-invite';

export default function InvitePage() {
  const { t } = useTranslation('households');
  const { token } = useParams<{ token: string }>();
  const { preview, isLoading, isError } = useInvitePreview(token);
  const { data: user } = useGetMe();
  const { onAccept, onDecline, isPending, isDeclining, isError: acceptError, errorKey } =
    useAcceptInvite(token);

  // Carry the invite token through auth so the user returns here to accept after signing in.
  const redirectParam = token ? `?redirect=${encodeURIComponent(`/invite/${token}`)}` : '';

  if (isLoading) {
    return (
      <AuthShell title={t('accept.title')}>
        <div className="flex justify-center py-8">
          <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
        </div>
      </AuthShell>
    );
  }

  if (isError || !preview) {
    return (
      <AuthShell title={t('accept.title')}>
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <MailIcon className="text-muted-foreground" />
            </EmptyMedia>
            <EmptyTitle>{t('accept.title')}</EmptyTitle>
            <EmptyDescription>{t('errors.invalidInvite')}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent className="flex-row justify-center gap-2">
            <Button asChild variant="outline">
              <Link to="/login">{t('accept.login')}</Link>
            </Button>
          </EmptyContent>
        </Empty>
      </AuthShell>
    );
  }

  const signedInMatches =
    user && user.email?.toLowerCase() === preview.email?.toLowerCase();
  const signedInWrong = user && !signedInMatches;

  return (
    <AuthShell title={t('accept.previewTitle')}>
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          {t('accept.previewDescription', {
            household: preview.household_name,
            role: t(`roles.${preview.role}`),
          })}
        </p>

        {acceptError ? (
          <Alert variant="destructive">
            <AlertTitle>{t(errorKey)}</AlertTitle>
          </Alert>
        ) : null}

        {signedInMatches ? (
          <div className="flex flex-col gap-2">
            <Button onClick={onAccept} disabled={isPending || isDeclining}>
              {isPending ? <Loader2Icon className="size-4 animate-spin" /> : null}
              {t('accept.accept')}
            </Button>
            <Button variant="outline" onClick={onDecline} disabled={isPending || isDeclining}>
              {isDeclining ? <Loader2Icon className="size-4 animate-spin" /> : null}
              {t('accept.decline')}
            </Button>
          </div>
        ) : signedInWrong ? (
          <Alert variant="destructive">
            <AlertTitle>{t('accept.wrongAccount', { email: preview.email })}</AlertTitle>
          </Alert>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              {t('accept.signInPrompt', { email: preview.email })}
            </p>
            <div className="flex justify-center gap-2">
              <Button asChild>
                <Link to={`/register${redirectParam}`}>{t('accept.register')}</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to={`/login${redirectParam}`}>{t('accept.login')}</Link>
              </Button>
            </div>
          </>
        )}
      </div>
    </AuthShell>
  );
}
