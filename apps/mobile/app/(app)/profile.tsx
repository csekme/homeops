/**
 * Profile screen (feature plan §Avatar, mobile §13): shows the user's picture (or initials)
 * and lets them set a new one — pick from the library or camera → circular pinch/zoom/pan
 * cropper → upload — or remove it. Presentational over `useAvatar` + `AvatarCropper`.
 */
import { useGetMe } from '@homeops/api-client';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, View } from 'react-native';
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
import { Avatar, AvatarFallbackText, AvatarImage } from '@/components/ui/avatar';
import { AvatarCropper, type PickedImage } from '@/components/avatar-cropper';
import { Button, ButtonSpinner, ButtonText } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import { ChevronLeftIcon, EditIcon, Icon, TrashIcon } from '@/components/ui/icon';
import { Pressable } from '@/components/ui/pressable';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { useAvatar } from '@/features/profile/use-avatar';
import { resolveAvatarUrl } from '@/lib/avatar-url';
import { initials } from '@/lib/initials';

export default function ProfileScreen() {
  const { t } = useTranslation('settings');
  const router = useRouter();
  const { data: user } = useGetMe();
  const { upload, remove, isUploading, isRemoving } = useAvatar();

  const [picked, setPicked] = useState<PickedImage | null>(null);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);

  const avatarUri = resolveAvatarUrl(user?.avatar_url);

  const asPicked = (result: ImagePicker.ImagePickerResult): PickedImage | null => {
    if (result.canceled || !result.assets[0]) return null;
    const a = result.assets[0];
    return { uri: a.uri, width: a.width, height: a.height };
  };

  const pickFromLibrary = async () => {
    setSourceOpen(false);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(t('profile.errors.permissionDenied'));
      return;
    }
    const image = asPicked(
      await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 }),
    );
    if (image) setPicked(image);
  };

  const takePhoto = async () => {
    setSourceOpen(false);
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(t('profile.errors.permissionDenied'));
      return;
    }
    const image = asPicked(
      await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 }),
    );
    if (image) setPicked(image);
  };

  const onCropConfirm = async (uri: string) => {
    const ok = await upload(uri);
    setPicked(null);
    if (!ok) Alert.alert(t('profile.errors.generic'));
  };

  // The cropper takes over the whole screen while positioning a freshly picked image.
  if (picked) {
    return (
      <View className="flex-1 bg-black">
        <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
          <AvatarCropper
            image={picked}
            onCancel={() => setPicked(null)}
            onConfirm={onCropConfirm}
            isSaving={isUploading}
          />
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <HStack className="items-center gap-1 px-2 py-2">
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel={t('profile.cancel')}
            className="h-10 w-10 items-center justify-center rounded-md"
          >
            <Icon as={ChevronLeftIcon} size="xl" className="text-foreground" />
          </Pressable>
          <Heading size="lg" numberOfLines={1} className="flex-1">
            {t('profile.title')}
          </Heading>
        </HStack>

        <VStack space="lg" className="items-center px-6 pt-8">
          <Avatar className="h-28 w-28">
            {avatarUri ? (
              <AvatarImage source={{ uri: avatarUri }} />
            ) : (
              <AvatarFallbackText className="text-2xl">
                {initials(user?.display_name)}
              </AvatarFallbackText>
            )}
          </Avatar>

          <Text className="text-center text-sm text-muted-foreground">
            {t('profile.description')}
          </Text>

          <VStack space="sm" className="w-full">
            <Button onPress={() => setSourceOpen(true)} isDisabled={isUploading}>
              {isUploading ? <ButtonSpinner /> : null}
              <Icon as={EditIcon} size="sm" className="text-primary-foreground" />
              <ButtonText>{avatarUri ? t('profile.change') : t('profile.upload')}</ButtonText>
            </Button>

            {avatarUri ? (
              <Button
                variant="outline"
                onPress={() => setRemoveOpen(true)}
                isDisabled={isRemoving}
              >
                {isRemoving ? <ButtonSpinner /> : null}
                <Icon as={TrashIcon} size="sm" className="text-destructive" />
                <ButtonText>{t('profile.remove')}</ButtonText>
              </Button>
            ) : null}
          </VStack>
        </VStack>
      </SafeAreaView>

      {/* Image source choice (no text input → a bottom sheet is fine). */}
      <Actionsheet isOpen={sourceOpen} onClose={() => setSourceOpen(false)}>
        <ActionsheetBackdrop />
        <ActionsheetContent>
          <ActionsheetDragIndicatorWrapper>
            <ActionsheetDragIndicator />
          </ActionsheetDragIndicatorWrapper>
          <ActionsheetItem onPress={pickFromLibrary}>
            <ActionsheetItemText>{t('profile.pickFromLibrary')}</ActionsheetItemText>
          </ActionsheetItem>
          <ActionsheetItem onPress={takePhoto}>
            <ActionsheetItemText>{t('profile.takePhoto')}</ActionsheetItemText>
          </ActionsheetItem>
        </ActionsheetContent>
      </Actionsheet>

      {/* Remove confirmation. */}
      <Actionsheet isOpen={removeOpen} onClose={() => setRemoveOpen(false)}>
        <ActionsheetBackdrop />
        <ActionsheetContent>
          <ActionsheetDragIndicatorWrapper>
            <ActionsheetDragIndicator />
          </ActionsheetDragIndicatorWrapper>
          <VStack space="xs" className="w-full px-3 pb-3 pt-2">
            <Heading size="sm">{t('profile.removeTitle')}</Heading>
            <Text className="text-sm text-muted-foreground">{t('profile.removeDescription')}</Text>
          </VStack>
          <VStack space="sm" className="w-full px-3 pb-2">
            <Button
              variant="destructive"
              onPress={async () => {
                setRemoveOpen(false);
                const ok = await remove();
                if (!ok) Alert.alert(t('profile.errors.generic'));
              }}
            >
              <ButtonText>{t('profile.remove')}</ButtonText>
            </Button>
            <Button variant="outline" onPress={() => setRemoveOpen(false)}>
              <ButtonText>{t('profile.cancel')}</ButtonText>
            </Button>
          </VStack>
        </ActionsheetContent>
      </Actionsheet>
    </View>
  );
}
