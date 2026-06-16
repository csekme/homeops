import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Share } from 'react-native';

import { Box } from '@/components/ui/box';
import { Button, ButtonText } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';

/**
 * One-time recovery-codes display (plan §U3). Shown once after enrollment / regeneration;
 * the user copies or shares them and confirms they're saved. Codes are never persisted.
 */
export function RecoveryCodes({ codes, onDone }: { codes: string[]; onDone: () => void }) {
  const { t } = useTranslation('settings');
  const [copied, setCopied] = useState(false);
  const joined = codes.join('\n');

  const copy = async () => {
    await Clipboard.setStringAsync(joined);
    setCopied(true);
  };

  return (
    <VStack space="lg">
      <Heading size="lg">{t('twofactor.recovery.title')}</Heading>
      <Text className="text-typography-500">{t('twofactor.recovery.warning')}</Text>

      <Box className="rounded-md border border-outline-200 bg-background-50 p-3">
        <VStack space="xs">
          {codes.map((code) => (
            <Text key={code} className="text-center font-mono text-typography-900">
              {code}
            </Text>
          ))}
        </VStack>
      </Box>

      <HStack space="sm">
        <Button variant="outline" action="secondary" className="flex-1" onPress={copy}>
          <ButtonText>
            {copied ? t('twofactor.recovery.copied') : t('twofactor.recovery.copy')}
          </ButtonText>
        </Button>
        <Button
          variant="outline"
          action="secondary"
          className="flex-1"
          onPress={() => void Share.share({ message: joined })}
        >
          <ButtonText>{t('twofactor.recovery.download')}</ButtonText>
        </Button>
      </HStack>

      <Button onPress={onDone}>
        <ButtonText>{t('twofactor.recovery.confirmSaved')}</ButtonText>
      </Button>
    </VStack>
  );
}
