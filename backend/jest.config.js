/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["**/__tests__/**/*.test.ts"],
  setupFiles: ["<rootDir>/src/__tests__/setupEnv.ts"],
  // jsdom@29 is ESM-only under the hood and can't be loaded by Jest (CJS).
  moduleNameMapper: {
    "^jsdom$": "<rootDir>/src/__tests__/mocks/jsdom.ts",
  },
};
