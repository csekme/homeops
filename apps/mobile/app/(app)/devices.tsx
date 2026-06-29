/**
 * Security → Devices screen (feature plan §Device registration): the user's active sessions
 * with rename + per-device / all-others sign-out. Presentational over `useDevices`.
 *
 * Per-row actions live behind a single kebab (⋮) → ActionSheet, so the row stays uncluttered.
 * Rename uses a centered Modal (not a bottom sheet) so the on-screen keyboard can't cover it.
 */
import type { DeviceOut } from '@homeops/types';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper,
  ActionsheetItem,
  ActionsheetItemText,
} from '@/components/ui/actionsheet';
import { Badge, BadgeText } from '@/components/ui/badge';
import { Button, ButtonText } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Divider } from '@/components/ui/divider';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import {
  ChevronLeftIcon,
  EditIcon,
  GlobeIcon,
  Icon,
  PhoneIcon,
  ThreeDotsIcon,
  TrashIcon,
} from '@/components/ui/icon';
import { Input, InputField } from '@/components/ui/input';
import {
  Modal,
  ModalBackdrop,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from '@/components/ui/modal';
import { Pressable } from '@/components/ui/pressable';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { useDevices } from '@/features/security/use-devices';

export default function DevicesScreen() {
  const { t, i18n } = useTranslation('settings');
  const router = useRouter();
  const { list, rename, revokeDevice, revokeOthers } = useDevices();
  const devices = list.data?.devices ?? [];
  const hasOthers = devices.some((d) => !d.current);

  const [actionsTarget, setActionsTarget] = useState<DeviceOut | null>(null);
  const [renameTarget, setRenameTarget] = useState<DeviceOut | null>(null);
  const [confirm, setConfirm] = useState<DeviceOut | 'others' | null>(null);

  return (
    <View className="flex-1 bg-background">
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <HStack className="items-center gap-1 px-2 py-2">
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel={t('devices.cancel')}
            className="h-10 w-10 items-center justify-center rounded-md"
          >
            <Icon as={ChevronLeftIcon} size="xl" className="text-foreground" />
          </Pressable>
          <Heading size="lg" numberOfLines={1} className="flex-1">
            {t('devices.title')}
          </Heading>
        </HStack>

        <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
          <Text className="text-sm text-muted-foreground">{t('devices.description')}</Text>

          {devices.length === 0 ? (
            <Card>
              <Text className="text-sm text-muted-foreground">{t('devices.empty')}</Text>
            </Card>
          ) : (
            <Card className="gap-0 p-0">
              {devices.map((device, i) => (
                <View key={device.id}>
                  {i > 0 ? <Divider /> : null}
                  <DeviceRow
                    device={device}
                    locale={i18n.language}
                    onActions={() => setActionsTarget(device)}
                  />
                </View>
              ))}
            </Card>
          )}

          {hasOthers ? (
            <Button variant="outline" onPress={() => setConfirm('others')}>
              <ButtonText>{t('devices.signOutOthers')}</ButtonText>
            </Button>
          ) : null}
        </ScrollView>
      </SafeAreaView>

      {/* Per-device actions: kebab → this sheet (no text input, so a bottom sheet is fine). */}
      <Actionsheet isOpen={actionsTarget !== null} onClose={() => setActionsTarget(null)}>
        <ActionsheetBackdrop />
        <ActionsheetContent>
          <ActionsheetDragIndicatorWrapper>
            <ActionsheetDragIndicator />
          </ActionsheetDragIndicatorWrapper>
          <ActionsheetItem
            onPress={() => {
              setRenameTarget(actionsTarget);
              setActionsTarget(null);
            }}
          >
            <Icon as={EditIcon} size="sm" className="text-foreground" />
            <ActionsheetItemText>{t('devices.rename')}</ActionsheetItemText>
          </ActionsheetItem>
          <ActionsheetItem
            onPress={() => {
              setConfirm(actionsTarget);
              setActionsTarget(null);
            }}
          >
            <Icon as={TrashIcon} size="sm" className="text-destructive" />
            <ActionsheetItemText className="text-destructive">
              {t('devices.signOut')}
            </ActionsheetItemText>
          </ActionsheetItem>
        </ActionsheetContent>
      </Actionsheet>

      <RenameModal
        device={renameTarget}
        onClose={() => setRenameTarget(null)}
        onSubmit={(name) => {
          if (renameTarget?.id) rename.mutate({ deviceId: renameTarget.id, data: { name } });
          setRenameTarget(null);
        }}
      />

      <ConfirmSheet
        target={confirm}
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          if (confirm === 'others') revokeOthers.mutate();
          else if (confirm?.id) revokeDevice(confirm.id, !!confirm.current);
          setConfirm(null);
        }}
      />
    </View>
  );
}

