import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { LanguageToggle } from '@/components/language-toggle';
import { Box } from '@/components/ui/box';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';

interface AuthShellProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

/** Centered card layout shared by the auth screens (phase0-mobile §8; mirrors web AuthShell). */
export function AuthShell({ title, description, children, footer }: AuthShellProps) {
  const { t } = useTranslation();
  return (
    <View className="flex-1 bg-muted">
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <HStack className="items-center justify-between px-4 py-3">
          <Heading size="lg">{t('appName')}</Heading>
          <LanguageToggle />
        </HStack>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerClassName="flex-grow justify-center p-4"
            keyboardShouldPersistTaps="handled"
          >
            <Box className="w-full max-w-sm self-center rounded-xl border border-border bg-card p-6">
              <VStack space="lg">
                <VStack space="xs">
                  <Heading size="2xl">{title}</Heading>
                  {description ? (
                    <Text className="text-muted-foreground">{description}</Text>
                  ) : null}
                </VStack>
                {children}
                {footer ? <View className="items-center">{footer}</View> : null}
              </VStack>
            </Box>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
