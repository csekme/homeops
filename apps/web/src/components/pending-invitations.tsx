/**
 * Dashboard banner listing the pending household invitations addressed to the signed-in
 * user (feature plan §#4). Each row offers Accept / Decline (by invitation id). Renders
 * nothing when there are no pending invites, so it's safe to mount unconditionally.
 */
import { MailIcon } from 'lucide-react';
import { Loader2Icon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  useMyInvitations,
  useRespondToInvitation,
} from '@/features/households/use-my-invitations';

function roleKey(role: string): string {
  return `roles.${role}`;
}

export function PendingInvitations() {
  const { t } = useTranslation('households');
  const { invitations } = useMyInvitations();
  const { onAccept, onDecline, acceptingId, decliningId, isPending } = useRespondToInvitation();

  if (invitations.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <MailIcon className="size-4" />
          {t('myInvitations.title')}
        </CardTitle>
        <CardDescription>{t('myInvitations.description')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {invitations.map((inv) => {
          // Generated DTO fields are optional; an invite with no id can't be acted on — skip it.
          if (!inv.id) return null;
          const id = inv.id;
          return (
            <div
              key={id}
              className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <span className="text-sm">
                {t('myInvitations.item', {
                  household: inv.household_name,
                  role: inv.role ? t(roleKey(inv.role)) : '',
                })}
              </span>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => onAccept(id)} disabled={isPending}>
                  {acceptingId === id ? <Loader2Icon className="size-4 animate-spin" /> : null}
                  {t('accept.accept')}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onDecline(id)}
                  disabled={isPending}
                >
                  {decliningId === id ? <Loader2Icon className="size-4 animate-spin" /> : null}
                  {t('accept.decline')}
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
