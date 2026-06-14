import { useMe } from '@homeops/api-client';
import { isFinancialVisible } from '@homeops/core';
import { CalendarClockIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, } from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
const KNOWN_ROLES = ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER', 'CHILD'];
function isRole(value) {
    return KNOWN_ROLES.includes(value);
}
export default function DashboardPage() {
    const { t } = useTranslation('dashboard');
    const { data: user } = useMe();
    const membership = user?.memberships?.[0];
    const role = membership && isRole(membership.role) ? membership.role : undefined;
    // No household yet (Phase 0) → no role → keep financial widgets hidden by default.
    const financialVisible = role ? isFinancialVisible(role) : false;
    return (<div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
        {user ? (<p className="text-muted-foreground">{t('greeting', { name: user.display_name })}</p>) : (<Skeleton className="mt-1 h-5 w-48"/>)}
      </div>

      {!membership ? (<Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">
              {/* Phase 0: user has no household yet — role-agnostic note. */}
              {t('noUpcoming')}
            </p>
          </CardContent>
        </Card>) : null}

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
            <Skeleton className="h-4 w-3/4"/>
            <Skeleton className="h-4 w-1/2"/>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('monthlySpend')}</CardTitle>
          </CardHeader>
          <CardContent>
            {financialVisible ? (<div className="space-y-2">
                <Skeleton className="h-8 w-24"/>
                <Skeleton className="h-4 w-32"/>
              </div>) : (<p className="text-sm text-muted-foreground">{t('financialHidden')}</p>)}
          </CardContent>
        </Card>
      </div>
    </div>);
}
