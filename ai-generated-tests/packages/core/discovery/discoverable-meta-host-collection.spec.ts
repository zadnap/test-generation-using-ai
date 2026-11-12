/**
 * CFT checklist extracted from packages/core/discovery/discoverable-meta-host-collection.ts.
 * D counts atomic short-circuit decisions and loop/case guards. P = D + 1.
 * && evaluates the next condition only after T. || evaluates it only after F.
 * Each condition needs feasible T/F outcomes. Test inputs below exercise these paths.
 * This static checklist is separate from measured V8 branch coverage.
 * Optional chaining, nullish fallback and exceptional edges remain visible in the HTML report.
 * DiscoverableMetaHostCollection.addClassMetaHostLink @L38 - D=0, P=1.
 * DiscoverableMetaHostCollection.inspectProvider @L54 - D=0, P=1.
 * DiscoverableMetaHostCollection.inspectController @L72 - D=0, P=1.
 * DiscoverableMetaHostCollection.insertByMetaKey @L83 - D=3, P=4.
 *   1=collection.has(metaKey)
 *   2=next iteration of wrappers
 *   3=existing.id === instanceWrapper.id
 * DiscoverableMetaHostCollection.removeInstanceWrappers @L107 - D=1, P=2.
 *   1=next iteration of [ this.providersByMetaKey, this.controllersByMetaKey, ]
 * DiscoverableMetaHostCollection.callback @L112 - D=0, P=1.
 * DiscoverableMetaHostCollection.callback @L118 - D=2, P=3.
 *   1=next iteration of wrappers
 *   2=ids.has(wrapper.id)
 * DiscoverableMetaHostCollection.getProvidersByMetaKey @L128 - D=0, P=1.
 * DiscoverableMetaHostCollection.getControllersByMetaKey @L136 - D=0, P=1.
 * DiscoverableMetaHostCollection.inspectInstanceWrapper @L144 - D=3, P=4.
 *   1=!metaKeys
 *   2=wrapperByMetaKeyMap.has(hostContainerRef)
 *   3=next iteration of metaKeys
 * DiscoverableMetaHostCollection.getMetaKeysByInstanceWrapper @L172 - D=2, P=3.
 *   1c1=!instanceWrapper.metatype | 1c2=instanceWrapper.inject
 */
import { describe, it } from 'vitest';
import { DiscoverableMetaHostCollection as Collection } from '../../../../packages/core/discovery/discoverable-meta-host-collection.js';
import { ModulesContainer } from '../../../../packages/core/injector/modules-container.js';
import { InstanceWrapper } from '../../../../packages/core/injector/instance-wrapper.js';
describe('DiscoverableMetaHostCollection', () => {
  describe('links/inspect/insert/query/remove wrappers', () => {
    it('new/existing app and key, same/different wrapper id, class/value/factory/null source', () => {
      class Provider {}
      class Other {}
      const modules = new ModulesContainer();
      Collection.addClassMetaHostLink(Provider, 'first');
      Collection.addClassMetaHostLink(Provider, 'second');
      const first = new InstanceWrapper({
        metatype: Provider,
        instance: new Provider(),
      });
      const other = new InstanceWrapper({ metatype: Provider });
      Collection.getProvidersByMetaKey(modules, 'first');
      Collection.getControllersByMetaKey(modules, 'first');
      Collection.removeInstanceWrappers(modules, []);
      for (const wrapper of [
        first,
        other,
        first,
        new InstanceWrapper({ metatype: null, instance: new Provider() }),
        new InstanceWrapper({
          metatype: () => undefined,
          inject: [],
          instance: new Provider(),
        }),
        new InstanceWrapper({ metatype: Other }),
        new InstanceWrapper({ metatype: null }),
      ]) {
        Collection.inspectProvider(modules, wrapper);
        Collection.inspectController(modules, wrapper);
      }
      Collection.getProvidersByMetaKey(modules, 'first');
      Collection.getProvidersByMetaKey(modules, 'absent');
      Collection.getControllersByMetaKey(modules, 'first');
      Collection.getControllersByMetaKey(modules, 'absent');
      Collection.removeInstanceWrappers(modules, [first, null] as any);
      Collection.metaHostLinks.delete(Provider);
    });
  });
});
