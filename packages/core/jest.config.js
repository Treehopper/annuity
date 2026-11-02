/** Headless test run: plain Node, no jest-expo preset (README §4.2). */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  transform: { '^.+\\.ts$': ['babel-jest', { configFile: require.resolve('./babel.config.js') }] },
  moduleFileExtensions: ['ts', 'js', 'json'],
};
