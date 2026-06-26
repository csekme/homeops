import { useGetMe } from '@homeops/api-client';
import { isFinancialVisible, type Role } from '@homeops/core';
import { CalendarClockIcon, HousePlusIcon } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { CreateHouseholdDialog } from '@/components/create-household-dialog';
import { PendingInvitations } from '@/components/pending-invitations';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { useActiveHousehold } from '@/features/households/use-households';

const KNOWN_ROLES: readonly Role[] = ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER', 'CHILD'];

function isRole(value: string): value is Role {
  return (KNOWN_ROLES as readonly string[]).includes(value);
}

export default function DashboardPage() {
  const { t } = useTranslation('dashboard');
  const { t: th } = useTranslation('households');
  const { data: user } = useGetMe();
  const { activeHouseholdId } = useActiveHousehold();
  const [createOpen, setCreateOpen] = useState(false);

  const memberships = user?.memberships ?? [];
  const active = memberships.find((m) => m.household_id === activeHouseholdId) ?? memberships[0];
  const role = active && active.role && isRole(active.role) ? active.role : undefined;
  const financialVisible = role ? isFinancialVisible(role) : false;

  // No household yet → onboarding: pending invites first (the common "just registered after
  // being invited" case), then a clear call to action to create one's own household.
  if (user && memberships.length === 0) {
    return (
      <>
        <div className="flex flex-col gap-6">
          <PendingInvitations />
          <Empty className="min-h-[50vh]">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <HousePlusIcon />
              </EmptyMedia>
              <EmptyTitle>{th('onboarding.title')}</EmptyTitle>
              <EmptyDescription>{th('onboarding.description')}</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button onClick={() => setCreateOpen(true)}>{th('onboarding.cta')}</Button>
            </EmptyContent>
          </Empty>
        </div>
        <CreateHouseholdDialog open={createOpen} onOpenChange={setCreateOpen} />
      </>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PendingInvitations />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
        {user ? (
          <p className="text-muted-foreground">{t('greeting', { name: user.display_name })}</p>
        ) : (
          <Skeleton className="mt-1 h-5 w-48" />
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('upcoming')}</CardTitle>
            <CardDescription>{t('noUpcoming')}</CardDescription>
          </CardHeader>
          <CardContent>
            <Empty className="border-0 p-0">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <CalendarClockIcon />
                </EmptyMedia>
                <EmptyTitle>{t('upcoming')}</EmptyTitle>
                <EmptyDescription>{t('noUpcoming')}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('overdue')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('monthlySpend')}</CardTitle>
          </CardHeader>
          <CardContent>
            {financialVisible ? (
              <div className="space-y-2">
                <Skeleton className="h-8 w-24" />
                <Skeleton className="h-4 w-32" />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t('financialHidden')}</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
