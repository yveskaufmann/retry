import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { fixupPluginRules } from '@eslint/compat';
import { FlatCompat } from '@eslint/eslintrc';
import js from '@eslint/js';
import typescriptEslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import _import from 'eslint-plugin-import';
import jest from 'eslint-plugin-jest';
import prettier from 'eslint-plugin-prettier';
import unicorn from 'eslint-plugin-unicorn';
import globals from 'globals';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

export default [
  {
    ignores: ['**/dist', '**/node_modules'],
  },
  ...compat.extends('eslint:recommended', 'plugin:@typescript-eslint/recommended', 'prettier'),
  {
    plugins: {
      '@typescript-eslint': typescriptEslint,
      jest,
      prettier,
      unicorn,
      'import': fixupPluginRules(_import),
    },

    languageOptions: {
      globals: {
        ...Object.fromEntries(Object.entries(globals.browser).map(([key]) => [key, 'off'])),
        ...globals.node,
        ...globals.jest,
      },

      parser: tsParser,
    },

    rules: {
      'prettier/prettier': 'off',
      'no-unused-vars': 'off',
      'no-fallthrough': 'off',
      'no-case-declarations': 'off',
      'no-constant-condition': 'off',
      'require-yield': 'off',

      'prefer-const': [
        'error',
        {
          destructuring: 'all',
          ignoreReadBeforeAssign: true,
        },
      ],

      '@typescript-eslint/ban-ts-comment': [
        'error',
        {
          'ts-expect-error': 'allow-with-description',
          'ts-ignore': 'allow-with-description',
          'ts-nocheck': 'allow-with-description',
          'ts-check': false,
        },
      ],

      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          vars: 'local',
          varsIgnorePattern: '^_',
          args: 'none',
          ignoreRestSiblings: true,
          argsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^ignore',
        },
      ],

      '@typescript-eslint/no-namespace': 'off',
      '@typescript-eslint/no-var-requires': 'error',

      '@typescript-eslint/no-explicit-any': [
        'off',
        {
          ignoreRestArgs: true,
        },
      ],

      '@typescript-eslint/no-empty-interface': [
        'error',
        {
          allowSingleExtends: true,
        },
      ],

      '@typescript-eslint/member-ordering': [
        'warn',
        {
          default: ['static-field', 'static-method', 'instance-field', 'constructor', 'instance-method'],
        },
      ],

      '@typescript-eslint/explicit-module-boundary-types': [
        'warn',
        {
          allowHigherOrderFunctions: true,
          allowTypedFunctionExpressions: true,
        },
      ],

      'import/order': [
        'error',
        {
          'groups': ['builtin', 'external', 'internal', 'parent', 'sibling', 'index', 'object'],
          'pathGroupsExcludedImportTypes': ['builtin'],
          'newlines-between': 'always',

          'alphabetize': {
            order: 'asc',
            caseInsensitive: true,
          },
        },
      ],

      'no-inner-declarations': 'off',

      'unicorn/filename-case': [
        'error',
        {
          case: 'kebabCase',
        },
      ],
    },
  },
];
