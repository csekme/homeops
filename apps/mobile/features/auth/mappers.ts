/**
 * DTO mapping for the auth feature — the single place that translates between form
 * shapes (`@homeops/validation` inputs, camelCase) and API request DTOs
 * (`@homeops/types`, snake_case). Identical to the web app's mapper.
 */
import type {
  ForgotPasswordIn,
  LoginRequest,
  RegisterRequest,
  ResetPasswordIn,
} from '@homeops/types';
import type {
  ForgotPasswordInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
} from '@homeops/validation';

export function toLoginRequest(values: LoginInput): LoginRequest {
  return { email: values.email, password: values.password };
}

export function toRegisterRequest(values: RegisterInput, locale: string): RegisterRequest {
  return {
    email: values.email,
    password: values.password,
    display_name: values.displayName,
    locale,
  };
}

export function toForgotPasswordRequest(
  values: ForgotPasswordInput,
  locale: string,
): ForgotPasswordIn {
  return { email: values.email, locale };
}

export function toResetPasswordRequest(values: ResetPasswordInput, token: string): ResetPasswordIn {
  // confirmPassword is form-only; only the token + new password reach the API.
  return { token, password: values.password };
}
