import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import security from 'eslint-plugin-security';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  // CLI-owned shadcn components and build output are not linted.
  { ignores: ['dist', 'src/components/ui', 'src/hooks/use-mobile.ts'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      security.configs.recommended,
    ],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
      // Disambiguate the TSConfig root (the monorepo root has its own flat config).
      parserOptions: { tsconfigRootDir: import.meta.dirname },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      // Noisy on safe literal lookups (i18n key maps, route tables); the real
      // injection sinks are covered by the other detect-* rules.
      'security/detect-object-injection': 'off',
    },
  },
);
