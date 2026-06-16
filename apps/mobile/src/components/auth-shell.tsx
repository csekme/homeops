import { type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandMark } from '@/components/brand-mark';
import { LanguageToggle } from '@/components/language-toggle';
import { ThemeToggle } from '@/components/theme-toggle';
import { Card } from '@/components/ui/card';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';

interface AuthShellProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
}

/**
 * Shared layout for every auth screen (gluestack-ui v3): a branded hero over an elevated card
 * holding the screen's title/subtitle and form. The muted page background makes the card read as
 * a distinct surface, and the whole thing is width-capped + centred so it stays comfortable on
 * tablets and web. Language/theme toggles sit in the top corner on every auth screen.
 */
export function AuthShell({ title, subtitle, children }: AuthShellProps) {
  return (
    <SafeAreaView style={{ flex: 1 }} className="bg-muted dark:bg-background" edges={['top', 'bottom']}>
      <HStack space="sm" className="items-center justify-end px-4 pt-2">
        <LanguageToggle />
        <ThemeToggle />
      </HStack>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerClassName="flex-grow justify-center px-6 py-8"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <VStack space="2xl" className="w-full max-w-md self-center">
            <BrandMark />
            <Card
              variant="elevated"
              className="gap-6 rounded-2xl border border-border p-6 shadow-soft-2"
            >
              <VStack space="xs">
                <Heading size="xl" className="text-center text-foreground">
                  {title}
                </Heading>
                {subtitle ? (
                  <Text className="text-center text-muted-foreground">{subtitle}</Text>
                ) : null}
              </VStack>
              {children}
            </Card>
          </VStack>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
