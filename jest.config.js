/** Frontend tests (jest-expo). The core has its own Node-only config in packages/core (§4.2). */
module.exports = {
  preset: 'jest-expo/ios',
  roots: ['<rootDir>/src'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@shopify/flash-list|react-native-svg|i18next|react-i18next|zustand|idb|decimal.js-light|@alp/core)',
  ],
};
