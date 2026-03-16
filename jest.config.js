/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
module.exports = {
  collectCoverage: true,
  projects: [
    {
      displayName: 'stage-2',
      preset: 'ts-jest',
      testEnvironment: 'node',
      testPathIgnorePatterns: ['dist', '\\.stage3\\.spec\\.ts$'],
      transform: {
        '^.+\\.tsx?$': [
          'ts-jest',
          {
            tsconfig: 'tsconfig.json',
          },
        ],
      },
    },
    {
      displayName: 'stage-3',
      preset: 'ts-jest',
      testEnvironment: 'node',
      testMatch: ['**/*.stage3.spec.ts'],
      transform: {
        '^.+\\.tsx?$': [
          'ts-jest',
          {
            tsconfig: 'tsconfig.stage3.json',
          },
        ],
      },
    },
  ],
};

