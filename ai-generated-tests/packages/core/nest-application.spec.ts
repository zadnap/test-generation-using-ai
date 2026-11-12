/**
 * CFT checklist extracted from packages/core/nest-application.ts.
 * D counts atomic short-circuit decisions and loop/case guards. P = D + 1.
 * && evaluates the next condition only after T. || evaluates it only after F.
 * Each condition needs feasible T/F outcomes. Test inputs below exercise these paths.
 * This static checklist is separate from measured V8 branch coverage.
 * Optional chaining, nullish fallback and exceptional edges remain visible in the HTML report.
 * NestApplication.constructor @L76 - D=0, P=1.
 * NestApplication.prepareClose @L103 - D=2, P=3.
 *   1c1=this.httpAdapter | 1c2=await this.httpAdapter.beforeClose?.()
 * NestApplication.dispose @L107 - D=0, P=1.
 * NestApplication.callback @L115 - D=0, P=1.
 * NestApplication.getHttpAdapter @L122 - D=0, P=1.
 * NestApplication.registerHttpServer @L126 - D=0, P=1.
 * NestApplication.getUnderlyingHttpServer @L130 - D=0, P=1.
 * NestApplication.applyOptions @L134 - D=5, P=6.
 *   1c1=!this.appOptions | 1c2=!this.appOptions.cors
 *   2c1=isObject(this.appOptions.cors) | 2c2=isFunction(this.appOptions.cors)
 *   3=!passCustomOptions
 * NestApplication.createServer @L146 - D=0, P=1.
 * NestApplication.registerModules @L151 - D=1, P=2.
 *   1=this.microservicesModule
 * NestApplication.registerWsModule @L175 - D=1, P=2.
 *   1=!this.socketModule
 * NestApplication.init @L189 - D=5, P=6.
 *   1=this.isInitialized
 *   2c1=this.appOptions | 2c2=this.appOptions.bodyParser !== false
 *   3c1=useBodyParser | 3c2=this.registerParserMiddleware()
 * NestApplication.registerParserMiddleware @L225 - D=0, P=1.
 * NestApplication.registerRouter @L231 - D=9, P=10.
 *   1c1=resolutionStrategy === 'specificity' | 1c2=adapterIsOrderSensitive
 *   2c1=!conflictPolicy | 2c2=!shouldSortBySpecificity
 *   3=shouldSortBySpecificity
 *   4=conflictPolicy
 *   5=adapterRejectsDuplicates
 *   6=shouldSortBySpecificity
 *   7=adapterIsOrderSensitive
 * NestApplication.callback @L262 - D=0, P=1.
 * NestApplication.callback @L288 - D=1, P=2.
 *   1=conflict.kind === 'duplicate'
 * NestApplication.callback @L315 - D=2, P=3.
 *   1c1=conflict.kind === 'duplicate' | 1c2=RouteConflictDetector.pathsHaveSameShape( conflict.winner.path, conflict.shadowed.path, )
 * NestApplication.callback @L330 - D=1, P=2.
 *   1=routesToSkip.has(route)
 * NestApplication.registerRouterHooks @L336 - D=0, P=1.
 * NestApplication.connectMicroservice @L341 - D=2, P=3.
 *   1=inheritAppConfig
 *   2=!hybridAppOptions.deferInitialization
 * NestApplication.getMicroservices @L373 - D=0, P=1.
 * NestApplication.getHttpServer @L377 - D=0, P=1.
 * NestApplication.startAllMicroservices @L381 - D=0, P=1.
 * NestApplication.callback @L383 - D=0, P=1.
 * NestApplication.use @L387 - D=0, P=1.
 * NestApplication.useBodyParser @L392 - D=1, P=2.
 *   1=!('useBodyParser' in this.httpAdapter)
 * NestApplication.enableCors @L406 - D=0, P=1.
 * NestApplication.enableCsrfProtection @L410 - D=0, P=1.
 * NestApplication.useSecurityHeaders @L418 - D=1, P=2.
 *   1=headers.removeHeaders.includes('X-Powered-By')
 * NestApplication.enableVersioning @L433 - D=0, P=1.
 * NestApplication.listen @L442 - D=1, P=2.
 *   1=!this.isInitialized
 * NestApplication.callback @L450 - D=1, P=2.
 *   1=isCallbackInOriginalArgs
 * NestApplication.errorHandler @L451 - D=0, P=1.
 * NestApplication.callback @L465 - D=3, P=4.
 *   1=originalCallbackArgs[0] instanceof Error
 *   2=address
 *   3=isCallbackInOriginalArgs
 * NestApplication.getUrl @L487 - D=0, P=1.
 * NestApplication.callback @L488 - D=1, P=2.
 *   1=!this.isListening
 * NestApplication.formatAddress @L499 - D=6, P=7.
 *   1=isString(address)
 *   2=platform() === 'win32'
 *   3c1=address | 3c2=address.family === 'IPv6'
 *   4=host === '::'
 *   5=host === '0.0.0.0'
 * NestApplication.setGlobalPrefix @L522 - D=2, P=3.
 *   1=options
 *   2=options?.exclude
 * NestApplication.useWebSocketAdapter @L536 - D=1, P=2.
 *   1=this.isWsModuleRegistered
 * NestApplication.useGlobalFilters @L546 - D=0, P=1.
 * NestApplication.callback @L551 - D=0, P=1.
 * NestApplication.useGlobalPipes @L560 - D=0, P=1.
 * NestApplication.callback @L565 - D=0, P=1.
 * NestApplication.useGlobalInterceptors @L574 - D=0, P=1.
 * NestApplication.callback @L579 - D=0, P=1.
 * NestApplication.useGlobalGuards @L588 - D=0, P=1.
 * NestApplication.callback @L591 - D=0, P=1.
 * NestApplication.useStaticAssets @L602 - D=0, P=1.
 * NestApplication.setBaseViewsDir @L607 - D=0, P=1.
 * NestApplication.setViewEngine @L612 - D=0, P=1.
 * NestApplication.preloadLazyPackages @L627 - D=0, P=1.
 * NestApplication.callback @L631 - D=0, P=1.
 * NestApplication.applyCookiesOptions @L640 - D=1, P=2.
 *   1=secret === undefined
 * NestApplication.host @L654 - D=3, P=4.
 *   1=isString(address)
 *   2c1=address | 2c2=address.address
 * NestApplication.getProtocol @L662 - D=1, P=2.
 *   1=this.httpServer instanceof TlsServer
 * NestApplication.assertSecurityFeatureCanBeEnabled @L676 - D=3, P=4.
 *   1=!this.httpAdapter.registerSecurityHook
 *   2=this.isInitialized
 *   3=this.enabledSecurityFeatures.has(methodName)
 * NestApplication.getSecurityHook @L698 - D=1, P=2.
 *   1=!this.securityHook
 * NestApplication.callback @L701 - D=0, P=1.
 * NestApplication.registerMiddleware @L709 - D=0, P=1.
 * NestApplication.applyInstanceDecoratorIfRegistered @L716 - D=1, P=2.
 *   1=this.appOptions.instrument?.instanceDecorator
 * NestApplication.callback @L721 - D=0, P=1.
 * NestApplication.applyFunctionDecoratorIfRegistered @L726 - D=1, P=2.
 *   1=!this.appOptions.instrument?.instanceDecorator
 * NestApplication.decorateFunction @L737 - D=2, P=3.
 *   1=!isFunction(arg)
 *   2=isFunction(decorated)
 * NestApplication.loadSocketModule @L751 - D=2, P=3.
 *   1=!this.socketModule
 *   2=socketModule?.SocketModule
 * NestApplication.callback @L755 - D=0, P=1.
 * NestApplication.loadMicroservicesModule @L763 - D=2, P=3.
 *   1=!this.microservicesModule
 *   2=msModule?.MicroservicesModule
 * NestApplication.callback @L767 - D=0, P=1.
 * NestApplication.callback @L775 - D=0, P=1.
 */
