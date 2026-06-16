/** Tiny className combiner (RN/NativeWind). No tailwind-merge needed — class lists are short. */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}
