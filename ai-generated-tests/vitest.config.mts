import { defineConfig } from 'vitest/config';
import rootConfig from '../vitest.config.mts';

const root = rootConfig as any;

export default defineConfig({
  ...root,
  test: {
    ...root.test,
    include: ['ai-generated-tests/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      include: ['packages/platform-fastify/**/*.{ts,js}'],
      exclude: [
        'packages/**/*.spec.ts',
        'packages/**/*.test.ts',
        'packages/**/index.ts',
        'packages/**/*.interfaces.ts',
        'packages/platform-fastify/interfaces/**/*.ts',
        'packages/platform-fastify/multipart/interfaces/**/*.ts',
        'packages/platform-fastify/test/**',
      ],
      reporter: ['text', 'html', 'json-summary'],
      reportsDirectory: 'ai-generated-tests/coverage',
    },
  },
});
