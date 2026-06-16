import { type ReactNode } from 'react';
import { ScrollView, type ScrollViewProps } from 'react-native';

import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';

interface ScreenProps extends ScrollViewProps {
  children: ReactNode;
  /** Extra classes appended to the scroll content container. */
  contentClassName?: string;
}

/**
 * Standard authenticated-tab scroll surface (plan §U2). Provides the muted page background that
 * makes elevated cards read as distinct surfaces, plus consistent gutters and bottom padding so
 * content clears the tab bar. The bottom-tab header already owns the top safe-area inset, so this
 * deliberately does not re-apply it. Keeps every tab screen to a single declarative wrapper.
 */
export function Screen({ children, contentClassName = '', ...rest }: ScreenProps) {
  return (
    <ScrollView
      className="flex-1 bg-muted dark:bg-background"
      contentContainerClassName={`gap-5 px-4 pb-10 pt-5 ${contentClassName}`}
      showsVerticalScrollIndicator={false}
      {...rest}
    >
      {children}
    </ScrollView>
  );
}

interface ScreenTitleProps {
  title: string;
  subtitle?: string;
  /** Optional trailing element (e.g. an action button) aligned to the title row. */
  action?: ReactNode;
}

/** Large page title + optional subtitle, mirroring the web page headers. */
export function ScreenTitle({ title, subtitle, action }: ScreenTitleProps) {
  return (
    <HStack className="items-start justify-between" space="md">
      <VStack space="xs" className="flex-1">
        <Heading size="2xl" className="text-foreground">
          {title}
        </Heading>
        {subtitle ? <Text className="text-muted-foreground">{subtitle}</Text> : null}
      </VStack>
      {action}
    </HStack>
  );
}
