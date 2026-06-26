/**
 * DTO mapping for the auth feature — the single place that translates between form
 * shapes (`@homeops/validation` inputs, camelCase) and API request DTOs
 * (`@homeops/types`, snake_case). Identical to the web app's mapper.
 */
import type { LoginRequest, RegisterRequest } from '@homeops/types';
import type { LoginInput, RegisterInput } from '@homeops/validation';

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