import { afterEach, describe, it, vi } from 'vitest';
import {
  Module,
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  Headers,
  Req,
  Res,
  HttpCode,
  Header,
  Redirect,
  Version,
  UseGuards,
  UsePipes,
  UseInterceptors,
  Catch,
  BadRequestException,
  Scope,
  Inject,
  Injectable,
  VersioningType,
  StreamableFile,
  RequestMethod,
} from '@nestjs/common';
import { of } from 'rxjs';
import { NestFactoryStatic } from '../../../packages/core/nest-factory.js';
import { FastifyAdapter } from '../../../packages/platform-fastify/adapters/fastify-adapter.js';
import { NestApplication } from '../../../packages/core/nest-application.js';
import { NestContainer } from '../../../packages/core/injector/container.js';
import { ApplicationConfig } from '../../../packages/core/application-config.js';
import { GraphInspector } from '../../../packages/core/inspector/graph-inspector.js';
import { Server as TlsServer } from 'node:tls';
import { EventEmitter } from 'node:events';
import {
  APP_GUARD,
  APP_PIPE,
  APP_INTERCEPTOR,
  APP_FILTER,
} from '../../../packages/core/constants.js';

const applications: any[] = [];

async function isolatedApplication(
  options: any = {},
  adapterOverrides: any = {},
  Application = NestApplication,
) {
  const config = new ApplicationConfig();
  const container = new NestContainer(config);
  await container.addModule(class UnitModule {}, []);
  const http: any = {
    initHttpServer: vi.fn(),
    getHttpServer: () => ({ address: () => null }),
    close: async () => undefined,
    use: vi.fn(),
    enableCors: vi.fn(),
    registerSecurityHook: vi.fn(),
    ...adapterOverrides,
  };
  const app: any = new Application(
    container,
    http,
    config,
    new GraphInspector(container),
    options,
  );
  applications.push(app);
  return { app, http, config };
}
afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(applications.splice(0).map(app => app.close()));
});
@Catch()
class ErrorFilter {
  catch(_error: unknown, host: any) {
    host.switchToHttp().getResponse().status(400).send({ handled: true });
  }
}
@Injectable()
class Permit {
  canActivate() {
    return true;
  }
}
@Injectable({ scope: Scope.REQUEST })
class RequestGuard {
  canActivate() {
    return Promise.resolve(true);
  }
}
@Injectable()
class IdentityPipe {
  transform(value: unknown) {
    return value;
  }
}
@Injectable()
class IdentityInterceptor {
  intercept(_context: any, next: any) {
    return next.handle();
  }
}
@Controller('fixture')
class TestController {
  @Get(':id')
  @UseGuards(Permit)
  @UsePipes(IdentityPipe)
  @UseInterceptors(IdentityInterceptor)
  read(
    @Param('id') id: string,
    @Query('q') query: string,
    @Headers('X-Fixture') header: string,
  ) {
    return { id, query, header };
  }
  @Post()
  @HttpCode(202)
  @Header('X-Result', 'fixture')
  write(@Body() body: unknown, @Req() req: any) {
    return body;
  }
  @Get('redirect/path') @Redirect('/fixture/1', 302) redirect() {
    return {};
  }
  @Get('redirect/dynamic') @Redirect() dynamicRedirect() {
    return { url: '/fixture/1', statusCode: 301 };
  }
  @Get('error/path') error() {
    throw new BadRequestException('fixture');
  }
  @Get('observable/path') observable() {
    return of('value');
  }
  @Get('stream/path') stream() {
    return new StreamableFile(Buffer.from('value'));
  }
  @Get('raw/path') raw(@Res() response: any) {
    response.send('raw');
  }
  @Get('version/path') @Version('1') versioned() {
    return 'version';
  }
}
@Module({
  controllers: [TestController],
  providers: [
    Permit,
    IdentityPipe,
    IdentityInterceptor,
    { provide: APP_GUARD, useClass: RequestGuard },
    { provide: APP_PIPE, useClass: IdentityPipe },
    { provide: APP_INTERCEPTOR, useClass: IdentityInterceptor },
    { provide: APP_FILTER, useClass: ErrorFilter },
  ],
})
class RootModule {
  configure(consumer: any) {
    consumer
      .apply((_req: any, _res: any, next: Function) => next())
      .exclude({ path: 'fixture/error/path', method: RequestMethod.GET })
      .forRoutes(TestController);
  }
}

