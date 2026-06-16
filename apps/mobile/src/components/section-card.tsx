import { type ReactNode } from 'react';

import { type AppIconName } from '@/components/app-icon';
import { IconBadge } from '@/components/icon-badge';
import { Card } from '@/components/ui/card';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';

interface SectionCardProps {
  icon?: AppIconName;
  title: string;
  subtitle?: string;
  /** Trailing element on the header row (badge, action…). */
  trailing?: ReactNode;
  children?: ReactNode;
}

/**
 * Elevated card with a consistent header (leading icon badge + title/subtitle + optional trailing
 * slot) over an optional body. The repeating building block for dashboard widgets and settings
 * groups — borders + soft shadow give a clean, gluestack-style elevated surface on the muted
 * page background in both light and dark mode.
 */
export function SectionCard({ icon, title, subtitle, trailing, children }: SectionCardProps) {
  return (
    <Card
      variant="elevated"
      className="gap-4 rounded-2xl border border-border shadow-soft-1"
    >
      <HStack space="md" className="items-center">
        {icon ? <IconBadge name={icon} /> : null}
        <VStack space="xs" className="flex-1">
          <Heading size="md" className="text-foreground">
            {title}
          </Heading>
          {subtitle ? <Text className="text-muted-foreground">{subtitle}</Text> : null}
        </VStack>
        {trailing}
      </HStack>
      {children}
    </Card>
  );
}
