module.exports = {
  testEnvironment: "node",
  testMatch: ["**/__tests__/**/*.test.js", "**/?(*.)+(spec|test).js"],
  collectCoverageFrom: [
    "**/*.js",
    "!**/node_modules/**",
    "!**/coverage/**",
    "!jest.config.js",
  ],
  setupFilesAfterEnv: ["<rootDir>/tests/setup.js"],
  testTimeout: 30000,
  verbose: true,
};
