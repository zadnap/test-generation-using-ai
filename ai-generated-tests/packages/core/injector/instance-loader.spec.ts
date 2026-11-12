/**
 * CFT checklist extracted from packages/core/injector/instance-loader.ts.
 * D counts atomic short-circuit decisions and loop/case guards. P = D + 1.
 * && evaluates the next condition only after T. || evaluates it only after F.
 * Each condition needs feasible T/F outcomes. Test inputs below exercise these paths.
 * This static checklist is separate from measured V8 branch coverage.
 * Optional chaining, nullish fallback and exceptional edges remain visible in the HTML report.
 * InstanceLoader.constructor @L12 - D=0, P=1.
 * InstanceLoader.setLogger @L21 - D=0, P=1.
 * InstanceLoader.createInstancesOfDependencies @L25 - D=0, P=1.
 * InstanceLoader.createPrototypes @L40 - D=0, P=1.
 * InstanceLoader.callback @L41 - D=0, P=1.
 * InstanceLoader.createInstances @L48 - D=0, P=1.
 * InstanceLoader.callback @L50 - D=2, P=3.
 *   1c1=this.isModuleWhitelisted(name) | 1c2=this.logger.log(MODULE_INIT_MESSAGE`${name}`)
 * InstanceLoader.createPrototypesOfProviders @L62 - D=0, P=1.
 * InstanceLoader.callback @L64 - D=0, P=1.
 * InstanceLoader.createInstancesOfProviders @L69 - D=0, P=1.
 * InstanceLoader.callback @L73 - D=1, P=2.
 *   1=!item.isAlias
 * InstanceLoader.createPrototypesOfControllers @L88 - D=0, P=1.
 * InstanceLoader.callback @L90 - D=0, P=1.
 * InstanceLoader.createInstancesOfControllers @L95 - D=0, P=1.
 * InstanceLoader.callback @L99 - D=0, P=1.
 * InstanceLoader.createPrototypesOfInjectables @L106 - D=0, P=1.
 * InstanceLoader.callback @L108 - D=0, P=1.
 * InstanceLoader.createInstancesOfInjectables @L113 - D=0, P=1.
 * InstanceLoader.callback @L117 - D=0, P=1.
 * InstanceLoader.isModuleWhitelisted @L124 - D=0, P=1.
 */
import { afterEach, describe, it, vi } from 'vitest';
import { Logger } from '@nestjs/common';
import { NestContainer } from '../../../../packages/core/injector/container.js';
import { InstanceLoader } from '../../../../packages/core/injector/instance-loader.js';
import { Injector } from '../../../../packages/core/injector/injector.js';
import { NoopGraphInspector } from '../../../../packages/core/inspector/noop-graph-inspector.js';
import { InternalCoreModule } from '../../../../packages/core/injector/internal-core-module/internal-core-module.js';
afterEach(() => vi.restoreAllMocks());
describe('InstanceLoader', () => {
  describe('createInstancesOfDependencies prototype and instance phases', () => {
    it.each([false, true])('provider constructor throws %s', async throws => {
      vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
      const container = new NestContainer();
      const ref = (await container.addModule(class Root {}, []))!.moduleRef;
      await container.addModule(InternalCoreModule, []);
      class Provider {
        constructor() {
          if (throws) throw new Error('fixture');
        }
      }
      class Controller {}
      class Enhancer {}
      ref.addProvider(Provider);
      ref.addProvider({ provide: 'alias', useExisting: Provider });
      ref.addController(Controller);
      ref.addInjectable(Enhancer, 'guard');
      const loader = new InstanceLoader(
        container,
        new Injector(),
        NoopGraphInspector,
      );
      loader.setLogger(new Logger());
      try {
        await loader.createInstancesOfDependencies();
      } catch (error) {
        if (!(error instanceof Error)) throw error;
      }
    });
  });
});
