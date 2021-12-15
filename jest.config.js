/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testPathIgnorePatterns: ['dist'],
  collectCoverage: true,
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.json',
    },
  },
};
