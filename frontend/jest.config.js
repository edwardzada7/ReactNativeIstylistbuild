// Jest configuration for unit-testing the app's pure TypeScript logic
// (utilities, constants, and other framework-agnostic helpers). These modules
// have no React Native / Expo runtime dependencies, so ts-jest with a plain
// Node environment runs them directly and fast, without needing the full
// jest-expo native shim.
/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  setupFiles: ['<rootDir>/jest.setup.ts'],
  clearMocks: true,
  collectCoverageFrom: [
    'src/utils/**/*.ts',
    'src/constants/**/*.ts',
    '!src/**/*.d.ts',
    // Pure design tokens (colors/spacing/typography) — no logic to unit-test.
    '!src/constants/theme.ts',
  ],
  coverageDirectory: '<rootDir>/coverage',
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        // The app's tsconfig targets the Expo Metro bundler (module/
        // moduleResolution = bundler), which Node/ts-jest can't execute.
        // Override just the module settings to CommonJS for the test run;
        // type-checking is skipped here (enforced separately via `tsc`).
        isolatedModules: true,
        tsconfig: '<rootDir>/tsconfig.jest.json',
      },
    ],
  },
};
