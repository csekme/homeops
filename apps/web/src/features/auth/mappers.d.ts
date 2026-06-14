/**
 * DTO mapping for the auth feature — the single place that translates between form
 * shapes (`@homeops/validation` inputs, camelCase) and API request DTOs
 * (`@homeops/types`, snake_case). Keeps pages and hooks free of field-renaming noise.
 */
import type { LoginRequest, RegisterRequest } from '@homeops/types';
import type { LoginInput, RegisterInput } from '@homeops/validation';
export declare function toLoginRequest(values: LoginInput): LoginRequest;
export declare function toRegisterRequest(values: RegisterInput, locale: string): RegisterRequest;
