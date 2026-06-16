// Expo + NativeWind v4 (gluestack-ui v3) + Reanimated 4 (SDK 54). NativeWind v4.1+ wires
// `className` via `jsxImportSource: 'nativewind'`; gluestack components call `cssInterop`
// directly, so the legacy `nativewind/babel` preset isn't needed. Reanimated 4's transform
// lives in `react-native-worklets/plugin`, which must stay LAST. The `@` alias resolves via
// tsconfig paths (Expo Metro reads them) — no module-resolver required.
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [['babel-preset-expo', { jsxImportSource: 'nativewind' }]],
    plugins: ['react-native-worklets/plugin'],
  };
};