function DeviceRow({
  device,
  locale,
  onActions,
}: {
  device: DeviceOut;
  locale: string;
  onActions: () => void;
}) {
  const { t } = useTranslation('settings');
  const platformIcon = device.platform === 'web' ? GlobeIcon : PhoneIcon;
  const lastSeen = device.last_seen_at
    ? new Date(device.last_seen_at).toLocaleString(locale)
    : '';

  return (
    <HStack space="md" className="items-center p-4">
      <Icon as={platformIcon} size="md" className="text-muted-foreground" />
      <VStack space="xs" className="flex-1">
        <Text className="font-medium" numberOfLines={1}>
          {device.name}
        </Text>
        <HStack space="xs" className="flex-wrap items-center">
          {device.current ? (
            <Badge variant="default">
              <BadgeText>{t('devices.thisDevice')}</BadgeText>
            </Badge>
          ) : null}
          {device.trusted ? (
            <Badge variant="secondary">
              <BadgeText>{t('devices.trusted')}</BadgeText>
            </Badge>
          ) : null}
        </HStack>
        <Text className="text-xs text-muted-foreground" numberOfLines={1}>
          {t('devices.lastSeen', { time: lastSeen })}
          {device.last_ip ? ` · ${device.last_ip}` : ''}
        </Text>
      </VStack>
      <Pressable
        onPress={onActions}
        accessibilityRole="button"
        accessibilityLabel={device.name ?? ''}
        className="h-10 w-10 items-center justify-center rounded-md"
      >
        <Icon as={ThreeDotsIcon} size="md" className="text-muted-foreground" />
      </Pressable>
    </HStack>
  );
}

function RenameModal({
  device,
  onClose,
  onSubmit,
}: {
  device: DeviceOut | null;
  onClose: () => void;
  onSubmit: (name: string) => void;
}) {
  const { t } = useTranslation('settings');
  const [name, setName] = useState('');

  // Seed the field with the current name each time the modal opens for a device.
  useEffect(() => {
    if (device) setName(device.name ?? '');
  }, [device]);

  const submit = () => {
    const trimmed = name.trim();
    onSubmit(trimmed || (device?.name ?? ''));
  };

  return (
    <Modal isOpen={device !== null} onClose={onClose}>
      <ModalBackdrop />
      <ModalContent>
        <ModalHeader>
          <Heading size="sm">{t('devices.renameTitle')}</Heading>
        </ModalHeader>
        <ModalBody>
          <Input>
            <InputField
              value={name}
              maxLength={80}
              autoFocus
              onChangeText={setName}
              onSubmitEditing={submit}
              returnKeyType="done"
              placeholder={t('devices.nameLabel')}
            />
          </Input>
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" onPress={onClose}>
            <ButtonText>{t('devices.cancel')}</ButtonText>
          </Button>
          <Button onPress={submit}>
            <ButtonText>{t('devices.save')}</ButtonText>
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

function ConfirmSheet({
  target,
  onClose,
  onConfirm,
}: {
  target: DeviceOut | 'others' | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const { t } = useTranslation('settings');
  const isOthers = target === 'others';
  const isCurrent = target !== null && target !== 'others' && !!target.current;

  const title = isOthers ? t('devices.signOutOthersTitle') : t('devices.signOutTitle');
  const description = isOthers
    ? t('devices.signOutOthersDescription')
    : isCurrent
      ? t('devices.signOutCurrentDescription')
      : t('devices.signOutDescription');

  return (
    <Actionsheet isOpen={target !== null} onClose={onClose}>
      <ActionsheetBackdrop />
      <ActionsheetContent>
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>
        <VStack space="xs" className="w-full px-3 pb-3 pt-2">
          <Heading size="sm">{title}</Heading>
          <Text className="text-sm text-muted-foreground">{description}</Text>
        </VStack>
        <VStack space="sm" className="w-full px-3 pb-2">
          <Button variant="destructive" onPress={onConfirm}>
            <ButtonText>{t('devices.confirmSignOut')}</ButtonText>
          </Button>
          <Button variant="outline" onPress={onClose}>
            <ButtonText>{t('devices.cancel')}</ButtonText>
          </Button>
        </VStack>
      </ActionsheetContent>
    </Actionsheet>
  );
}
