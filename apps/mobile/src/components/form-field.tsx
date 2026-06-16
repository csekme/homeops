import { Controller, type Control, type FieldPath, type FieldValues } from 'react-hook-form';
import type { TextInputProps } from 'react-native';

import { AppIcon, type AppIconName } from '@/components/app-icon';
import {
  FormControl,
  FormControlError,
  FormControlErrorText,
  FormControlLabel,
  FormControlLabelText,
} from '@/components/ui/form-control';
import { Input, InputField, InputSlot } from '@/components/ui/input';

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
  placeholder?: string;
  /** Optional leading icon rendered inside the input (Ionicons name). */
  icon?: AppIconName;
}

/**
 * RHF-bound labelled field over gluestack-ui v3 `FormControl` + `Input` (plan §M.2). Keeps pages
 * declarative: label + input + error wired through a `Controller`. Uses the large, rounded input
 * variant with an optional leading icon for the HomeOps look.
 */
export function FormField<TValues extends FieldValues>({
  control,
  name,
  label,
  errorMessage,
  type = 'text',
  placeholder,
  icon,
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
          <Input variant="outline" size="lg" className="rounded-xl">
            {icon ? (
              <InputSlot className="pl-3">
                <AppIcon name={icon} size={18} className="text-muted-foreground" />
              </InputSlot>
            ) : null}
            <InputField
              type={type}
              value={field.value as string}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              placeholder={placeholder}
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
