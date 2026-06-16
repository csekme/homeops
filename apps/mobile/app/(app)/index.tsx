import { useMe } from '@homeops/api-client';
import { useTranslation } from 'react-i18next';

import { type AppIconName } from '@/components/app-icon';
import { IconBadge } from '@/components/icon-badge';
import { QuickAction } from '@/components/quick-action';
import { Screen } from '@/components/screen';
import { SectionCard } from '@/components/section-card';
import { Badge, BadgeText } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';

interface Action {
  href: '/obligations' | '/expenses' | '/services' | '/documents';
  icon: AppIconName;
  labelKey: string;
}

const QUICK_ACTIONS: Action[] = [
  { href: '/obligations', icon: 'checkbox-outline', labelKey: 'nav.obligations' },
  { href: '/expenses', icon: 'cash-outline', labelKey: 'nav.expenses' },
  { href: '/services', icon: 'cube-outline', labelKey: 'nav.services' },
  { href: '/documents', icon: 'document-outline', labelKey: 'nav.documents' },
];

/** Dashboard (plan §U2 / §1): greeting hero + quick actions. Business widgets land in Phase 1. */
export default function DashboardScreen() {
  const { t } = useTranslation(['dashboard', 'common']);
  const { data } = useMe();
  const name = data?.display_name ?? data?.email ?? '';

  // Render quick actions as two rows of two so the tiles share width evenly without a Grid.
  const rows = [QUICK_ACTIONS.slice(0, 2), QUICK_ACTIONS.slice(2, 4)];

  return (
    <Screen>
      <Card
        variant="elevated"
        className="gap-4 rounded-2xl border border-border shadow-soft-1"
      >
        <HStack space="md" className="items-center">
          <IconBadge name="hand-right-outline" size="lg" />
          <VStack space="xs" className="flex-1">
            <Heading size="lg" className="text-foreground">
              {t('greeting', { name })}
            </Heading>
            <Text className="text-muted-foreground">{t('subtitle')}</Text>
          </VStack>
        </HStack>
      </Card>

      <VStack space="md">
        <Heading size="sm" className="text-muted-foreground">
          {t('quickActions')}
        </Heading>
        {rows.map((row, i) => (
          <HStack key={i} space="md">
            {row.map((a) => (
              <QuickAction
                key={a.href}
                href={a.href}
                icon={a.icon}
                label={t(a.labelKey, { ns: 'common' })}
              />
            ))}
          </HStack>
        ))}
      </VStack>

      <SectionCard
        icon="sparkles-outline"
        title={t('widgetsTitle')}
        subtitle={t('widgetsBody')}
        trailing={
          <Badge action="info" variant="solid" className="rounded-full">
            <BadgeText>{t('comingSoon', { ns: 'common' })}</BadgeText>
          </Badge>
        }
      />
    </Screen>
  );
}
