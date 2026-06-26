import { Controller, type Control, type FieldValues, type Path } from 'react-hook-form';
import type { TextInputProps } from 'react-native';

import {
  FormControl,
  FormControlError,
  FormControlErrorText,
  FormControlLabel,
  FormControlLabelText,
} from '@/components/ui/form-control';
import { Input, InputField } from '@/components/ui/input';

interface TextFieldProps<T extends FieldValues>
  extends Omit<TextInputProps, 'value' | 'onChangeText' | 'onBlur'> {
  control: Control<T>;
  name: Path<T>;
  label: string;
  /** Localized error message (already resolved from the RHF field error), if any. */
  errorMessage?: string;
}

/**
 * react-hook-form `Controller` wired to a gluestack FormControl + Input (phase0-mobile §9).
 * One place that ties validation state to the label/error chrome, so screens stay thin.
 */
export function TextField<T extends FieldValues>({
  control,
  name,
  label,
  errorMessage,
  ...inputProps
}: TextFieldProps<T>) {
  const isInvalid = Boolean(errorMessage);
  return (
    <Controller
      control={control}
      name={name}
      render={({ field: { value, onChange, onBlur } }) => (
        <FormControl isInvalid={isInvalid}>
          <FormControlLabel>
            <FormControlLabelText>{label}</FormControlLabelText>
          </FormControlLabel>
          <Input>
            <InputField
              value={(value as string | undefined) ?? ''}
              onChangeText={onChange}
              onBlur={onBlur}
              {...inputProps}
            />
          </Input>
          {errorMessage ? (
            <FormControlError>
              <FormControlErrorText>{errorMessage}</FormControlErrorText>
            </FormControlError>
          ) : null}
        </FormControl>
      )}
    />
  );
}
