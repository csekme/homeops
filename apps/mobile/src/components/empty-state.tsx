import { type AppIconName } from '@/components/app-icon';
import { IconBadge } from '@/components/icon-badge';
import { Badge, BadgeText } from '@/components/ui/badge';
import { Center } from '@/components/ui/center';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';

interface EmptyStateProps {
  icon: AppIconName;
  title: string;
  description: string;
  /** Optional pill above the title — used for the Phase-0 "coming soon" framing. */
  badge?: string;
}

/**
 * Centered illustration-style empty state: a tinted icon badge, an optional status pill, a
 * heading and a muted description. Used for the Phase-0 placeholder tabs and any future
 * "no data yet" surface, so empty screens read as intentional rather than unfinished.
 */
export function EmptyState({ icon, title, description, badge }: EmptyStateProps) {
  return (
    <Center className="flex-1 bg-muted px-10 dark:bg-background">
      <VStack space="lg" className="items-center">
        <IconBadge name={icon} size="lg" />
        <VStack space="xs" className="items-center">
          {badge ? (
            <Badge action="info" variant="solid" className="mb-1 rounded-full">
              <BadgeText>{badge}</BadgeText>
            </Badge>
          ) : null}
          <Heading size="xl" className="text-center text-foreground">
            {title}
          </Heading>
          <Text className="max-w-xs text-center text-muted-foreground">{description}</Text>
        </VStack>
      </VStack>
    </Center>
  );
}
