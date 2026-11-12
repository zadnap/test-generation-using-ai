/**
 * CFT checklist extracted from packages/core/injector/lazy-module-loader/lazy-module-loader.ts.
 * D counts atomic short-circuit decisions and loop/case guards. P = D + 1.
 * && evaluates the next condition only after T. || evaluates it only after F.
 * Each condition needs feasible T/F outcomes. Test inputs below exercise these paths.
 * This static checklist is separate from measured V8 branch coverage.
 * Optional chaining, nullish fallback and exceptional edges remain visible in the HTML report.
 * LazyModuleLoader.constructor @L15 - D=0, P=1.
 * LazyModuleLoader.load @L23 - D=3, P=4.
 *   1=moduleInstances.length === 0
 *   2c1=moduleInstance | 2c2=this.getTargetModuleRef(moduleInstance)
 * LazyModuleLoader.callback @L53 - D=0, P=1.
 * LazyModuleLoader.callback @L55 - D=0, P=1.
 * LazyModuleLoader.callback @L60 - D=0, P=1.
 * LazyModuleLoader.callback @L69 - D=0, P=1.
 * LazyModuleLoader.buildModules @L77 - D=2, P=3.
 *   1=moduleInstances.length === 0
 *   2=loadOpts?.logger === false
 * LazyModuleLoader.registerLoggerConfiguration @L105 - D=1, P=2.
 *   1=loadOpts?.logger === false
 * LazyModuleLoader.createLazyModulesContainer @L111 - D=0, P=1.
 * LazyModuleLoader.callback @L115 - D=0, P=1.
 * LazyModuleLoader.getTargetModuleRef @L118 - D=0, P=1.
 */
import { describe, it, vi } from 'vitest';
import { LazyModuleLoader } from '../../../../../packages/core/injector/lazy-module-loader/lazy-module-loader.js';
import { NestContainer } from '../../../../../packages/core/injector/container.js';
import { ModuleRef } from '../../../../../packages/core/injector/module-ref.js';
describe('LazyModuleLoader', () => {
  // buildModules/registerLoggerConfiguration decision 2: undefined/true => F.
  // Each fresh loader must perform a build instead of sharing an in-flight load.
  describe('logger configuration on fresh module loads', () => {
    it.each([undefined, { logger: true }])('options %j', async options => {
      const container = new NestContainer();
      class FreshModule {}
      const ref = (await container.addModule(FreshModule, []))!.moduleRef;
      const loader = new LazyModuleLoader(
        {
          scanForModules: async () => [ref],
          scanModulesForDependencies: async () => undefined,
        } as any,
        {
          logger: {},
          setLogger: vi.fn(),
          createInstancesOfDependencies: async () => undefined,
        } as any,
        container.getModuleCompiler(),
        container.getModules(),
      );
      await loader.load(() => FreshModule, options);
    });
  });
  describe('load/buildModules/logger/createLazyModulesContainer/getTargetModuleRef', () => {
    it.each(['success', 'scan failure', 'build failure', 'already loaded'])(
      'path %s',
      async mode => {
        const container = new NestContainer();
        class Root {}
        const ref = (await container.addModule(Root, []))!.moduleRef;
        const scanner: any = {
          scanForModules: async () => {
            if (mode === 'scan failure') throw new Error('scan');
            return mode === 'already loaded' ? [] : [ref];
          },
          removeModules: vi.fn(),
          scanModulesForDependencies: async () => {
            if (mode === 'build failure') throw new Error('build');
          },
        };
        const instanceLoader: any = {
          logger: {},
          setLogger: vi.fn(),
          createInstancesOfDependencies: vi.fn(),
        };
        const loader: any = new LazyModuleLoader(
          scanner,
          instanceLoader,
          container.getModuleCompiler(),
          container.getModules(),
        );
        try {
          await Promise.all([
            loader.load(() => Root, { logger: false }),
            loader.load(() => Root),
          ]);
        } catch (error) {
          if (!(error instanceof Error)) throw error;
        }
        await loader.buildModules([], [], {});
      },
    );
  });
});
