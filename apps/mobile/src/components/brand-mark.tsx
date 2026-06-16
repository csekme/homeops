import { useTranslation } from 'react-i18next';

import { AppIcon } from '@/components/app-icon';
import { Center } from '@/components/ui/center';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';

interface BrandMarkProps {
  /** Tagline shown under the wordmark (e.g. the per-screen auth subtitle). */
  tagline?: string;
}

/**
 * HomeOps logo lockup for the auth hero: a brand-blue rounded tile with a home glyph, the
 * wordmark, and an optional tagline. Centralises the brand so every auth screen opens with the
 * same identity instead of a bare heading.
 */
export function BrandMark({ tagline }: BrandMarkProps) {
  const { t } = useTranslation('common');
  return (
    <VStack space="md" className="items-center">
      <Center className="h-16 w-16 rounded-2xl bg-primary shadow-soft-2">
        <AppIcon name="home" size={32} className="text-primary-foreground" />
      </Center>
      <VStack space="xs" className="items-center">
        <Heading size="2xl" className="text-foreground">
          {t('appName')}
        </Heading>
        {tagline ? <Text className="text-center text-muted-foreground">{tagline}</Text> : null}
      </VStack>
    </VStack>
  );
}
