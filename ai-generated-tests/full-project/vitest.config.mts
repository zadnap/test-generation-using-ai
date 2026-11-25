import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

/**
 * Independent Vitest configuration for the `ai-generated-tests/full-project`
 * suite. It does not import any other Vitest config, and its `include` only
 * matches spec files inside `ai-generated-tests/full-project/`.
 */

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const fromRoot = (path: string) => fileURLToPath(new URL(path, import.meta.url));

/**
 * Resolves `.js` imports to `.ts` source files when both exist side-by-side.
 *
 * The NestJS monorepo keeps compiled `.js` output next to the `.ts` sources.
 * Without this plugin, Vite resolves `import './foo.js'` to the compiled JS
 * instead of the original TypeScript source.
 */
function resolveTypescriptSource(): Plugin {
  return {
    name: 'resolve-ts-source',
    enforce: 'pre',
    async resolveId(source, importer, options) {
      if (!importer) return null;
      const resolved = await this.resolve(source, importer, {
        ...options,
        skipSelf: true,
      });
      if (resolved && !resolved.external && resolved.id.endsWith('.js')) {
        const tsPath = resolved.id.replace(/\.js$/, '.ts');
        if (existsSync(tsPath)) return tsPath;
      }
      return null;
    },
  };
}

export default defineConfig({
  // Spec files are excluded from every tsconfig in the repo, so Oxc cannot pick
  // up `experimentalDecorators`/`emitDecoratorMetadata` from them and would emit
  // TC39 decorators (which reject parameter decorators). Configure them here.
  oxc: {
    decorator: {
      legacy: true,
      emitDecoratorMetadata: true,
    },
    assumptions: {
      setPublicClassFields: true,
    },
    typescript: {
      removeClassFieldsWithoutInitializer: true,
    },
  },
  test: {
    globals: true,
    root: repoRoot,
    include: ['ai-generated-tests/full-project/**/*.spec.ts'],
    alias: {
      '@nestjs/common': fromRoot('../../packages/common'),
      '@nestjs/core': fromRoot('../../packages/core'),
      '@nestjs/microservices': fromRoot('../../packages/microservices'),
      '@nestjs/websockets': fromRoot('../../packages/websockets'),
      '@nestjs/testing': fromRoot('../../packages/testing'),
      '@nestjs/platform-express': fromRoot('../../packages/platform-express'),
      '@nestjs/platform-ws': fromRoot('../../packages/platform-ws'),
      '@nestjs/platform-fastify': fromRoot('../../packages/platform-fastify'),
      '@nestjs/platform-node': fromRoot('../../packages/platform-node'),
      '@nestjs/platform-socket.io': fromRoot(
        '../../packages/platform-socket.io',
      ),
    },
    setupFiles: ['reflect-metadata'],
    coverage: {
      provider: 'v8',
      reportOnFailure: true,
      include: ['packages/**/*.ts'],
      exclude: [
        '**/node_modules/**',
        '**/*.d.ts',
        'packages/**/*.spec.ts',
        'packages/**/*.test.ts',
        'packages/**/test/**',
      ],
      reporter: ['text', 'html', 'json-summary', 'json'],
      reportsDirectory: 'ai-generated-tests/full-project/coverage',
    },
  },
  plugins: [resolveTypescriptSource()],
});
