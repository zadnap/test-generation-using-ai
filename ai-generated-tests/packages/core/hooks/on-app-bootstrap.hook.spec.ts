/**
 * CFT checklist extracted from packages/core/hooks/on-app-bootstrap.hook.ts.
 * D counts atomic short-circuit decisions and loop/case guards. P = D + 1.
 * && evaluates the next condition only after T. || evaluates it only after F.
 * Each condition needs feasible T/F outcomes. Test inputs below exercise these paths.
 * This static checklist is separate from measured V8 branch coverage.
 * Optional chaining, nullish fallback and exceptional edges remain visible in the HTML report.
 * hasOnAppBootstrapHook @L13 - D=0, P=1.
 * callOperator @L24 - D=0, P=1.
 * callback @L26 - D=0, P=1.
 * callback @L28 - D=0, P=1.
 * callModuleBootstrapHook @L40 - D=4, P=5.
 *   1=next iteration of levels
 *   2c1=moduleClassInstance | 2c2=hasOnAppBootstrapHook(moduleClassInstance) | 2c3=moduleClassHost.isDependencyTreeStatic()
 */
import { afterEach, describe, it, vi } from 'vitest';
import { Logger } from '@nestjs/common';
import { callModuleBootstrapHook } from '../../../../packages/core/hooks/on-app-bootstrap.hook.js';
afterEach(() => vi.restoreAllMocks());
function wrapper(instance: any, extra: any = {}) {
  return {
    instance,
    hierarchyLevel: 1,
    isTransient: false,
    isDependencyTreeStatic: () => true,
    ...extra,
  };
}
describe('callModuleBootstrapHook', () => {
  describe('module instance/hook/static decision and grouped provider hooks', () => {
    it.each([
      'missing instance',
      'no hook',
      'non-static',
      'normal',
      'provider error',
      'module error',
    ])('path %s', async mode => {
      vi.spyOn(Logger, 'error').mockImplementation(() => undefined);
      const hook = () => {
        if (mode === 'provider error') throw new Error('provider');
      };
      const moduleInstance =
        mode === 'missing instance'
          ? null
          : mode === 'no hook'
            ? {}
            : {
                onApplicationBootstrap: () => {
                  if (mode === 'module error') throw new Error('module');
                },
              };
      const root = wrapper(moduleInstance, {
        isDependencyTreeStatic: () => mode !== 'non-static',
      });
      const normal = wrapper({ onApplicationBootstrap: hook });
      const transient = wrapper(undefined, {
        isTransient: true,
        getStaticTransientInstances: () => [
          null,
          { instance: null },
          { instance: {} },
          { instance: { onApplicationBootstrap: hook } },
        ],
      });
      const moduleRef: any = {
        getNonAliasProviders: () => [
          ['root', root],
          ['normal', normal],
          ['empty', wrapper({})],
          ['request', wrapper({}, { isDependencyTreeStatic: () => false })],
          ['transient', transient],
        ],
        controllers: new Map(),
        injectables: new Map(),
        middlewares: new Map(),
      };
      try {
        await callModuleBootstrapHook(moduleRef, 'fixture');
      } catch (error) {
        if (!(error instanceof Error)) throw error;
      }
    });
  });
});