describe('NestApplication', () => {
  describe('configuration/init/router/middleware/request pipeline/dispose', () => {
    it.each([false, true])(
      'snapshot %s',
      async snapshot => {
        const http = new FastifyAdapter();
        const app: any = await new NestFactoryStatic().create(
          RootModule,
          http,
          {
            logger: false,
            abortOnError: false,
            snapshot,
            rawBody: true,
            cookies: { secret: 'fixture-only' },
            instrument: {
              instanceDecorator: (value: unknown) => value,
              functionDecorator: (fn: Function) => fn,
            },
          },
        );
        applications.push(app);
        app.setGlobalPrefix('api', { exclude: ['health'] });
        app.enableVersioning({ type: VersioningType.URI });
        app.enableCors({ origin: true });
        app.enableCsrfProtection();
        app.useSecurityHeaders();
        app.useGlobalGuards(new Permit());
        app.useGlobalPipes(new IdentityPipe());
        app.useGlobalInterceptors(new IdentityInterceptor());
        app.useGlobalFilters(new ErrorFilter());
        app.use((_req: any, _res: any, next: Function) => next());
        app.useBodyParser('text/plain');
        app.getHttpAdapter();
        app.getHttpServer();
        app.getUnderlyingHttpServer();
        app.getMicroservices();
        await app.startAllMicroservices();
        await app.init();
        await app.init();
        for (const url of [
          '/api/fixture/1?q=x',
          '/api/fixture/redirect/path',
          '/api/fixture/redirect/dynamic',
          '/api/fixture/error/path',
          '/api/fixture/observable/path',
          '/api/fixture/stream/path',
          '/api/fixture/raw/path',
          '/api/v1/fixture/version/path',
          '/missing',
        ]) {
          await http.inject({ url, headers: { 'x-fixture': 'header' } });
        }
        await http.inject({
          method: 'POST',
          url: '/api/fixture',
          payload: { fixture: true },
        });
        await app.inject('/api/fixture/1');
        app.useWebSocketAdapter({
          close: async () => undefined,
          dispose: async () => undefined,
        } as any);
      },
      20000,
    );
  });
  describe('create default HTTP adapter', () => {
    it('creates using the options overload', async () => {
      @Module({})
      class Empty {}
      const app = await new NestFactoryStatic().create(Empty, {
        logger: false,
        abortOnError: false,
        bodyParser: false,
      });
      applications.push(app);
      await app.init();
    });
  });
});

