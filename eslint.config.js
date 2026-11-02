/* global __dirname */
// Flat ESLint config. Boundary rules for the headless core (README §4.2).
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

const coreForbidden = [
  'react', 'react-*', 'react/*', 'react-native', 'react-native-*', 'react-native/*',
  'expo', 'expo-*', 'expo/*', '@expo/*', '@react-native/*', '@react-native-*/*',
  'zustand', 'zustand/*', 'i18next', 'i18next-*', 'react-i18next', 'idb', 'node:*',
];

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', '.expo/*', 'node_modules/*', 'coverage/*', 'playwright-report/*', 'test-results/*'],
  },
  {
    files: ['**/*.{ts,tsx,js,mjs}'],
    ignores: ['packages/core/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [{ group: ['@alp/core/*'], message: 'Import only from the public API "@alp/core" (§4.2).' }] },
      ],
    },
  },
  {
    files: ['packages/core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [{ group: coreForbidden, message: '@alp/core must stay headless (§4.2).' }] },
      ],
      'import/no-extraneous-dependencies': [
        'error',
        { packageDir: [__dirname + '/packages/core'], devDependencies: ['packages/core/test/**'] },
      ],
      'import/no-relative-packages': 'error',
    },
  },
]);
