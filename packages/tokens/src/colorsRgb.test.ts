import { describe, expect, it } from "vitest";

import { colors, colorsRgb } from "./index";

/**
 * The RN palette (`colorsRgb`) is a manual sRGB derivation of the OKLCH `colors` (plan §6.2,
 * §12 — "validate the conversion once with a snapshot"). RN can't render `oklch` reliably, so
 * the two must agree visually. This locks the derived values: if someone edits the OKLCH
 * source the snapshot fails, forcing a re-derivation rather than a silent drift.
 */
describe("colorsRgb", () => {
  it("covers every semantic light color present in the OKLCH source", () => {
    for (const key of Object.keys(colors)) {
      if (key.startsWith("chart")) continue; // charts are web-only for now
      expect(colorsRgb.light).toHaveProperty(key);
      expect(colorsRgb.dark).toHaveProperty(key);
    }
  });

  it("matches the validated sRGB derivation (light)", () => {
    expect(colorsRgb.light).toMatchObject({
      background: "#ffffff",
      foreground: "#09090b",
      primary: "#2563eb",
      primaryForeground: "#eff6ff",
      destructive: "#e7000b",
      border: "#e4e4e7",
      ring: "#2563eb",
    });
  });

  it("matches the validated sRGB derivation (dark)", () => {
    expect(colorsRgb.dark).toMatchObject({
      background: "#09090b",
      foreground: "#fafafa",
      primary: "#2b7fff",
      muted: "#27272a",
      mutedForeground: "#9f9fa9",
      border: "rgba(255, 255, 255, 0.1)",
      input: "rgba(255, 255, 255, 0.15)",
    });
  });
});
