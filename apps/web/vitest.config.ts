import { createRequire } from 'node:module';
import path from 'node:path';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// React-instance unification (pnpm monorepo). There are many nested react copies and react-dom
// lives only at the workspace root, paired with the root react. If the component tree resolves
// a *different* react than the one react-dom renders with, hooks crash ("Cannot read
// properties of null"). So we resolve react-dom and the exact react it pairs with, then alias
// BOTH (and their subpaths — notably react-dom/client, react/jsx-runtime) to that single pair.
const require = createRequire(import.meta.url);
const reactDomDir = path.dirname(require.resolve('react-dom', { paths: [__dirname] }));
const reactDir = path.dirname(require.resolve('react', { paths: [reactDomDir] }));

// Unit/integration tests (jsdom). E2E lives under ./e2e and is run by Playwright, so we scope
// `include` to src/*.test.* and never pick up the *.spec.ts Playwright files.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: '@', replacement: path.resolve(__dirname, './src') },
      { find: /^react$/, replacement: reactDir },
      { find: /^react\/(.*)$/, replacement: `${reactDir}/$1` },
      { find: /^react-dom$/, replacement: reactDomDir },
      { find: /^react-dom\/(.*)$/, replacement: `${reactDomDir}/$1` },
    ],
    dedupe: ['react', 'react-dom', 'react-router', 'react-router-dom', '@tanstack/react-query'],
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    // Inline deps so their `import 'react'` is transformed through the alias above (a single
    // react instance) instead of resolving a nested copy via Node externalization.
    server: { deps: { inline: true } },
  },
});
