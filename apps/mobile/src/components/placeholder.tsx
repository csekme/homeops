import { useTranslation } from 'react-i18next';

import { type AppIconName } from '@/components/app-icon';
import { EmptyState } from '@/components/empty-state';

interface PlaceholderProps {
  /** Feature i18n namespace holding `title` + `comingSoon`. */
  ns: 'obligations' | 'expenses' | 'services' | 'documents';
  icon: AppIconName;
}

/**
 * Phase-0 placeholder tab body: a polished "coming soon" empty state built from the feature's
 * own namespace (its `title` + forward-looking `comingSoon` copy), so each tab reads as
 * intentional rather than unfinished. Business screens replace this in Phase 1.
 */
export function Placeholder({ ns, icon }: PlaceholderProps) {
  const { t } = useTranslation([ns, 'common']);
  return (
    <EmptyState
      icon={icon}
      badge={t('comingSoon', { ns: 'common' })}
      title={t('title', { ns })}
      description={t('comingSoon', { ns })}
    />
  );
}
