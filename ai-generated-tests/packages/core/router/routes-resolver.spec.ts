/**
 * CFT checklist extracted from packages/core/router/routes-resolver.ts.
 * D counts atomic short-circuit decisions and loop/case guards. P = D + 1.
 * && evaluates the next condition only after T. || evaluates it only after F.
 * Each condition needs feasible T/F outcomes. Test inputs below exercise these paths.
 * This static checklist is separate from measured V8 branch coverage.
 * Optional chaining, nullish fallback and exceptional edges remain visible in the HTML report.
 * RoutesResolver.constructor @L42 - D=0, P=1.
 * RoutesResolver.resolve @L69 - D=0, P=1.
 * RoutesResolver.callback @L75 - D=0, P=1.
 * RoutesResolver.registerResolvedRoute @L88 - D=0, P=1.
 * RoutesResolver.registerRouters @L95 - D=0, P=1.
 * RoutesResolver.callback @L103 - D=0, P=1.
 * RoutesResolver.callback @L113 - D=1, P=2.
 *   1=!controllerVersion
 * RoutesResolver.callback @L120 - D=0, P=1.
 * RoutesResolver.callback @L125 - D=0, P=1.
 * RoutesResolver.registerNotFoundHandler @L155 - D=2, P=3.
 *   1c1=applicationRef.setNotFoundHandler | 1c2=applicationRef.setNotFoundHandler(proxy, prefix, excludedRoutes)
 * RoutesResolver.callback @L157 - D=0, P=1.
 * RoutesResolver.registerExceptionHandler @L173 - D=2, P=3.
 *   1c1=applicationRef.setErrorHandler | 1c2=applicationRef.setErrorHandler(proxy, prefix)
 * RoutesResolver.callback @L174 - D=0, P=1.
 * RoutesResolver.getModulePathMetadata @L194 - D=0, P=1.
 * RoutesResolver.getHostMetadata @L203 - D=0, P=1.
 * RoutesResolver.getVersionMetadata @L209 - D=1, P=2.
 *   1=versioningConfig
 */
import { afterEach, describe, it, vi } from 'vitest';
import { Controller, Get, Logger, VersioningType } from '@nestjs/common';
import { RoutesResolver } from '../../../../packages/core/router/routes-resolver.js';
import { ApplicationConfig } from '../../../../packages/core/application-config.js';
import { NestContainer } from '../../../../packages/core/injector/container.js';
import { Injector } from '../../../../packages/core/injector/injector.js';
import { NoopGraphInspector } from '../../../../packages/core/inspector/noop-graph-inspector.js';
import { MODULE_PATH } from '@nestjs/common/internal';
afterEach(() => vi.restoreAllMocks());
describe('RoutesResolver', () => {
  it('resolve/registerRouters/version/module path metadata/not found/error hooks', async () => {
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const container = new NestContainer();
    const config = new ApplicationConfig();
    config.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    let notFound: Function = () => undefined;
    let errorHandler: Function = () => undefined;
    const adapter: any = {
      get: vi.fn(),
      getRequestMethod: () => 'GET',
      getRequestUrl: () => '/',
      isHeadersSent: () => false,
      reply: vi.fn(),
      mapException: (error: any) => error,
      setNotFoundHandler: (handler: Function) => {
        notFound = handler;
      },
      setErrorHandler: (handler: Function) => {
        errorHandler = handler;
      },
    };
    container.setHttpAdapter(adapter);
    const ref = (await container.addModule(class Root {}, []))!.moduleRef;
    @Controller('fixture')
    class TestController {
      @Get() handle() {}
    }
    ref.addController(TestController);
    ref.controllers.get(TestController)!.instance = new TestController();
    Reflect.defineMetadata(MODULE_PATH, 'module', ref.metatype);
    const resolver: any = new RoutesResolver(
      container,
      config,
      new Injector(),
      NoopGraphInspector,
    );
    resolver.resolve(adapter, 'api');
    resolver.registerNotFoundHandler();
    resolver.registerExceptionHandler();
    await notFound({}, {}, () => undefined);
    await errorHandler(new Error('fixture'), {}, {}, () => undefined);
    resolver.registerResolvedRoute(adapter, {
      method: 0,
      path: '/registered',
      targetCallback: () => undefined,
      handler: () => undefined,
    });
  });
});
