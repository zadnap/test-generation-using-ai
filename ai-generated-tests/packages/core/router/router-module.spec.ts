/**
 * CFT checklist extracted from packages/core/router/router-module.ts.
 * D counts atomic short-circuit decisions and loop/case guards. P = D + 1.
 * && evaluates the next condition only after T. || evaluates it only after F.
 * Each condition needs feasible T/F outcomes. Test inputs below exercise these paths.
 * This static checklist is separate from measured V8 branch coverage.
 * Optional chaining, nullish fallback and exceptional edges remain visible in the HTML report.
 * RouterModule.constructor @L20 - D=0, P=1.
 * RouterModule.register @L28 - D=0, P=1.
 * RouterModule.deepCloneRoutes @L40 - D=0, P=1.
 * RouterModule.callback @L43 - D=2, P=3.
 *   1=typeof routeOrType === 'function'
 *   2=routeOrType.children
 * RouterModule.initialize @L57 - D=0, P=1.
 * RouterModule.callback @L59 - D=0, P=1.
 * RouterModule.registerModulePathMetadata @L66 - D=0, P=1.
 * RouterModule.updateTargetModulesCache @L77 - D=2, P=3.
 *   1=targetModulesByContainer.has(this.modulesContainer)
 *   2=!moduleRef
 * RouterModule.callback @L86 - D=0, P=1.
 */
import { describe, it } from 'vitest';
import { RouterModule } from '../../../../packages/core/router/router-module.js';
import { NestContainer } from '../../../../packages/core/injector/container.js';
describe('RouterModule', () => {
  it('register/constructor/deepCloneRoutes/initialize/registerModulePathMetadata/updateTargetModulesCache', async () => {
    class Root {}
    class Child {}
    class Missing {}
    const container = new NestContainer();
    await container.addModule(Root, []);
    await container.addModule(Child, []);
    const routes = [
      {
        path: 'root',
        module: Root,
        children: [Child, { path: 'nested', module: Child }],
      },
      { path: 'missing', module: Missing },
    ];
    RouterModule.register(routes);
    new RouterModule(container.getModules(), routes);
    new RouterModule(container.getModules(), []);
  });
});
