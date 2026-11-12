/**
 * CFT checklist extracted from packages/core/discovery/discovery-service.ts.
 * D counts atomic short-circuit decisions and loop/case guards. P = D + 1.
 * && evaluates the next condition only after T. || evaluates it only after F.
 * Each condition needs feasible T/F outcomes. Test inputs below exercise these paths.
 * This static checklist is separate from measured V8 branch coverage.
 * Optional chaining, nullish fallback and exceptional edges remain visible in the HTML report.
 * DiscoveryService.constructor @L51 - D=0, P=1.
 * DiscoveryService.createDecorator @L59 - D=0, P=1.
 * DiscoveryService.decoratorFn @L62 - D=1, P=2.
 *   1=!descriptor
 * DiscoveryService.callback @L63 - D=1, P=2.
 *   1=!descriptor
 * DiscoveryService.getProviders @L84 - D=1, P=2.
 *   1='metadataKey' in options
 * DiscoveryService.callback @L96 - D=0, P=1.
 * DiscoveryService.getControllers @L107 - D=1, P=2.
 *   1='metadataKey' in options
 * DiscoveryService.callback @L120 - D=0, P=1.
 * DiscoveryService.getMetadataByDecorator @L131 - D=1, P=2.
 *   1=methodKey
 * DiscoveryService.getModules @L151 - D=1, P=2.
 *   1=!includeInOpts
 * DiscoveryService.includeWhitelisted @L161 - D=0, P=1.
 * DiscoveryService.callback @L163 - D=0, P=1.
 * DiscoveryService.callback @L164 - D=0, P=1.
 */
import { describe, it } from 'vitest';
import { DiscoveryService } from '../../../../packages/core/discovery/discovery-service.js';
import { DiscoverableMetaHostCollection } from '../../../../packages/core/discovery/discoverable-meta-host-collection.js';
import { ModulesContainer } from '../../../../packages/core/injector/modules-container.js';
import { InstanceWrapper } from '../../../../packages/core/injector/instance-wrapper.js';
describe('DiscoveryService', () => {
  describe('createDecorator/getMetadataByDecorator/getProviders/getControllers/getModules/includeWhitelisted', () => {
    it('class/method metadata, included modules, keyed/unkeyed discovery and wrapper fallback', () => {
      const decorator = DiscoveryService.createDecorator();
      class Provider {
        method() {}
      }
      decorator()(Provider);
      decorator({ value: 1 })(
        Provider.prototype,
        'method',
        Object.getOwnPropertyDescriptor(Provider.prototype, 'method'),
      );
      const modules = new ModulesContainer();
      const wrapper = new InstanceWrapper({
        metatype: Provider,
        instance: new Provider(),
      });
      modules.set('fixture', {
        metatype: Provider,
        providers: new Map([[Provider, wrapper]]),
        controllers: new Map([[Provider, wrapper]]),
      } as any);
      const service = new DiscoveryService(modules);
      DiscoverableMetaHostCollection.inspectProvider(modules, wrapper);
      DiscoverableMetaHostCollection.inspectController(modules, wrapper);
      for (const options of [
        {},
        { include: [] },
        { include: [Provider] },
        { metadataKey: decorator.KEY },
        { metadataKey: 'missing' },
      ]) {
        service.getProviders(options);
        service.getControllers(options);
      }
      service.getMetadataByDecorator(decorator, wrapper);
      service.getMetadataByDecorator(decorator, wrapper, 'method');
      service.getMetadataByDecorator(
        decorator,
        new InstanceWrapper({ metatype: Provider }),
      );
      DiscoverableMetaHostCollection.metaHostLinks.delete(Provider);
    });
  });
});
