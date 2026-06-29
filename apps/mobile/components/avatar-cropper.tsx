/**
 * Circular avatar cropper (feature plan §Avatar, mobile §12). Shows the picked image inside a
 * square frame with a circular guide; the user pinches to zoom and drags to position it with
 * their fingers. On confirm it converts the gesture state (scale + translation) into a source-
 * pixel crop rectangle and runs expo-image-manipulator (crop → resize 512 → JPEG), handing the
 * resulting file URI back to the caller. Built on gesture-handler + reanimated (both already
 * configured at the app root).
 *
 * We crop a square (the circle is purely a guide) because the Avatar component clips to a
 * circle everywhere it renders — so a square file looks right in every circular slot.
 */
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { useState } from 'react';
import { Dimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { Button, ButtonSpinner, ButtonText } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';

const OUTPUT_SIZE = 512;
const MAX_ZOOM = 4;

export interface PickedImage {
  uri: string;
  width: number;
  height: number;
}

interface AvatarCropperProps {
  image: PickedImage;
  onCancel: () => void;
  onConfirm: (croppedUri: string) => void;
  isSaving: boolean;
}

function clamp(value: number, min: number, max: number): number {
  'worklet';
  return Math.min(Math.max(value, min), max);
}

export function AvatarCropper({ image, onCancel, onConfirm, isSaving }: AvatarCropperProps) {
  const { t } = useTranslation('settings');
  const [cropping, setCropping] = useState(false);

  // Square crop frame: a comfortable inset from the screen width.
  const frame = Math.min(Dimensions.get('window').width - 48, 320);
  // Cover-fit at zoom 1: the shorter image side exactly fills the frame.
  const baseScale = frame / Math.min(image.width, image.height);
  const dW = image.width * baseScale;
  const dH = image.height * baseScale;

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  // Keep the frame fully covered: translation is bounded so no gap shows at the edges.
  const clampTranslation = (s: number) => {
    'worklet';
    const maxX = Math.max(0, (dW * s - frame) / 2);
    const maxY = Math.max(0, (dH * s - frame) / 2);
    translateX.value = clamp(translateX.value, -maxX, maxX);
    translateY.value = clamp(translateY.value, -maxY, maxY);
  };

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = clamp(savedScale.value * e.scale, 1, MAX_ZOOM);
      clampTranslation(scale.value);
    })
    .onEnd(() => {
      savedScale.value = scale.value;
    });

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      translateX.value = savedTranslateX.value + e.translationX;
      translateY.value = savedTranslateY.value + e.translationY;
      clampTranslation(scale.value);
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const gesture = Gesture.Simultaneous(pinch, pan);

  const imageStyle = useAnimatedStyle(() => ({
    width: dW,
    height: dH,
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const handleConfirm = async () => {
    setCropping(true);
    try {
      const effectiveScale = baseScale * scale.value;
      const cropPx = Math.min(frame / effectiveScale, image.width, image.height);
      const centerX = image.width / 2 - translateX.value / effectiveScale;
      const centerY = image.height / 2 - translateY.value / effectiveScale;
      const originX = clamp(centerX - cropPx / 2, 0, image.width - cropPx);
      const originY = clamp(centerY - cropPx / 2, 0, image.height - cropPx);

      const result = await manipulateAsync(
        image.uri,
        [
          { crop: { originX, originY, width: cropPx, height: cropPx } },
          { resize: { width: OUTPUT_SIZE, height: OUTPUT_SIZE } },
        ],
        { compress: 0.85, format: SaveFormat.JPEG },
      );
      onConfirm(result.uri);
    } finally {
      setCropping(false);
    }
  };

  const busy = cropping || isSaving;

  return (
    <View className="flex-1 bg-black px-6 pb-8 pt-4 justify-center">
      <VStack space="lg" className="items-center">
        <Heading size="md" className="text-white">
          {t('profile.cropTitle')}
        </Heading>
        <Text className="text-center text-sm text-white/70">{t('profile.cropInstruction')}</Text>

        <GestureDetector gesture={gesture}>
          <View
            style={{ width: frame, height: frame }}
            className="overflow-hidden rounded-md bg-black"
          >
            <Animated.Image source={{ uri: image.uri }} style={imageStyle} resizeMode="cover" />
            {/* Circular guide overlaid on the square crop frame. */}
            <View
              pointerEvents="none"
              style={{ width: frame, height: frame, borderRadius: frame / 2 }}
              className="absolute left-0 top-0 border-2 border-white/80"
            />
          </View>
        </GestureDetector>

        <HStack space="md" className="w-full">
          <Button variant="outline" className="flex-1" onPress={onCancel} isDisabled={busy}>
            <ButtonText>{t('profile.cancel')}</ButtonText>
          </Button>
          <Button className="flex-1" onPress={handleConfirm} isDisabled={busy}>
            {busy ? <ButtonSpinner /> : null}
            <ButtonText>{t('profile.save')}</ButtonText>
          </Button>
        </HStack>
      </VStack>
    </View>
  );
}
