/**
 * CFT checklist extracted from packages/core/injector/instance-links-host.ts.
 * D counts atomic short-circuit decisions and loop/case guards. P = D + 1.
 * && evaluates the next condition only after T. || evaluates it only after F.
 * Each condition needs feasible T/F outcomes. Test inputs below exercise these paths.
 * This static checklist is separate from measured V8 branch coverage.
 * Optional chaining, nullish fallback and exceptional edges remain visible in the HTML report.
 * InstanceLinksHost.constructor @L20 - D=0, P=1.
 * InstanceLinksHost.get @L29 - D=4, P=5.
 *   1=!instanceLinksForGivenToken
 *   2=options.each
 *   3=options.moduleId
 *   4=!instanceLink
 * InstanceLinksHost.callback @L45 - D=0, P=1.
 * InstanceLinksHost.initialize @L55 - D=0, P=1.
 * InstanceLinksHost.callback @L57 - D=0, P=1.
 * InstanceLinksHost.callback @L59 - D=0, P=1.
 * InstanceLinksHost.callback @L62 - D=0, P=1.
 * InstanceLinksHost.callback @L65 - D=0, P=1.
 * InstanceLinksHost.addLink @L71 - D=1, P=2.
 *   1=!existingLinks
 * InstanceLinksHost.getInstanceNameByToken @L91 - D=1, P=2.
 *   1=isFunction(token)
 */
import { describe, it } from 'vitest';
import { NestContainer } from '../../../../packages/core/injector/container.js';
import { InstanceLinksHost } from '../../../../packages/core/injector/instance-links-host.js';

describe('InstanceLinksHost', () => {
  describe('initialize/addLink/get/getInstanceNameByToken', () => {
    it('multiple modules, each, strict module selection and missing tokens', async () => {
      const container = new NestContainer();
      class Provider {}
      class Controller {}
      class Enhancer {}
      const first = (await container.addModule(class First {}, []))!.moduleRef;
      const second = (await container.addModule(class Second {}, []))!
        .moduleRef;
      first.addProvider(Provider);
      second.addProvider(Provider);
      first.addController(Controller);
      first.addInjectable(Enhancer, 'guard');
      const host = new InstanceLinksHost(container);
      host.get(Provider);
      host.get(Provider, { each: true });
      host.get(Provider, { moduleId: first.id });
      for (const [token, options] of [
        [Provider, { moduleId: 'missing' }],
        ['missing', {}],
        [class Missing {}, {}],
      ] as const) {
        try {
          host.get(token, options);
        } catch (error) {
          if (!(error instanceof Error)) throw error;
        }
      }
    });
  });
});
