/** Jest config for RN component tests (plan §Q1), built on the jest-expo preset. */
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest-setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  // pnpm stores deps under node_modules/.pnpm/<name>@<ver>, so jest-expo's default ignore
  // (which assumes flat node_modules) skips RN/Expo packages that need Babel. Re-include any
  // .pnpm folder whose name contains a RN/Expo marker so they get transformed.
  transformIgnorePatterns: [
    'node_modules/.pnpm/(?!(.*(react-native|expo|nativewind|sonner-native)))',
  ],
};
