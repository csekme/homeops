/**
 * Sanitizes a post-auth `redirect` query param. Only same-site absolute paths are honoured
 * (must start with a single `/`), so a crafted `?redirect=https://evil.test` can't turn the
 * login page into an open redirect. Anything else falls back to the dashboard.
 */
export function safeRedirect(value: string | null | undefined, fallback = '/'): string {
  if (!value) return fallback;
  // Reject protocol-relative ("//host") and absolute URLs; require a leading slash.
  if (!value.startsWith('/') || value.startsWith('//')) return fallback;
  return value;
}
