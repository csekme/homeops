/**
 * In-memory hand-off for the 2FA challenge token (phase0-mobile §7/§11).
 *
 * The login step-1 response carries a short-lived `challenge_token`. Like the web app
 * (which uses in-memory router state, never the URL), we keep it out of the navigable
 * route — expo-router params would surface in deep links. The login screen stashes it
 * here and navigates to `/login/verify`, which reads it once. A direct visit / app
 * restart finds it empty and is sent back to `/login`.
 */
interface PendingChallenge {
  challengeToken: string;
  redirectTo: string;
}

let pending: PendingChallenge | null = null;

export function setPendingChallenge(value: PendingChallenge): void {
  pending = value;
}

export function getPendingChallenge(): PendingChallenge | null {
  return pending;
}

export function clearPendingChallenge(): void {
  pending = null;
}