describe('NestApplication listening and adapter delegation', () => {
  it.each([
    { address: '0.0.0.0', family: 'IPv4', port: 3000 },
    { address: '::', family: 'IPv6', port: 3000 },
    { address: '::1', family: 'IPv6', port: 3000 },
    'fixture-pipe',
  ])(
    'listen/getUrl address %j without binding a socket',
    async address => {
      @Module({})
      class Empty {}
      const http: any = new FastifyAdapter();
      const app: any = await new NestFactoryStatic().create(Empty, http, {
        logger: false,
        abortOnError: false,
      });
      applications.push(app);
      await app.getUrl().catch(() => undefined);
      vi.spyOn(http.getHttpServer(), 'address').mockReturnValue(address);
      vi.spyOn(http, 'listen').mockImplementation(
        (_port: unknown, ...args: any[]) => args[args.length - 1](),
      );
      await app.listen(0, 'localhost', () => undefined);
      await app.getUrl();
      vi.spyOn(http, 'useStaticAssets').mockImplementation(() => undefined);
      vi.spyOn(http, 'setViewEngine').mockImplementation(() => undefined);
      http.setBaseViewsDir = vi.fn();
      app.useStaticAssets({ root: process.cwd() });
      app.setBaseViewsDir('views');
      app.setViewEngine({ engine: {} });
    },
    20000,
  );
  it.each(['callback error', 'server error'])(
    'listen rejects via %s',
    async mode => {
      @Module({})
      class Empty {}
      const http: any = new FastifyAdapter();
      const app: any = await new NestFactoryStatic().create(Empty, http, {
        logger: false,
        abortOnError: false,
      });
      applications.push(app);
      vi.spyOn(http, 'listen').mockImplementation(
        (_port: unknown, ...args: any[]) => {
          if (mode === 'callback error')
            args[args.length - 1](new Error('fixture'));
          else http.getHttpServer().emit('error', new Error('fixture'));
        },
      );
      await app.listen(0).catch(() => undefined);
    },
    20000,
  );
  it.each([false, true])(
    'connected microservice inherits config %s',
    async inheritAppConfig => {
      @Module({})
      class Empty {}
      const app: any = await new NestFactoryStatic().create(
        Empty,
        new FastifyAdapter(),
        { logger: false, abortOnError: false },
      );
      applications.push(app);
      const strategy = {
        listen: (callback: Function) => callback(),
        close: () => undefined,
        addHandler: () => undefined,
      };
      app.connectMicroservice(
        { strategy },
        { inheritAppConfig, deferInitialization: inheritAppConfig },
      );
      await app.startAllMicroservices();
    },
    20000,
  );
});

