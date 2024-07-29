const { createConfig } = require('@openedx/frontend-build');

module.exports = createConfig('jest', {
  // setupFilesAfterEnv is used after the jest environment has been loaded.  In general this is what you want.
  // If you want to add config BEFORE jest loads, use setupFiles instead.
  setupFiles: ['<rootDir>/.env.test'],
  setupFilesAfterEnv: [
    '<rootDir>/src/setupTest.jsx',
  ],
  coveragePathIgnorePatterns: [
    'src/setupTest.jsx',
    'src/i18n',
  ],
  // see https://github.com/axios/axios/issues/5026
  moduleNameMapper: {
    "^axios$": "axios/dist/axios.js",
    // See https://stackoverflow.com/questions/72382316/jest-encountered-an-unexpected-token-react-markdown
    'react-markdown': '<rootDir>/node_modules/react-markdown/react-markdown.min.js',
  },
  testTimeout: 30000,
  testEnvironment: 'jsdom'
});
