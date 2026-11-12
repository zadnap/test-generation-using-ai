import { readdirSync } from 'node:fs';
import { defineConfig } from 'vitest/config';
import rootConfig from '../vitest.config.mts';

const root = rootConfig as any;
const modules = (process.env.COVERAGE_MODULES || 'all')
  .split(',')
  .map(name => name.trim())
  .filter(Boolean);
const availableModules = readdirSync(new URL('../packages/', import.meta.url), {
  withFileTypes: true,
})
  .filter(entry => entry.isDirectory())
  .map(entry => entry.name);

if (
  modules.length === 0 ||
  (modules.includes('all') && modules.length !== 1) ||
  modules.some(name => name !== 'all' && !availableModules.includes(name))
) {
  throw new Error(
    `Invalid COVERAGE_MODULES. Use all or comma-separated names: ${availableModules.join(', ')}`,
  );
}

const coverageScope = modules.includes('all') ? '*' : modules;

export default defineConfig({
  ...root,
  test: {
    ...root.test,
    include: ['ai-generated-tests/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      include:
        coverageScope === '*'
          ? ['packages/**/*.ts']
          : coverageScope.map(name => `packages/${name}/**/*.ts`),
      exclude: [
        '**/node_modules/**',
        '**/*.d.ts',
        'packages/**/*.spec.ts',
        'packages/**/*.test.ts',
        'packages/**/test/**',
      ],
      reporter: ['text', 'html', 'json-summary'],
      reportsDirectory: `ai-generated-tests/coverage/${modules.join('+')}`,
    },
  },
});