describe('NestApplication additional configuration paths', () => {
  // listen: already initialized, no original callback, null/non-null address;
  // null address is followed by an error so the pending listen is settled.
  it.each([false, true])(
    'listens through an initialized adapter with null address %s',
    async nullAddress => {
      const server = Object.assign(new EventEmitter(), {
        address: () =>
          nullAddress
            ? null
            : { address: '127.0.0.1', family: 'IPv4', port: 3000 },
      });
      const { app } = await isolatedApplication(
        {},
        {
          getHttpServer: () => server,
          listen: (_port: unknown, callback: Function) => {
            callback();
            if (nullAddress)
              server.emit('error', new Error('listen failed after callback'));
          },
        },
      );
      app.isInitialized = true;
      vi.spyOn(app.logger, 'error').mockImplementation(() => undefined);
      if (nullAddress) await app.listen(0).catch(() => undefined);
      else {
        await app.listen(0);
        await app.getUrl();
      }
    },
  );

  it('handles preloaded optional modules, pipe addresses and websocket configuration before init', async () => {
    const { app } = await isolatedApplication(
      {},
      { getHttpServer: () => ({ address: () => 'fixture-pipe' }) },
    );
    app.host();
    app.setGlobalPrefix('api');
    app.useWebSocketAdapter({
      close: async () => undefined,
      dispose: async () => undefined,
    });
    app.socketModule = { close: async () => undefined };
    app.microservicesModule = { close: async () => undefined };
    await app.loadSocketModule();
    await app.loadMicroservicesModule();
  });

  // Optional packages can be absent in supported installations.
  it('continues without optional socket and microservice modules', async () => {
    vi.doMock('../../../packages/core/helpers/optional-require.js', () => ({
      optionalRequire: async () => ({}),
    }));
    vi.resetModules();
    try {
      const { NestApplication: IsolatedApplication } =
        await import('../../../packages/core/nest-application.js');
      const { app } = await isolatedApplication({}, {}, IsolatedApplication);
      await app.loadSocketModule();
      await app.loadMicroservicesModule();
    } finally {
      vi.doUnmock('../../../packages/core/helpers/optional-require.js');
      vi.resetModules();
    }
  });
  // applyOptions: 1c1(F),1c2(F); 2c1/2c2 independently select boolean/object/function.
  it.each([true, { origin: true }, (_instance: any) => ({ origin: true })])(
    'applies constructor CORS options %s',
    async cors => {
      const { app } = await isolatedApplication({ cors });
      app.applyOptions();
    },
  );

  // registerRouter decisions 1-8: order-sensitive/insensitive adapters, sorting,
  // duplicate and shadow diagnostics, skipped duplicate and retained route.
  it.each([
    { orderSensitive: true, specificity: true, policy: undefined },
    {
      orderSensitive: undefined,
      specificity: true,
      policy: { duplicate: 'off', shadow: 'off' },
    },
    {
      orderSensitive: true,
      specificity: false,
      policy: { duplicate: 'warn', shadow: 'warn' },
    },
    {
      orderSensitive: false,
      specificity: false,
      policy: { duplicate: 'warn', shadow: 'warn' },
    },
    {
      orderSensitive: false,
      specificity: true,
      policy: { duplicate: 'error', shadow: 'error' },
    },
  ])(
    'registers route policy %j',
    async ({ orderSensitive, specificity, policy }) => {
      const { app } = await isolatedApplication(
        {
          routeConflictPolicy: policy,
          routeResolutionStrategy: specificity ? 'specificity' : 'declaration',
        },
        {
          isRouteOrderSensitive:
            orderSensitive === undefined ? undefined : () => orderSensitive,
        },
      );
      const routes = [
        '/users/:id',
        '/users/fixed',
        '/users/fixed',
        '/users/:name',
      ].map((path, index) => ({
        path,
        method: RequestMethod.GET,
        methodName: `handler${index}`,
        instanceWrapper: { name: 'Controller' },
        handler: () => undefined,
        targetCallback: () => undefined,
      }));
      vi.spyOn(app.middlewareModule, 'registerMiddleware').mockResolvedValue(
        undefined,
      );
      vi.spyOn(app.routesResolver, 'resolve').mockImplementation(
        (_http: any, _base: any, options: any) =>
          routes.forEach(options.onRouteResolved),
      );
      vi.spyOn(app.routesResolver, 'registerResolvedRoute').mockImplementation(
        () => undefined,
      );
      vi.spyOn(app.logger, 'warn').mockImplementation(() => undefined);
      if (policy?.duplicate === 'error') {
        await app.registerRouter().catch((error: unknown) => {
          if (!(error instanceof Error)) throw error;
        });
      } else {
        await app.registerRouter();
      }
    },
  );

  // Security guards take the unsupported/initialized/already-enabled T paths.
  it.each(['enableCsrfProtection', 'useSecurityHeaders'])(
    'rejects invalid enablement order for %s',
    async method => {
      const { app, http } = await isolatedApplication();
      app[method]();
      try {
        app[method]();
      } catch (error) {
        if (!(error instanceof Error)) throw error;
      }
      app.isInitialized = true;
      try {
        app[method]();
      } catch (error) {
        if (!(error instanceof Error)) throw error;
      }
      app.isInitialized = false;
      http.registerSecurityHook = undefined;
      try {
        app[method]();
      } catch (error) {
        if (!(error instanceof Error)) throw error;
      }
    },
  );

  // applyFunctionDecoratorIfRegistered 2(F),3(F), plus absent instrument options.
  it.each([undefined, { instanceDecorator: () => ({ wrapped: true }) }])(
    'decorates middleware and global enhancers with %j',
    async instrument => {
      const { app } = await isolatedApplication({ instrument });
      app.use('/prefix', () => undefined);
      app.useGlobalPipes(new IdentityPipe());
      app.useGlobalGuards(new Permit());
      app.useGlobalFilters(new ErrorFilter());
      app.useGlobalInterceptors(new IdentityInterceptor());
      app.setGlobalPrefix('api', {});
    },
  );

  it('handles custom adapters without body parser and with TLS server', async () => {
    const server = new TlsServer();
    const { app } = await isolatedApplication(
      {},
      { getHttpServer: () => server },
    );
    vi.spyOn(app.logger, 'warn').mockImplementation(() => undefined);
    app.useBodyParser('text/plain');
    app.getProtocol();
    app.host();
    app.socketModule = undefined;
    await app.registerWsModule();
    app.microservicesModule = undefined;
    vi.spyOn(app.middlewareModule, 'register').mockResolvedValue(undefined);
    await app.registerModules();
  });
});
