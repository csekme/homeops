/**
 * DTO mapping for the auth feature (mirrors `apps/web/src/features/auth/mappers.ts`): the
 * single place translating form shapes (`@homeops/validation`, camelCase) to API DTOs
 * (`@homeops/types`, snake_case). Pure — shared verbatim with web.
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
