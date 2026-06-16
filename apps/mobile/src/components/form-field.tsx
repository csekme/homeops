import { Controller, type Control, type FieldPath, type FieldValues } from 'react-hook-form';
import type { TextInputProps } from 'react-native';

import {
  FormControl,
  FormControlError,
  FormControlErrorText,
  FormControlLabel,
  FormControlLabelText,
} from '@/components/ui/form-control';
import { Input, InputField } from '@/components/ui/input';

interface FormFieldProps<TValues extends FieldValues>
  extends Pick<
    TextInputProps,
    'autoCapitalize' | 'keyboardType' | 'autoComplete' | 'textContentType' | 'autoCorrect'
  > {
  control: Control<TValues>;
  name: FieldPath<TValues>;
  label: string;
  errorMessage?: string;
  type?: 'text' | 'password';
}

/**
 * RHF-bound labelled field over gluestack-ui v3 `FormControl` + `Input` (plan §M.2). Keeps
 * pages declarative: label + input + error wired through a `Controller`.
 */
export function FormField<TValues extends FieldValues>({
  control,
  name,
  label,
  errorMessage,
  type = 'text',
  ...inputProps
}: FormFieldProps<TValues>) {
  return (
    <FormControl isInvalid={Boolean(errorMessage)}>
      <FormControlLabel>
        <FormControlLabelText>{label}</FormControlLabelText>
      </FormControlLabel>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <Input variant="outline" size="md">
            <InputField
              type={type}
              value={field.value as string}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              {...inputProps}
            />
          </Input>
        )}
      />
      {errorMessage ? (
        <FormControlError>
          <FormControlErrorText>{errorMessage}</FormControlErrorText>
        </FormControlError>
      ) : null}
    </FormControl>
  );
}
