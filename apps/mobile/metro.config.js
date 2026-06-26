// Metro config for the HomeOps Expo app inside the pnpm monorepo.
// - watchFolders adds the workspace root so Metro can read & transpile the
//   `@homeops/*` workspace packages (shipped as TypeScript source, no build step).
// - nodeModulesPaths lets module resolution fall back to the hoisted root store.
// - resolveRequest rewrites `.js` import specifiers to their `.ts(x)` source: the shared
//   packages use NodeNext-style extensions (`import './money.js'` → `money.ts`), which
//   Vite handles on web but Metro does not out of the box.
// - withNativeWind wires Tailwind/NativeWind through `global.css`.
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    moduleName.endsWith('.js') &&
    (moduleName.startsWith('./') || moduleName.startsWith('../'))
  ) {
    try {
      return context.resolveRequest(context, moduleName, platform);
    } catch {
      // Fall back to the extensionless form so Metro's sourceExts pick up the .ts(x) file.
      return context.resolveRequest(context, moduleName.replace(/\.js$/, ''), platform);
    }
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: './global.css', inlineRem: 16 });
