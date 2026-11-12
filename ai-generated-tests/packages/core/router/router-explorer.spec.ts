/**
 * CFT checklist extracted from packages/core/router/router-explorer.ts.
 * D counts atomic short-circuit decisions and loop/case guards. P = D + 1.
 * && evaluates the next condition only after T. || evaluates it only after F.
 * Each condition needs feasible T/F outcomes. Test inputs below exercise these paths.
 * This static checklist is separate from measured V8 branch coverage.
 * Optional chaining, nullish fallback and exceptional edges remain visible in the HTML report.
 * RouterExplorer.constructor @L71 - D=0, P=1.
 * RouterExplorer.explore @L106 - D=0, P=1.
 * RouterExplorer.extractRouterPath @L127 - D=2, P=3.
 *   1=isUndefined(path)
 *   2=Array.isArray(path)
 * RouterExplorer.callback @L134 - D=0, P=1.
 * RouterExplorer.applyPathsToRouterProxy @L139 - D=2, P=3.
 *   1c1=routeDefinitions | 1c2=[]
 * RouterExplorer.callback @L148 - D=0, P=1.
 * RouterExplorer.applyCallbackToRouter @L164 - D=4, P=5.
 *   1=isRequestScoped
 *   2c1=routePathMetadata.methodVersion | 2c2=routePathMetadata.controllerVersion | 2c3=routePathMetadata.versioningOptions
 * RouterExplorer.callback @L211 - D=2, P=3.
 *   1c1=isVersioned | 1c2=routePathMetadata.versioningOptions!.type !== VersioningType.URI
 * RouterExplorer.callback @L229 - D=3, P=4.
 *   1=router.normalizePath
 *   2=!deferRegistration
 *   3=onRouteTriggered
 * RouterExplorer.callback @L257 - D=0, P=1.
 * RouterExplorer.callback @L299 - D=1, P=2.
 *   1=isVersioned
 * RouterExplorer.registerResolvedRoute @L318 - D=1, P=2.
 *   1=onRouteTriggered
 * RouterExplorer.callback @L334 - D=0, P=1.
 * RouterExplorer.applyHostFilter @L345 - D=3, P=4.
 *   1=!host
 *   2=Array.isArray(host)
 *   3=Array.isArray(host)
 * RouterExplorer.callback @L355 - D=2, P=3.
 *   1=typeof host === 'string'
 *   2=e instanceof TypeError
 * RouterExplorer.callback @L378 - D=10, P=11.
 *   1c1=httpAdapterRef.getRequestHostname(req) | 1c2=''
 *   2=next iteration of hostRegExps
 *   3=match
 *   4=exp.keys.length > 0
 *   5c1=exp.regexp | 5c2=match.groups
 *   6=next iteration of match.groups
 *   7=!next
 *   8=!hasWarnedOfUnsupportedFiltering
 * RouterExplorer.callback @L390 - D=0, P=1.
 * RouterExplorer.applyVersionFilter @L417 - D=0, P=1.
 * RouterExplorer.createCallbackProxy @L430 - D=0, P=1.
 * RouterExplorer.createRequestScopedHandler @L458 - D=0, P=1.
 * RouterExplorer.callback @L473 - D=0, P=1.
 * RouterExplorer.getContextId @L507 - D=2, P=3.
 *   1=!request[REQUEST_CONTEXT_ID as any]
 *   2=isTreeDurable
 * RouterExplorer.copyMetadataToCallback @L528 - D=1, P=2.
 *   1=next iteration of Reflect.getMetadataKeys(originalCallback)
 */
import { afterEach, describe, it, vi } from 'vitest';
import { Controller, Get, Logger, RequestMethod } from '@nestjs/common';
import { RouterExplorer } from '../../../../packages/core/router/router-explorer.js';
import { MetadataScanner } from '../../../../packages/core/metadata-scanner.js';
import { NestContainer } from '../../../../packages/core/injector/container.js';
import { Injector } from '../../../../packages/core/injector/injector.js';
import { RouterProxy } from '../../../../packages/core/router/router-proxy.js';
import { RouterExceptionFilters } from '../../../../packages/core/router/router-exception-filters.js';
import { ApplicationConfig } from '../../../../packages/core/application-config.js';
import { RoutePathFactory } from '../../../../packages/core/router/route-path-factory.js';
import { NoopGraphInspector } from '../../../../packages/core/inspector/noop-graph-inspector.js';
afterEach(() => vi.restoreAllMocks());
describe('RouterExplorer', () => {
  it('path extraction, host filters, metadata copying and deferred route registration', async () => {
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    const container = new NestContainer();
    const config = new ApplicationConfig();
    const handlers: Function[] = [];
    const adapter: any = {
      get: (_path: any, handler: Function) => handlers.push(handler),
      getRequestHostname: (req: any) => req.hostname,
      getRequestMethod: () => 'GET',
      getRequestUrl: () => '/',
      getOnRouteTriggered: () => vi.fn(),
    };
    container.setHttpAdapter(adapter);
    const explorer: any = new RouterExplorer(
      new MetadataScanner(),
      container,
      new Injector(),
      new RouterProxy(),
      new RouterExceptionFilters(container, config, adapter),
      config,
      new RoutePathFactory(config),
      NoopGraphInspector,
    );
    @Controller(['a', 'b'])
    class TestController {
      @Get('child') handle() {}
    }
    explorer.extractRouterPath(TestController);
    try {
      explorer.extractRouterPath(class Missing {});
    } catch (error) {
      if (!(error instanceof Error)) throw error;
    }
    for (const host of [
      undefined,
      ':sub.example.test',
      /(?<sub>\w+)\.example\.test/,
      ['a.example.test', 'b.example.test'],
    ]) {
      const handler = explorer.applyHostFilter(host, () => undefined);
      handler({ hostname: 'a.example.test' }, {}, () => undefined);
      handler({ hostname: 'other.test' }, {}, () => undefined);
      for (let repeat = 0; repeat < 2; repeat++)
        try {
          handler({ hostname: undefined }, {}, undefined);
        } catch (error) {
          if (!(error instanceof Error)) throw error;
        }
    }
    try {
      explorer.applyHostFilter('bad[', () => undefined);
    } catch (error) {
      if (!(error instanceof TypeError)) throw error;
    }
    const callback = () => undefined;
    Reflect.defineMetadata('fixture', 1, callback);
    explorer.registerResolvedRoute(adapter, {
      method: RequestMethod.GET,
      path: '/fixture',
      targetCallback: callback,
      handler: () => undefined,
    });
    await handlers[0]({}, {}, () => undefined);
    const ref = (await container.addModule(class Root {}, []))!.moduleRef;
    ref.addController(TestController);
    const wrapper = ref.controllers.get(TestController)!;
    wrapper.instance = new TestController();
    const resolved: any[] = [];
    explorer.explore(
      wrapper,
      ref.token,
      adapter,
      undefined,
      { ctrlPath: '/fixture' },
      {
        deferRegistration: true,
        onRouteResolved: (route: any) => resolved.push(route),
      },
    );
    for (const route of resolved)
      explorer.registerResolvedRoute(adapter, route);
  });
});
