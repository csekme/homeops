/**
 * Auth API functions + TanStack Query hooks.
 *
 * INTERIM (Phase 0, plan §3.11): hand-written with the hook shapes orval will emit
 * (`useLogin`, `useMe`, …). When codegen lands, these are replaced by the generated
 * hooks; the `apiFetch` mutator and token store stay.
 */
import type { ActivateRequest, LoginRequest, LoginResponse, MessageResponse, RegisterRequest, User } from '@homeops/types';
export declare function login(body: LoginRequest): Promise<LoginResponse>;
export declare function register(body: RegisterRequest): Promise<MessageResponse>;
export declare function activate(body: ActivateRequest): Promise<MessageResponse>;
export declare function fetchMe(): Promise<User>;
export declare function logout(): Promise<void>;
export declare const meQueryKey: readonly ['auth', 'me'];
export declare function useMe(options?: {
    enabled?: boolean;
}): import("@tanstack/react-query").UseQueryResult<NoInfer<User>, Error>;
export declare function useLogin(): import("@tanstack/react-query").UseMutationResult<LoginResponse, Error, LoginRequest, unknown>;
export declare function useRegister(): import("@tanstack/react-query").UseMutationResult<MessageResponse, Error, RegisterRequest, unknown>;
export declare function useActivate(): import("@tanstack/react-query").UseMutationResult<MessageResponse, Error, ActivateRequest, unknown>;
export declare function useLogout(): import("@tanstack/react-query").UseMutationResult<void, Error, void, unknown>;
