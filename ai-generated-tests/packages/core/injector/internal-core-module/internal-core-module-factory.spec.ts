/**
 * CFT checklist extracted from packages/core/injector/internal-core-module/internal-core-module-factory.ts.
 * D counts atomic short-circuit decisions and loop/case guards. P = D + 1.
 * && evaluates the next condition only after T. || evaluates it only after F.
 * Each condition needs feasible T/F outcomes. Test inputs below exercise these paths.
 * This static checklist is separate from measured V8 branch coverage.
 * Optional chaining, nullish fallback and exceptional edges remain visible in the HTML report.
 * InternalCoreModuleFactory.create @L18 - D=0, P=1.
 * InternalCoreModuleFactory.lazyModuleLoaderFactory @L26 - D=0, P=1.
 * InternalCoreModuleFactory.callback @L55 - D=0, P=1.
 * InternalCoreModuleFactory.callback @L59 - D=0, P=1.
 * InternalCoreModuleFactory.callback @L63 - D=0, P=1.
 * InternalCoreModuleFactory.callback @L71 - D=0, P=1.
 */
import { describe, it } from 'vitest';
import { InternalCoreModuleFactory } from '../../../../../packages/core/injector/internal-core-module/internal-core-module-factory.js';
import { NestContainer } from '../../../../../packages/core/injector/container.js';
describe('InternalCoreModuleFactory.create', () => {
  it.each([
    undefined,
    {
      preview: true,
      instrument: { instanceDecorator: (value: unknown) => value },
    },
  ])('options %j', options => {
    const container = new NestContainer(undefined, options);
    const definition = InternalCoreModuleFactory.create(
      container,
      {} as any,
      container.getModuleCompiler(),
      {} as any,
      {} as any,
    );
    for (const provider of definition.providers as any[]) provider.useFactory();
  });
});
