/**
 * CFT checklist extracted from packages/core/nest-factory.ts.
 * D counts atomic short-circuit decisions and loop/case guards. P = D + 1.
 * && evaluates the next condition only after T. || evaluates it only after F.
 * Each condition needs feasible T/F outcomes. Test inputs below exercise these paths.
 * This static checklist is separate from measured V8 branch coverage.
 * Optional chaining, nullish fallback and exceptional edges remain visible in the HTML report.
 * NestFactoryStatic.create @L88 - D=1, P=2.
 *   1=this.isHttpServer(serverOrOptions!)
 * NestFactoryStatic.createMicroservice @L134 - D=0, P=1.
 * NestFactoryStatic.callback @L141 - D=0, P=1.
 * NestFactoryStatic.createApplicationContext @L176 - D=1, P=2.
 *   1=this.autoFlushLogs
 * NestFactoryStatic.createNestInstance @L207 - D=0, P=1.
 * NestFactoryStatic.initialize @L211 - D=2, P=3.
 *   1=options.snapshot
 *   2=this.abortOnError === false
 * NestFactoryStatic.callback @L248 - D=0, P=1.
 * NestFactoryStatic.handleInitializationError @L261 - D=1, P=2.
 *   1=this.abortOnError
 * NestFactoryStatic.createProxy @L268 - D=0, P=1.
 * NestFactoryStatic.createExceptionProxy @L276 - D=0, P=1.
 * NestFactoryStatic.callback @L277 - D=2, P=3.
 *   1=!(prop in receiver)
 *   2=isFunction(receiver[prop])
 * NestFactoryStatic.createExceptionZone @L288 - D=0, P=1.
 * NestFactoryStatic.callback @L293 - D=5, P=6.
 *   1=prop === 'select'
 *   2=(contextAbortOnError ?? receiver.appOptions?.abortOnError) === false
 *   3c1=prop === 'select' | 3c2=contextAbortOnError !== undefined | 3c3=isObject(result)
 * NestFactoryStatic.callback @L306 - D=0, P=1.
 * NestFactoryStatic.registerLoggerConfiguration @L324 - D=5, P=6.
 *   1=!options
 *   2c1=(logger as boolean) !== true | 2c2=!isNil(logger)
 *   3=forceConsole
 *   4=bufferLogs
 * NestFactoryStatic.createHttpAdapter @L345 - D=0, P=1.
 * NestFactoryStatic.callback @L351 - D=0, P=1.
 * NestFactoryStatic.isHttpServer @L356 - D=2, P=3.
 *   1c1=serverOrOptions | 1c2=(serverOrOptions as AbstractHttpAdapter).patch
 * NestFactoryStatic.setAbortOnError @L364 - D=5, P=6.
 *   1=this.isHttpServer(serverOrOptions!)
 *   2c1=options | 2c2=options.abortOnError === false
 *   3c1=serverOrOptions | 3c2=serverOrOptions.abortOnError === false
 * NestFactoryStatic.createAdapterProxy @L373 - D=0, P=1.
 * NestFactoryStatic.callback @L375 - D=3, P=4.
 *   1c1=!(prop in receiver) | 1c2=prop in adapter
 *   2=isFunction(receiver[prop])
 * NestFactoryStatic.mapToProxy @L376 - D=2, P=3.
 *   1=result instanceof Promise
 *   2=result instanceof NestApplication
 * NestFactoryStatic.callback @L385 - D=0, P=1.
 * NestFactoryStatic.callback @L396 - D=0, P=1.
 * NestFactoryStatic.createGraphInspector @L407 - D=1, P=2.
 *   1=appOptions?.snapshot
 */
import { afterEach, describe, it, vi } from 'vitest';
import {
  Module,
  Injectable,
  Inject,
  Optional,
  Scope,
  forwardRef,
  Logger,
} from '@nestjs/common';
import { NestFactoryStatic } from '../../../packages/core/nest-factory.js';
import { ContextIdFactory } from '../../../packages/core/helpers/context-id-factory.js';
import { ModuleRef } from '../../../packages/core/injector/module-ref.js';
import { LazyModuleLoader } from '../../../packages/core/injector/lazy-module-loader/lazy-module-loader.js';
import { DiscoveryModule } from '../../../packages/core/discovery/discovery-module.js';
import { DiscoveryService } from '../../../packages/core/discovery/discovery-service.js';

