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
});

module.exports.transformIgnorePatterns = [
  '/node_modules/(?!(@edx|@edunext|@openedx))',
];

module.exports.transform["^.+\\.[tj]sx?$"] = [
  'ts-jest',
  {
    isolatedModules: true,
    diagnostics: false,
    tsconfig: {
      jsx: 'react-jsx',
      esModuleInterop: true,
      allowSyntheticDefaultImports: true
    }
  }
]
