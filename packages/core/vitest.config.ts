import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/index.ts"],
      // Coverage gate (plan §9/§10): the pure domain logic must stay well-covered.
      thresholds: { statements: 90, branches: 85, functions: 90, lines: 90 },
    },
  },
});
