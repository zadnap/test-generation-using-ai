/**
 * CFT checklist extracted from packages/core/injector/compiler.ts.
 * D counts atomic short-circuit decisions and loop/case guards. P = D + 1.
 * && evaluates the next condition only after T. || evaluates it only after F.
 * Each condition needs feasible T/F outcomes. Test inputs below exercise these paths.
 * This static checklist is separate from measured V8 branch coverage.
 * Optional chaining, nullish fallback and exceptional edges remain visible in the HTML report.
 * ModuleCompiler.constructor @L11 - D=0, P=1.
 * ModuleCompiler.moduleOpaqueKeyFactory @L15 - D=0, P=1.
 * ModuleCompiler.compile @L19 - D=1, P=2.
 *   1=dynamicMetadata
 * ModuleCompiler.extractMetadata @L43 - D=2, P=3.
 *   1=!this.isDynamicModule(moduleClsOrDynamic)
 *   2=(moduleClsOrDynamic as ForwardReference)?.forwardRef
 * ModuleCompiler.isDynamicModule @L61 - D=0, P=1.
 */
import { describe, it } from 'vitest';
import { forwardRef } from '@nestjs/common';
import { ModuleCompiler } from '../../../../packages/core/injector/compiler.js';
import { ByReferenceModuleOpaqueKeyFactory } from '../../../../packages/core/injector/opaque-key-factory/by-reference-module-opaque-key-factory.js';

describe('ModuleCompiler', () => {
  describe('compile/extractMetadata/isDynamicModule/moduleOpaqueKeyFactory', () => {
    class Fixture {}
    it.each([
      Fixture,
      forwardRef(() => Fixture),
      { module: Fixture, providers: [] },
      Promise.resolve({ module: Fixture }),
    ])('module %s', async module => {
      const compiler = new ModuleCompiler(
        new ByReferenceModuleOpaqueKeyFactory(),
      );
      compiler.moduleOpaqueKeyFactory;
      await compiler.compile(module);
    });
  });
});
