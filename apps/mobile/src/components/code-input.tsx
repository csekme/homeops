import { useRef, useState } from 'react';
import { Pressable, TextInput } from 'react-native';

import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { Text } from '@/components/ui/text';

interface CodeInputProps {
  value: string;
  onChange: (value: string) => void;
  /** Number of cells; 6 for a TOTP code. */
  length?: number;
  /** Auto-submit when the last cell is filled. */
  onComplete?: (value: string) => void;
}

/**
 * Segmented numeric code entry (plan §U1) built on gluestack-ui v3 primitives (Box/HStack/
 * Text) over one hidden `TextInput`. No SMS/Passwords autofill — the TOTP is typed from the
 * authenticator app, so iOS `oneTimeCode` would inject a wrong value.
 */
export function CodeInput({ value, onChange, length = 6, onComplete }: CodeInputProps) {
  const inputRef = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);

  const handleChange = (next: string) => {
    const digits = next.replace(/\D/g, '').slice(0, length);
    onChange(digits);
    if (digits.length === length) onComplete?.(digits);
  };

  return (
    <Pressable onPress={() => inputRef.current?.focus()}>
      <HStack space="sm" className="justify-between">
        {Array.from({ length }).map((_, i) => {
          const active = focused && i === value.length;
          return (
            <Box
              key={i}
              className={`h-12 flex-1 items-center justify-center rounded-md border bg-background-0 ${
                active ? 'border-primary-500' : 'border-outline-300'
              }`}
            >
              <Text className="text-xl font-semibold text-typography-900">{value[i] ?? ''}</Text>
            </Box>
          );
        })}
      </HStack>
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={handleChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        keyboardType="number-pad"
        textContentType="none"
        autoComplete="off"
        autoCorrect={false}
        importantForAutofill="no"
        maxLength={length}
        className="absolute h-px w-px opacity-0"
      />
    </Pressable>
  );
}
