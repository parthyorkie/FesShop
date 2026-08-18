/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.ts', '**/tests/**/*.test.js'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  modulePathIgnorePatterns: ['<rootDir>/dist/'],
  clearMocks: true,
  testTimeout: 30000,
  transform: {
    '^.+\\.[tj]s?$': [
      'ts-jest',
      {
        tsconfig: {
          module: 'commonjs',
          allowJs: true,
        },
      },
    ],
  },
  transformIgnorePatterns: ['<rootDir>/node_modules/(?!(uuid)/)'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
};