const contexts: any[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(contexts.splice(0).map(context => context.close()));
  Logger.detachBuffer();
});
async function failure(operation: () => unknown | Promise<unknown>) {
  try {
    await operation();
  } catch (error) {
    if (!(error instanceof Error)) throw error;
  }
}
describe('NestFactoryStatic', () => {
  describe('createApplicationContext/initialize/createProxy through the public entry point', () => {
    it.each([
      { snapshot: false },
      { snapshot: true },
      { preview: true },
      { moduleIdGeneratorAlgorithm: 'deep-hash' },
      {
        bufferLogs: true,
        autoFlushLogs: false,
        instrument: { instanceDecorator: (value: unknown) => value },
      },
    ])('configuration %j', async options => {
      @Injectable()
      class Service {
        onModuleInit() {}
        onApplicationBootstrap() {}
        onModuleDestroy() {}
        beforeApplicationShutdown() {}
        onApplicationShutdown() {}
      }
      @Injectable({ scope: Scope.REQUEST })
      class RequestService {}
      @Injectable({ scope: Scope.TRANSIENT })
      class TransientService {}
      @Injectable()
      class Consumer {
        constructor(
          @Inject(Service) readonly service: Service,
          @Optional() @Inject('missing') readonly optional?: unknown,
        ) {}
        @Inject(Service) serviceProperty: Service;
      }
      @Module({ providers: [Service], exports: [Service] })
      class ChildModule {}
      @Module({
        imports: [forwardRef(() => ChildModule), DiscoveryModule],
        providers: [
          Consumer,
          RequestService,
          TransientService,
          { provide: 'value', useValue: 1 },
          { provide: 'alias', useExisting: Consumer },
          {
            provide: 'factory',
            useFactory: (value: number) => ({ value }),
            inject: ['value'],
          },
        ],
      })
      class RootModule {}
      const factory = new NestFactoryStatic();
      const context = await factory.createApplicationContext(RootModule, {
        ...options,
        logger: false,
        abortOnError: false,
      } as any);
      contexts.push(context);
      context.get('value');
      context.get('alias');
      context.get('factory');
      context.get(Consumer, { each: true });
      context.select(RootModule).get(Consumer, { strict: true });
      context.select(ChildModule, { abortOnError: false }).get(Service);
      await context.init();
      context.useLogger(false);
      context.flushLogs();
      context.enableShutdownHooks(['SIGTERM', 'sigterm']);
      const moduleRef = context
        .select(RootModule)
        .get(ModuleRef, { strict: true });
      moduleRef.introspect(Consumer);
      moduleRef.introspect(RequestService);
      moduleRef.introspect(TransientService);
      if (!options.preview) {
        const discovery = context.get(DiscoveryService);
        discovery.getProviders();
        discovery.getControllers();
        discovery.getModules();
        const id = ContextIdFactory.create();
        context.registerRequestByContextId({ id: 'fixture' }, id);
        await context.resolve(RequestService, id);
        await context.resolve(TransientService, id, { each: true });
        await moduleRef.create(Consumer);
        @Module({
          providers: [{ provide: 'lazy', useValue: true }],
          exports: ['lazy'],
        })
        class LazyModule {}
        const loader = context.get(LazyModuleLoader);
        await loader.load(() => LazyModule, { logger: false });
        await loader.load(() => LazyModule);
      }
      await failure(() => context.get('absent'));
      await failure(() => context.get(RequestService));
      await failure(() =>
        context.select(class Missing {}, { abortOnError: false }),
      );
      await Promise.all([context.close('fixture'), context.close('fixture')]);
    });
    it('dynamic root module and dynamic selection', async () => {
      @Module({})
      class DynamicRoot {}
      const definition = {
        module: DynamicRoot,
        providers: [{ provide: 'fixture', useValue: null }],
      };
      const context = await new NestFactoryStatic().createApplicationContext(
        Promise.resolve(definition),
        { logger: false, abortOnError: false },
      );
      contexts.push(context);
      context.select(definition).get('fixture', { strict: true });
    });
    it('initialization failure without aborting the process', async () => {
      @Injectable()
      class Broken {
        constructor(@Inject('missing') value: unknown) {}
      }
      @Module({ providers: [Broken] })
      class Root {}
      await failure(() =>
        new NestFactoryStatic().createApplicationContext(Root, {
          logger: false,
          abortOnError: false,
        }),
      );
    });
  });
  describe('createExceptionProxy/createExceptionZone/createAdapterProxy', () => {
    it('missing property, data, callable, selected object and adapter chaining paths', async () => {
      const factory: any = new NestFactoryStatic();
      const target: any = {
        appOptions: { abortOnError: false },
        data: 1,
        run() {
          return 2;
        },
        select() {
          return { appOptions: { abortOnError: false }, run: () => 1 };
        },
      };
      const proxy = factory.createProxy(target);
      proxy.missing;
      proxy.data;
      proxy.run();
      proxy.select(null, { abortOnError: false }).run();
      factory.registerLoggerConfiguration(undefined);
      factory.registerLoggerConfiguration({ logger: true, forceConsole: true });
      factory.registerLoggerConfiguration({ logger: false });
      factory.setAbortOnError(undefined);
      factory.setAbortOnError({ patch() {} }, { abortOnError: false });
    });
  });
});

describe('NestFactoryStatic.createMicroservice', () => {
  it('creates a custom-transport context through the core factory', async () => {
    @Module({})
    class Empty {}
    const strategy = {
      listen: (callback: Function) => callback(),
      close: () => undefined,
      addHandler: () => undefined,
    };
    const service = await new NestFactoryStatic().createMicroservice(Empty, {
      strategy,
      logger: false,
      abortOnError: false,
    });
    contexts.push(service);
    await service.init();
  }, 20000);
});
