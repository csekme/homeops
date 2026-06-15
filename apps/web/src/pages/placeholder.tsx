import { ConstructionIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';

/**
 * Generic "coming soon" page for protected routes not built out in Phase 0
 * (obligations, expenses, services, documents, settings). `titleKey` is a
 * `common` namespace nav key (e.g. "nav.obligations").
 */
export function PlaceholderPage({ titleKey }: { titleKey: string }) {
  const { t } = useTranslation();
  return (
    <Empty className="min-h-[60vh]">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <ConstructionIcon />
        </EmptyMedia>
        <EmptyTitle>{t(titleKey)}</EmptyTitle>
        <EmptyDescription>{t('loading')}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
