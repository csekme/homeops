import { useEffect, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  type ScrollViewProps,
} from 'react-native';

/**
 * Current keyboard height (0 when hidden). For bottom-anchored overlays (e.g. an Actionsheet
 * with inputs) that React Native's KeyboardAvoidingView can't lift: apply this as
 * `paddingBottom` so the content rises above the keyboard.
 */
export function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, (e) => setHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener(hideEvent, () => setHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return height;
}

interface KeyboardAwareScrollViewProps extends ScrollViewProps {
  children: React.ReactNode;
  /** Distance from the screen top to this view (e.g. a fixed header height) for iOS padding. */
  keyboardVerticalOffset?: number;
}

/**
 * ScrollView that keeps the focused input visible above the keyboard. Centralizes the
 * keyboard-avoidance recipe so screens with forms (rename, invite, …) don't each get it
 * wrong: iOS pads + auto-insets for the keyboard; taps pass through to controls; the
 * keyboard dismisses on drag.
 */
export function KeyboardAwareScrollView({
  children,
  keyboardVerticalOffset = 0,
  ...props
}: KeyboardAwareScrollViewProps) {
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={keyboardVerticalOffset}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
        {...props}
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
