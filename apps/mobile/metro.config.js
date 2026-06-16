// Monorepo-aware Metro config (plan §M0) + NativeWind (gluestack-ui v3). Watches the repo
// root and resolves the `@homeops/*` workspace packages from the root node_modules. The
// `.js`→`.ts` resolver shim lets Metro resolve the shared packages' NodeNext-style explicit
// `.js` import extensions (tsc/Vite handle them; Metro doesn't by default).
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = Array.from(
  new Set([...(config.watchFolders ?? []), projectRoot, workspaceRoot]),
);
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

const withCss = withNativeWind(config, { input: './global.css' });

const defaultResolveRequest = withCss.resolver.resolveRequest;
withCss.resolver.resolveRequest = (context, moduleName, platform) => {
  const resolve = defaultResolveRequest ?? context.resolveRequest;
  if (/^\.{1,2}\//.test(moduleName) && moduleName.endsWith('.js')) {
    try {
      return resolve(context, moduleName.replace(/\.js$/, ''), platform);
    } catch {
      // fall through to default resolution
    }
  }
  return resolve(context, moduleName, platform);
};

module.exports = withCss;
