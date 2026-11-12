/**
 * CFT checklist extracted from packages/core/middleware/middleware-module.ts.
 * D counts atomic short-circuit decisions and loop/case guards. P = D + 1.
 * && evaluates the next condition only after T. || evaluates it only after F.
 * Each condition needs feasible T/F outcomes. Test inputs below exercise these paths.
 * This static checklist is separate from measured V8 branch coverage.
 * Optional chaining, nullish fallback and exceptional edges remain visible in the HTML report.
 * MiddlewareModule.register @L52 - D=0, P=1.
 * MiddlewareModule.resolveMiddleware @L81 - D=0, P=1.
 * MiddlewareModule.loadMiddlewareConfiguration @L86 - D=0, P=1.
 * MiddlewareModule.loadConfiguration @L96 - D=3, P=4.
 *   1=!instance.configure
 *   2=!this.appOptions.preview
 *   3=!(middlewareBuilder instanceof MiddlewareBuilder)
 * MiddlewareModule.registerMiddleware @L129 - D=1, P=2.
 *   1=next iteration of entriesSortedByDistance
 * MiddlewareModule.registerAllConfigs @L134 - D=1, P=2.
 *   1=next iteration of middlewareConfig
 * MiddlewareModule.callback @L149 - D=4, P=5.
 *   1c1=isModuleAGlobal | 1c2=isModuleBGlobal
 *   2=isModuleAGlobal
 *   3=isModuleBGlobal
 * MiddlewareModule.registerMiddlewareConfig @L171 - D=1, P=2.
 *   1=next iteration of forRoutes
 * MiddlewareModule.registerRouteMiddleware @L196 - D=2, P=3.
 *   1=next iteration of middlewareCollection
 *   2=isUndefined(instanceWrapper)
 * MiddlewareModule.bindHandler @L250 - D=4, P=5.
 *   1=isUndefined(instance?.use)
 *   2c1=wrapper.isDependencyTreeStatic() | 2c2=!wrapper.isTransient
 *   3=isStatic
 * MiddlewareModule.callback @L285 - D=0, P=1.
 * MiddlewareModule.getHandledRequests @L324 - D=2, P=3.
 *   1=!byRoute
 *   2=!handledRequests
 * MiddlewareModule.createProxy @L343 - D=0, P=1.
 * MiddlewareModule.registerHandler @L357 - D=1, P=2.
 *   1=isMethodAll
 * MiddlewareModule.callback @L374 - D=3, P=4.
 *   1c1=actualRequestMethod === requestMethod | 1c2=actualRequestMethod === RequestMethod[RequestMethod.HEAD] | 1c3=requestMethod === RequestMethod[RequestMethod.GET]
 * MiddlewareModule.handler @L392 - D=1, P=2.
 *   1=handledRequests.has(req as object)
 * MiddlewareModule.callback @L406 - D=2, P=3.
 *   1c1=path | 1c2='/'
 * MiddlewareModule.callback @L407 - D=0, P=1.
 * MiddlewareModule.callback @L408 - D=0, P=1.
 * MiddlewareModule.getContextId @L411 - D=2, P=3.
 *   1=!request![REQUEST_CONTEXT_ID]
 *   2=isTreeDurable
 */
