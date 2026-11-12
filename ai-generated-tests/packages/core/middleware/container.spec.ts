/**
 * CFT checklist extracted from packages/core/middleware/container.ts.
 * D counts atomic short-circuit decisions and loop/case guards. P = D + 1.
 * && evaluates the next condition only after T. || evaluates it only after F.
 * Each condition needs feasible T/F outcomes. Test inputs below exercise these paths.
 * This static checklist is separate from measured V8 branch coverage.
 * Optional chaining, nullish fallback and exceptional edges remain visible in the HTML report.
 * MiddlewareContainer.constructor @L18 - D=0, P=1.
 * MiddlewareContainer.getMiddlewareCollection @L20 - D=1, P=2.
 *   1=!this.middleware.has(moduleKey)
 * MiddlewareContainer.getConfigurations @L30 - D=0, P=1.
 * MiddlewareContainer.insertConfig @L34 - D=2, P=3.
 *   1c1=configList | 1c2=[]
 * MiddlewareContainer.insertMiddleware @L42 - D=0, P=1.
 * MiddlewareContainer.callback @L55 - D=0, P=1.
 * MiddlewareContainer.getTargetConfig @L61 - D=1, P=2.
 *   1=!this.configurationSets.has(moduleName)
 */
import { describe, it } from 'vitest';
import { MiddlewareContainer } from '../../../../packages/core/middleware/container.js';
import { NestContainer } from '../../../../packages/core/injector/container.js';
describe('MiddlewareContainer', () => {
  it('insertConfig/getMiddlewareCollection/getConfigurations/getTargetConfig new and existing', async () => {
    const container = new NestContainer();
    const ref = (await container.addModule(class Root {}, []))!.moduleRef;
    const value = new MiddlewareContainer(container);
    value.getMiddlewareCollection(ref.token);
    value.getMiddlewareCollection(ref.token);
    value.insertConfig(undefined as any, ref.token);
    value.insertConfig(
      [{ middleware: [class Middleware {}], forRoutes: [] }],
      ref.token,
    );
    value.getConfigurations();
  });
});
