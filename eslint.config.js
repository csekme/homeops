import js from '@eslint/js';
import security from 'eslint-plugin-security';
import tseslint from 'typescript-eslint';

// Root config for the shared leaf packages (packages/*). These must stay
// presentation-agnostic pure TS (plan §3.10): no DOM and no React Native imports,
// so the same logic runs unchanged on web and mobile. apps/web has its own config.
export default tseslint.config(
  { ignores: ['**/dist', '**/coverage', '**/src/generated', '**/*.config.ts'] },
  {
    files: ['packages/**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended, security.configs.recommended],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'react-dom',
              message: 'Leaf packages must stay platform-agnostic — no DOM imports (plan §3.10).',
            },
          ],
          patterns: [
            {
              group: ['react-native', 'react-native/*', 'react-dom/*', 'next', 'next/*'],
              message:
                'Leaf packages must stay platform-agnostic — no DOM/RN/framework imports (plan §3.10).',
            },
          ],
        },
      ],
    },
  },
  {
    // Tests exercise the same pure code; relax the security heuristics that flag
    // test fixtures (e.g. object-injection on literal lookups).
    files: ['packages/**/*.test.{ts,tsx}'],
    rules: {
      'security/detect-object-injection': 'off',
    },
  },
);
