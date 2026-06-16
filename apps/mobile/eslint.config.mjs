import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import security from 'eslint-plugin-security';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// Mobile flat config (plan §Q1). Mirrors apps/web but with RN globals. Note: the shared
// `packages/*` keep their no-DOM/no-RN guard via the root config — RN imports are only
// allowed here, in apps/mobile.
export default tseslint.config(
  // src/components/ui/** are gluestack-ui v3 vendored components (CLI-generated, like shadcn
  // on web) — not linted.
  { ignores: ['.expo', 'expo-env.d.ts', 'nativewind-env.d.ts', 'src/components/ui/**'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      security.configs.recommended,
    ],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.node, ...globals['react-native'] },
      parserOptions: { tsconfigRootDir: import.meta.dirname },
    },
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // Noisy on safe literal lookups (i18n key maps, variant tables).
      'security/detect-object-injection': 'off',
    },
  },
  {
    files: ['**/*.test.{ts,tsx}'],
    languageOptions: { globals: globals.jest },
  },
);