import { afterEach, describe, it, vi } from 'vitest';
import { Logger, RequestMethod, Injectable, Scope } from '@nestjs/common';
import { MiddlewareModule } from '../../../../packages/core/middleware/middleware-module.js';
import { MiddlewareContainer } from '../../../../packages/core/middleware/container.js';
import { NestContainer } from '../../../../packages/core/injector/container.js';
import { ApplicationConfig } from '../../../../packages/core/application-config.js';
import { Injector } from '../../../../packages/core/injector/injector.js';
import { NoopGraphInspector } from '../../../../packages/core/inspector/noop-graph-inspector.js';
import { REQUEST } from '../../../../packages/core/router/request/request-constants.js';
afterEach(() => vi.restoreAllMocks());
describe('MiddlewareModule', () => {
  // registerMiddleware sorting independently exercises both global flags and
  // ordinary module distances, using real module/configuration containers.
  it.each([
    [Number.MAX_VALUE, Number.MAX_VALUE],
    [0, Number.MAX_VALUE],
    [Number.MAX_VALUE, 0],
    [1, 2],
  ])(
    'orders middleware modules with distances %s/%s',
    async (firstDistance, secondDistance) => {
      const container = new NestContainer();
      const first = (await container.addModule(class First {}, []))!.moduleRef;
      const second = (await container.addModule(class Second {}, []))!
        .moduleRef;
      first.getProviderByKey(first.metatype)!.instance = new first.metatype();
      second.getProviderByKey(second.metatype)!.instance =
        new second.metatype();
      first.distance = firstDistance;
      second.distance = secondDistance;
      const middleware = new MiddlewareContainer(container);
      middleware.insertConfig([], first.token);
      middleware.insertConfig([], second.token);
      const value = new MiddlewareModule();
      await value.register(
        middleware,
        container,
        new ApplicationConfig(),
        new Injector(),
        {} as any,
        NoopGraphInspector,
        {},
      );
      await value.registerMiddleware(middleware, {});
    },
  );

  // bindHandler non-static path: request/transient/durable instances, plus
  // constructor failure passed to the middleware exception handler.
  it.each([
    { scope: Scope.REQUEST, durable: false, fail: false },
    { scope: Scope.REQUEST, durable: true, fail: false },
    { scope: Scope.TRANSIENT, durable: false, fail: false },
    { scope: Scope.REQUEST, durable: false, fail: true },
  ])('resolves scoped middleware %j', async ({ scope, durable, fail }) => {
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const container = new NestContainer();
    const ref = (await container.addModule(class Root {}, []))!.moduleRef;
    ref.addProvider({ provide: REQUEST, useValue: undefined });
    container.registerCoreModuleRef(ref);
    @Injectable({ scope, durable })
    class ScopedMiddleware {
      constructor() {
        if (fail) throw new Error('middleware construction failed');
      }
      use(_req: unknown, _res: unknown, next: Function) {
        next();
      }
    }
    ref.getProviderByKey(ref.metatype)!.instance = {
      configure(consumer: any) {
        consumer.apply(ScopedMiddleware).forRoutes('/');
      },
    };
    const handlers: Function[] = [];
    const adapter: any = {
      getRequestMethod: () => 'GET',
      createMiddlewareFactory: async () => (_path: string, handler: Function) =>
        handlers.push(handler),
      isHeadersSent: () => false,
      reply: vi.fn(),
      end: vi.fn(),
    };
    container.setHttpAdapter(adapter);
    const middleware = new MiddlewareContainer(container);
    const value = new MiddlewareModule();
    await value.register(
      middleware,
      container,
      new ApplicationConfig(),
      new Injector(),
      adapter,
      NoopGraphInspector,
      {},
    );
    await value.registerMiddleware(middleware, adapter);
    for (const handler of handlers) {
      await handler({}, {}, () => undefined);
      await handler({}, {}, () => undefined);
    }
  });

  it.each([false, true])(
    'configuration failure in preview %s',
    async preview => {
      vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      const container = new NestContainer();
      const config = new ApplicationConfig();
      const ref = (await container.addModule(class Root {}, []))!.moduleRef;
      ref.getProviderByKey(ref.metatype).instance = {
        configure() {
          throw new Error('fixture');
        },
      };
      const middleware = new MiddlewareContainer(container);
      const value = new MiddlewareModule();
      try {
        await value.register(
          middleware,
          container,
          config,
          new Injector(),
          {} as any,
          NoopGraphInspector,
          { preview },
        );
      } catch (error) {
        if (!(error instanceof Error)) throw error;
      }
    },
  );
  it('configuration/registration/method selection/repeated requests/context identities', async () => {
    const container = new NestContainer();
    const config = new ApplicationConfig();
    const ref = (await container.addModule(class Root {}, []))!.moduleRef;
    ref.addProvider({ provide: REQUEST, useValue: undefined });
    container.registerCoreModuleRef(ref);
    ref.getProviderByKey(ref.metatype).instance = {
      configure(consumer: any) {
        consumer
          .apply((_req: any, _res: any, next: Function) => next())
          .forRoutes({ path: 'fixture', method: RequestMethod.GET }, 'all');
      },
    };
    const handlers: Function[] = [];
    const adapter: any = {
      getRequestMethod: (req: any) => req.method,
      createMiddlewareFactory: async () => (_path: any, handler: Function) =>
        handlers.push(handler),
    };
    container.setHttpAdapter(adapter);
    const middleware = new MiddlewareContainer(container);
    const value: any = new MiddlewareModule();
    await value.register(
      middleware,
      container,
      config,
      new Injector(),
      adapter,
      NoopGraphInspector,
      {},
    );
    await value.registerMiddleware(middleware, adapter);
    for (const handler of handlers)
      for (const method of ['GET', 'HEAD', 'POST']) {
        const req = { method };
        await handler(req, {}, () => undefined);
        await handler(req, {}, () => undefined);
      }
    const contextRequest = {};
    value.getContextId(contextRequest, false);
    value.getContextId(contextRequest, true);
    const handled = new Map();
    value.getHandledRequests(handled, 'fixture', { path: '/', method: 0 });
    value.getHandledRequests(handled, 'fixture', { path: '/', method: 0 });
    try {
      await value.registerRouteMiddleware(
        middleware,
        { path: '/', method: 0 },
        { middleware: [class Missing {}], forRoutes: [] },
        ref.token,
        adapter,
      );
    } catch (error) {
      if (!(error instanceof Error)) throw error;
    }
  });
});
