/**
 * Boot auth state (plan §3.12). On startup we run a single silent
 * `refreshAccessToken()` to rehydrate the in-memory access token from the
 * HttpOnly refresh cookie, THEN allow `useMe` to run. While the boot refresh is
 * in flight the app shows a splash.
 */
interface AuthBootContextValue {
    /** True once the boot refresh round-trip has settled (success or failure). */
    booted: boolean;
}
export declare function AuthBootProvider({ children }: {
    children: React.ReactNode;
}): import("react").JSX.Element;
export declare function useAuthBoot(): AuthBootContextValue;
export {};
