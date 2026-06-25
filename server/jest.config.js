module.exports = {
  testEnvironment: 'node',
  clearMocks: true,
  restoreMocks: true,
  testMatch: ['**/__tests__/**/*.test.js'],
  setupFilesAfterEnv: ['<rootDir>/__tests__/setup.js'],
  verbose: true,
  forceExit: true,
  detectOpenHandles: true,
  coverageDirectory: 'coverage',
  collectCoverageFrom: ['src/**/*.js', 'routes/**/*.js', 'controllers/**/*.js', 'services/**/*.js']
};
