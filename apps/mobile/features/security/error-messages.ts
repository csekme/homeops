/**
 * Maps 2FA login step-2 (`/verify`) errors to a stable i18n key in the `settings`
 * namespace. The backend keeps these failures generic (no enumeration), so any failure
 * — bad code, reused code, expired challenge — reads as a single "invalid code" message.
 */
export function challengeErrorKey(): string {
  return 'errors.totpInvalid';
}
