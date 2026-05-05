import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
    exclude: ['dist', 'node_modules'],

    projects: [
      {
        extends: true,
        test: {
          name: 'legacy-stage-2',
          environment: 'node',
          typecheck: {
            tsconfig: 'tsconfig.stage-2.json',
          },
        },
      },
      {
        extends: true,
        test: {
          name: 'modern-stage-3',
          environment: 'node',
          include: ['**/retryable.decorator.spec.ts'],
          typecheck: {
            tsconfig: 'tsconfig.stage-3.json',
          },
        },
      },
    ],
  },
});
