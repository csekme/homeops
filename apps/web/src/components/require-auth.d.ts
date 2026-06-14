/**
 * Route guard (plan §3.12). Waits for the boot refresh, then uses `useMe`
 * (enabled only after boot) to decide. Unauthenticated → redirect to /login.
 */
export declare function RequireAuth(): import("react").JSX.Element;
