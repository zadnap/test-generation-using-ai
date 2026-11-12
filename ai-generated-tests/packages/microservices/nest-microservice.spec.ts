import { Logger } from '@nestjs/common';
import { ApplicationConfig } from '@nestjs/core';
import { NestContainer } from '@nestjs/core/injector/container.js';
import { GraphInspector } from '@nestjs/core/inspector/graph-inspector.js';
import { MESSAGES } from '@nestjs/core/internal';
import { describe, expect, it, vi } from 'vitest';
import { Transport } from '../../../packages/microservices/enums/transport.enum.js';
import { NestMicroservice } from '../../../packages/microservices/nest-microservice.js';
import { ServerTCP } from '../../../packages/microservices/server/server-tcp.js';

const socketModuleStub = vi.hoisted(() => ({
  current: undefined as any,
}));

// `loadSocketModule` dynamically imports this package; the getter lets each
// test decide whether the package exposes a SocketModule or not. Vitest only
// matches mock ids given as resolved absolute paths here, so the id is literal.
vi.mock(
  'F:/học/uet/kiểm thử/test-generation-using-ai/packages/websockets/socket-module.js',
  () => ({
    get SocketModule() {
      return socketModuleStub.current;
    },
  }),
);

const asAny = <T>(value: T) => value as any;

const createStrategy = (overrides: Record<string, any> = {}) => ({
  listen: vi.fn(),
  close: vi.fn(async () => undefined),
  on: vi.fn(),
  unwrap: vi.fn(() => 'server'),
  status: 'STATUS',
  ...overrides,
});

const createApp = (config: Record<string, any> = {}) => {
  const container = new NestContainer();
  const graphInspector = new GraphInspector(container);
  const applicationConfig = new ApplicationConfig();
  const instance = new NestMicroservice(
    container,
    { strategy: createStrategy(), ...config } as any,
    graphInspector,
    applicationConfig,
  );
  return { instance, container, graphInspector, applicationConfig };
};

beforeEach(() => {
  socketModuleStub.current = undefined;
  // Silence Nest's own preview/warning chatter; instance-level spies still work.
  vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
  vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

/**
 * Constructor decisions (there is no separate constructor method):
 *   D1 `config.preview` truthy? (preview warning + Injector preview flag)
 *   D2 `config.instrument?.instanceDecorator` present?
 *   D3 `'strategy'` handling delegated to createServer. The `status` getter has
 *      no decisions; it forwards the server status.
 */
describe('NestMicroservice constructor / status', () => {
  it('creates the default TCP server when no strategy is given (D3 false)', () => {
    const container = new NestContainer();
    const graphInspector = new GraphInspector(container);
    const addRpcTarget = vi.spyOn(container.getModules(), 'addRpcTarget');

    const instance = new NestMicroservice(
      container,
      {} as any,
      graphInspector,
      new ApplicationConfig(),
    );

    expect(asAny(instance).serverInstance).toBeInstanceOf(ServerTCP);
    expect(asAny(instance).microserviceConfig.transport).toBe(Transport.TCP);
    expect(addRpcTarget).toHaveBeenCalledWith(asAny(instance).serverInstance);
  });

  it('accepts a custom strategy and exposes its status', () => {
    const strategy = createStrategy({ status: 'READY' });
    const { instance } = createApp({ strategy });

    expect(asAny(instance).serverInstance).toBe(strategy);
    expect(instance.status).toBe('READY');
  });

  it('passes preview and the instance decorator to the injector (D1 true, D2 true)', () => {
    const instanceDecorator = vi.fn((target: any) => target);
    const { instance } = createApp({
      preview: true,
      instrument: { instanceDecorator },
    });

    expect(asAny(instance).injector).toBeDefined();
  });

  it('works without preview and without an instance decorator (D1 false, D2 false)', () => {
    const { instance } = createApp({});

    expect(asAny(instance).injector).toBeDefined();
    expect(instance.status).toBe('STATUS');
  });
});

/**
 * `createServer` decisions:
 *   D1 `'useFactory' in config`? async versus synchronous config.
 *   D2 resolved config has `'strategy'`? true -> use it, false -> factory.
 *   D3 synchronous config has `'strategy'`? true -> use it, false -> factory.
 *   D4 does anything throw? catch -> logger.error, rethrow.
 */
describe('NestMicroservice.createServer', () => {
  it('builds the server through the factory for a plain config (D1 false, D3 false)', () => {
    const { instance } = createApp({});

    instance.createServer({ transport: Transport.TCP } as any);

    expect(asAny(instance).serverInstance).toBeInstanceOf(ServerTCP);
    expect(asAny(instance).microserviceConfig).toEqual({
      transport: Transport.TCP,
    });
  });

  it('uses a synchronous strategy without calling the factory (D1 false, D3 true)', () => {
    const { instance } = createApp({});
    const strategy = createStrategy();

    instance.createServer({ transport: Transport.TCP, strategy } as any);

    expect(asAny(instance).serverInstance).toBe(strategy);
    expect(asAny(instance).microserviceConfig).toEqual({
      transport: Transport.TCP,
      strategy,
    });
  });

  it('resolves a config without a strategy through the factory (D1 true, D2 false)', () => {
    const { instance } = createApp({});

    instance.createServer({
      useFactory: () => ({ transport: Transport.TCP }),
      inject: [],
    } as any);

    expect(asAny(instance).serverInstance).toBeInstanceOf(ServerTCP);
    expect(asAny(instance).microserviceConfig.transport).toBe(Transport.TCP);
  });

  it('resolves a strategy from an async config (D1 true, D2 true)', () => {
    const { instance } = createApp({});
    const strategy = createStrategy();

    instance.createServer({
      useFactory: () => ({ strategy }),
      inject: [],
    } as any);

    expect(asAny(instance).serverInstance).toBe(strategy);
  });

  it('logs and rethrows resolution errors (D4 catch)', () => {
    const { instance } = createApp({});
    const errorSpy = vi
      .spyOn(asAny(instance).logger, 'error')
      .mockImplementation(() => {});
    const error = new Error('resolution failed');

    expect(() =>
      instance.createServer({
        useFactory: () => {
          throw error;
        },
        inject: [],
      } as any),
    ).toThrow(error);
    expect(errorSpy).toHaveBeenCalledWith(error);
  });
});

/**
 * `registerModules` decisions:
 *   D1 `isConnectedToApplication`? true -> hybrid short-circuit (D2 preview
 *      controls registerListeners), false -> full setup.
 *   D2 `appOptions.preview`? true -> clients/listeners are not set up.
 *   D3 `this.socketModule` truthy? true -> gateways registered.
 *   D4 `wasInitHookCalled` false? -> init + bootstrap hooks.
 */
describe('NestMicroservice.registerModules', () => {
  const setup = (config: Record<string, any> = {}) => {
    const app = createApp(config);
    const microservicesModule = asAny(app.instance).microservicesModule;
    const setupClients = vi
      .spyOn(microservicesModule, 'setupClients')
      .mockImplementation(() => {});
    const setupListeners = vi
      .spyOn(microservicesModule, 'setupListeners')
      .mockImplementation(() => {});
    const registerListeners = vi
      .spyOn(app.instance, 'registerListeners')
      .mockImplementation(() => {});
    const callInitHook = vi
      .spyOn(asAny(app.instance), 'callInitHook')
      .mockResolvedValue(undefined);
    const callBootstrapHook = vi
      .spyOn(asAny(app.instance), 'callBootstrapHook')
      .mockResolvedValue(undefined);
    const loadSocketModule = vi
      .spyOn(asAny(app.instance), 'loadSocketModule')
      .mockResolvedValue(undefined);
    return {
      ...app,
      microservicesModule,
      setupClients,
      setupListeners,
      registerListeners,
      callInitHook,
      callBootstrapHook,
      loadSocketModule,
    };
  };

  it('only binds the listeners of the hybrid application (D1 true, D2 false)', async () => {
    const { instance, registerListeners, setupClients, loadSocketModule } =
      setup();
    instance.setIsConnectedToApplication(true);

    await instance.registerModules();

    expect(registerListeners).toHaveBeenCalledTimes(1);
    expect(setupClients).not.toHaveBeenCalled();
    expect(loadSocketModule).not.toHaveBeenCalled();
    expect(asAny(instance).isInitialized).toBe(true);
  });

  it('leaves the listeners to the hybrid application in preview (D1 true, D2 true)', async () => {
    const { instance, registerListeners, microservicesModule } = setup({
      preview: true,
    });
    instance.setIsConnectedToApplication(true);

    await instance.registerModules();

    expect(registerListeners).not.toHaveBeenCalled();
    expect(microservicesModule.setupClients).not.toHaveBeenCalled();
  });

  it('registers the gateways, clients, listeners and hooks (D1 false, D3 true, D4 false)', async () => {
    const app = setup();
    const socketModule = { register: vi.fn(async () => undefined) };
    asAny(app.instance).socketModule = socketModule;

    await app.instance.registerModules();

    expect(app.loadSocketModule).toHaveBeenCalledTimes(1);
    expect(socketModule.register).toHaveBeenCalledWith(
      app.container,
      app.applicationConfig,
      app.graphInspector,
      expect.any(Object),
    );
    expect(app.setupClients).toHaveBeenCalledTimes(1);
    expect(app.registerListeners).toHaveBeenCalledTimes(1);
    expect(app.callInitHook).toHaveBeenCalledTimes(1);
    expect(app.callBootstrapHook).toHaveBeenCalledTimes(1);
    expect(asAny(app.instance).isInitialized).toBe(true);
  });

  it('skips the gateways when no socket module was loaded (D3 false)', async () => {
    const app = setup();

    await app.instance.registerModules();

    expect(asAny(app.instance).socketModule).toBeNull();
    expect(app.setupClients).toHaveBeenCalledTimes(1);
    expect(app.registerListeners).toHaveBeenCalledTimes(1);
  });

  it('skips clients and listeners in preview mode (D2 true)', async () => {
    const app = setup({ preview: true });

    await app.instance.registerModules();

    expect(app.setupClients).not.toHaveBeenCalled();
    expect(app.registerListeners).not.toHaveBeenCalled();
    expect(app.callInitHook).toHaveBeenCalledTimes(1);
    expect(app.callBootstrapHook).toHaveBeenCalledTimes(1);
  });

  it('skips the hooks when they already ran (D4 true)', async () => {
    const app = setup();
    app.instance.setIsInitHookCalled(true);

    await app.instance.registerModules();

    expect(app.setupClients).toHaveBeenCalledTimes(1);
    expect(app.registerListeners).toHaveBeenCalledTimes(1);
    expect(app.callInitHook).not.toHaveBeenCalled();
    expect(app.callBootstrapHook).not.toHaveBeenCalled();
  });
});

/**
 * `registerListeners`: no decisions; forwards the container and the server to
 * the microservices module.
 */
describe('NestMicroservice.registerListeners', () => {
  it('delegates to setupListeners with the container and the server', () => {
    const { instance, container } = createApp({});
    const setupListeners = vi
      .spyOn(asAny(instance).microservicesModule, 'setupListeners')
      .mockImplementation(() => {});

    instance.registerListeners();

    expect(setupListeners).toHaveBeenCalledWith(
      container,
      asAny(instance).serverInstance,
    );
  });
});

/**
 * `useWebSocketAdapter` decisions:
 *   D1 `isInitialized` true? -> warn (registration is too late), false -> silent.
 * The adapter is always forwarded to the application config.
 */
describe('NestMicroservice.useWebSocketAdapter', () => {
  it('registers the adapter silently before initialization (D1 false)', () => {
    const { instance, applicationConfig } = createApp({});
    const adapter = { create: vi.fn() };
    const setIoAdapter = vi.spyOn(applicationConfig, 'setIoAdapter');
    const warn = vi
      .spyOn(asAny(instance).logger, 'warn')
      .mockImplementation(() => {});

    expect(instance.useWebSocketAdapter(adapter as any)).toBe(instance);
    expect(setIoAdapter).toHaveBeenCalledWith(adapter);
    expect(warn).not.toHaveBeenCalled();
  });

  it('warns when registering after initialization (D1 true)', () => {
    const { instance, applicationConfig } = createApp({});
    const adapter = { create: vi.fn() };
    const setIoAdapter = vi.spyOn(applicationConfig, 'setIoAdapter');
    const warn = vi
      .spyOn(asAny(instance).logger, 'warn')
      .mockImplementation(() => {});
    instance.setIsInitialized(true);

    instance.useWebSocketAdapter(adapter as any);

    expect(setIoAdapter).toHaveBeenCalledWith(adapter);
    expect(warn).toHaveBeenCalledTimes(1);
  });
});

/**
 * Shared body for the global enhancer registrations. Decisions per method:
 *   D1 `isInitialized` true? -> warn.
 *   D2 `appOptions.instrument?.instanceDecorator` present? true -> decorate
 *      every instance (and use the decorated value), false -> identity.
 *   D3 each enhancer gets an orphaned-enhancer graph entry (forEach count).
 */
const exerciseEnhancer = (
  method: string,
  configMethod: string,
  subtype: string,
  items: any[],
  { initialized = false, instrument }: any = {},
) => {
  const { instance, applicationConfig, graphInspector } = createApp(
    instrument ? { instrument } : {},
  );
  const warn = vi
    .spyOn(asAny(instance).logger, 'warn')
    .mockImplementation(() => {});
  const delegate = vi.spyOn(asAny(applicationConfig), configMethod);
  const insert = vi
    .spyOn(graphInspector, 'insertOrphanedEnhancer')
    .mockImplementation(() => {});
  instance.setIsInitialized(initialized);

  const result = asAny(instance)[method](...items);

  return { instance, delegate, insert, warn, result };
};

/**
 * `useGlobalFilters`: D1 initialized warn, D2 instance decorator, D3 orphaned
 * 'filter' entries.
 */
describe('NestMicroservice.useGlobalFilters', () => {
  it('forwards the filters and records them as orphaned enhancers', () => {
    const filter = { catch: vi.fn() };
    const { instance, delegate, insert, warn, result } = exerciseEnhancer(
      'useGlobalFilters',
      'useGlobalFilters',
      'filter',
      [filter],
    );

    expect(delegate).toHaveBeenCalledWith(filter);
    expect(insert).toHaveBeenCalledWith({ subtype: 'filter', ref: filter });
    expect(warn).not.toHaveBeenCalled();
    expect(result).toBe(instance);
  });

  it('warns and applies the instance decorator after initialization', () => {
    const filter = { catch: vi.fn() };
    const decorator = vi.fn((target: any) => ({ ...target, decorated: true }));
    const { delegate, warn } = exerciseEnhancer(
      'useGlobalFilters',
      'useGlobalFilters',
      'filter',
      [filter],
      { initialized: true, instrument: { instanceDecorator: decorator } },
    );

    expect(warn).toHaveBeenCalledTimes(1);
    expect(decorator).toHaveBeenCalledWith(filter);
    expect(delegate).toHaveBeenCalledWith({ ...filter, decorated: true });
  });
});

/**
 * `useGlobalPipes`: D1 initialized warn, D2 instance decorator, D3 orphaned
 * 'pipe' entries.
 */
describe('NestMicroservice.useGlobalPipes', () => {
  it('forwards the pipes and records them as orphaned enhancers', () => {
    const pipe = { transform: vi.fn() };
    const { instance, delegate, insert, result } = exerciseEnhancer(
      'useGlobalPipes',
      'useGlobalPipes',
      'pipe',
      [pipe],
    );

    expect(delegate).toHaveBeenCalledWith(pipe);
    expect(insert).toHaveBeenCalledWith({ subtype: 'pipe', ref: pipe });
    expect(result).toBe(instance);
  });

  it('warns and applies the instance decorator after initialization', () => {
    const pipe = { transform: vi.fn() };
    const decorator = vi.fn((target: any) => ({ ...target, decorated: true }));
    const { delegate, warn } = exerciseEnhancer(
      'useGlobalPipes',
      'useGlobalPipes',
      'pipe',
      [pipe],
      { initialized: true, instrument: { instanceDecorator: decorator } },
    );

    expect(warn).toHaveBeenCalledTimes(1);
    expect(decorator).toHaveBeenCalledWith(pipe);
    expect(delegate).toHaveBeenCalledWith({ ...pipe, decorated: true });
  });
});

/**
 * `useGlobalInterceptors`: D1 initialized warn, D2 instance decorator, D3
 * orphaned 'interceptor' entries.
 */
describe('NestMicroservice.useGlobalInterceptors', () => {
  it('forwards the interceptors and records them as orphaned enhancers', () => {
    const interceptor = { intercept: vi.fn() };
    const { instance, delegate, insert, result } = exerciseEnhancer(
      'useGlobalInterceptors',
      'useGlobalInterceptors',
      'interceptor',
      [interceptor],
    );

    expect(delegate).toHaveBeenCalledWith(interceptor);
    expect(insert).toHaveBeenCalledWith({
      subtype: 'interceptor',
      ref: interceptor,
    });
    expect(result).toBe(instance);
  });

  it('warns and applies the instance decorator after initialization', () => {
    const interceptor = { intercept: vi.fn() };
    const decorator = vi.fn((target: any) => ({ ...target, decorated: true }));
    const { delegate, warn } = exerciseEnhancer(
      'useGlobalInterceptors',
      'useGlobalInterceptors',
      'interceptor',
      [interceptor],
      { initialized: true, instrument: { instanceDecorator: decorator } },
    );

    expect(warn).toHaveBeenCalledTimes(1);
    expect(decorator).toHaveBeenCalledWith(interceptor);
    expect(delegate).toHaveBeenCalledWith({
      ...interceptor,
      decorated: true,
    });
  });
});

/**
 * `useGlobalGuards`: D1 initialized warn, D2 instance decorator, D3 orphaned
 * 'guard' entries.
 */
describe('NestMicroservice.useGlobalGuards', () => {
  it('forwards the guards and records them as orphaned enhancers', () => {
    const guard = { canActivate: vi.fn() };
    const { instance, delegate, insert, result } = exerciseEnhancer(
      'useGlobalGuards',
      'useGlobalGuards',
      'guard',
      [guard],
    );

    expect(delegate).toHaveBeenCalledWith(guard);
    expect(insert).toHaveBeenCalledWith({ subtype: 'guard', ref: guard });
    expect(result).toBe(instance);
  });

  it('warns and applies the instance decorator after initialization', () => {
    const guard = { canActivate: vi.fn() };
    const decorator = vi.fn((target: any) => ({ ...target, decorated: true }));
    const { delegate, warn } = exerciseEnhancer(
      'useGlobalGuards',
      'useGlobalGuards',
      'guard',
      [guard],
      { initialized: true, instrument: { instanceDecorator: decorator } },
    );

    expect(warn).toHaveBeenCalledTimes(1);
    expect(decorator).toHaveBeenCalledWith(guard);
    expect(delegate).toHaveBeenCalledWith({ ...guard, decorated: true });
  });
});

/**
 * `registerPreRequestHook` decisions:
 *   D1 `isInitialized` true? -> warn; the hooks are forwarded either way.
 */
describe('NestMicroservice.registerPreRequestHook', () => {
  it('forwards the hooks silently before initialization (D1 false)', () => {
    const { instance, applicationConfig } = createApp({});
    const register = vi.spyOn(applicationConfig, 'registerPreRequestHook');
    const warn = vi
      .spyOn(asAny(instance).logger, 'warn')
      .mockImplementation(() => {});
    const hook = vi.fn();

    expect(instance.registerPreRequestHook(hook as any)).toBe(instance);
    expect(register).toHaveBeenCalledWith(hook);
    expect(warn).not.toHaveBeenCalled();
  });

  it('warns after initialization (D1 true)', () => {
    const { instance, applicationConfig } = createApp({});
    const register = vi.spyOn(applicationConfig, 'registerPreRequestHook');
    const warn = vi
      .spyOn(asAny(instance).logger, 'warn')
      .mockImplementation(() => {});
    instance.setIsInitialized(true);
    const hook = vi.fn();

    instance.registerPreRequestHook(hook as any);

    expect(register).toHaveBeenCalledWith(hook);
    expect(warn).toHaveBeenCalledTimes(1);
  });
});

/**
 * `init` decisions:
 *   D1 `isInitialized` true? -> return without registering again.
 *   D2 does registration throw? -> the finally block flushes logs either way.
 */
describe('NestMicroservice.init', () => {
  it('returns early when already initialized (D1 true)', async () => {
    const { instance } = createApp({});
    const registerModules = vi
      .spyOn(instance, 'registerModules')
      .mockResolvedValue(undefined);
    const flush = vi
      .spyOn(asAny(instance), 'flushLogsIfAutoFlushEnabled')
      .mockImplementation(() => {});
    instance.setIsInitialized(true);

    await expect(instance.init()).resolves.toBe(instance);
    expect(registerModules).not.toHaveBeenCalled();
    expect(flush).not.toHaveBeenCalled();
  });

  it('loads modules and flushes logs on success (D1 false, D2 false)', async () => {
    const { instance } = createApp({});
    const loadSocketModule = vi
      .spyOn(asAny(instance), 'loadSocketModule')
      .mockResolvedValue(undefined);
    const registerModules = vi
      .spyOn(instance, 'registerModules')
      .mockResolvedValue(undefined);
    const flush = vi
      .spyOn(asAny(instance), 'flushLogsIfAutoFlushEnabled')
      .mockImplementation(() => {});

    await expect(instance.init()).resolves.toBe(instance);
    expect(loadSocketModule).toHaveBeenCalledTimes(1);
    expect(registerModules).toHaveBeenCalledTimes(1);
    expect(flush).toHaveBeenCalledTimes(1);
  });

  it('flushes logs and rethrows when registration fails (D2 true)', async () => {
    const { instance } = createApp({});
    vi.spyOn(asAny(instance), 'loadSocketModule').mockResolvedValue(undefined);
    const error = new Error('init failed');
    vi.spyOn(instance, 'registerModules').mockRejectedValue(error);
    const flush = vi
      .spyOn(asAny(instance), 'flushLogsIfAutoFlushEnabled')
      .mockImplementation(() => {});

    await expect(instance.init()).rejects.toBe(error);
    expect(flush).toHaveBeenCalledTimes(1);
  });
});

/**
 * `listen` decisions:
 *   D1 preview mode? -> assertNotInPreviewMode throws before anything starts.
 *   D2 `isInitialized` false? -> registerModules first (its failure flushes and
 *      rethrows).
 *   D3 server callback error? -> reject, otherwise resolve with info and log.
 */
describe('NestMicroservice.listen', () => {
  it('refuses to listen in preview mode (D1 true)', async () => {
    const strategy = createStrategy();
    const { instance } = createApp({ strategy, preview: true });
    const registerModules = vi
      .spyOn(instance, 'registerModules')
      .mockResolvedValue(undefined);

    await expect(instance.listen()).rejects.toThrow(
      'Calling the "listen" in the preview mode is not supported.',
    );
    expect(registerModules).not.toHaveBeenCalled();
    expect(strategy.listen).not.toHaveBeenCalled();
  });

  it('registers the modules then resolves with the server info (D2 true, D3 false)', async () => {
    const strategy = createStrategy({
      listen: vi.fn((callback: any) => callback(null, { port: 3000 })),
    });
    const { instance } = createApp({ strategy });
    const registerModules = vi
      .spyOn(instance, 'registerModules')
      .mockResolvedValue(undefined);
    const flush = vi
      .spyOn(asAny(instance), 'flushLogsIfAutoFlushEnabled')
      .mockImplementation(() => {});
    const log = vi
      .spyOn(asAny(instance).logger, 'log')
      .mockImplementation(() => {});

    await expect(instance.listen()).resolves.toEqual({ port: 3000 });
    expect(registerModules).toHaveBeenCalledTimes(1);
    expect(strategy.listen).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith(MESSAGES.MICROSERVICE_READY);
    expect(flush).toHaveBeenCalledTimes(1);
  });

  it('rejects with the server error (D3 true)', async () => {
    const error = new Error('listen failed');
    const strategy = createStrategy({
      listen: vi.fn((callback: any) => callback(error)),
    });
    const { instance } = createApp({ strategy });
    vi.spyOn(instance, 'registerModules').mockResolvedValue(undefined);
    vi.spyOn(asAny(instance), 'flushLogsIfAutoFlushEnabled').mockImplementation(
      () => {},
    );
    const log = vi
      .spyOn(asAny(instance).logger, 'log')
      .mockImplementation(() => {});

    await expect(instance.listen()).rejects.toBe(error);
    expect(log).not.toHaveBeenCalled();
  });

  it('skips registration when already initialized (D2 false)', async () => {
    const strategy = createStrategy({
      listen: vi.fn((callback: any) => callback(null, 'info')),
    });
    const { instance } = createApp({ strategy });
    const registerModules = vi
      .spyOn(instance, 'registerModules')
      .mockResolvedValue(undefined);
    instance.setIsInitialized(true);
    vi.spyOn(asAny(instance), 'flushLogsIfAutoFlushEnabled').mockImplementation(
      () => {},
    );
    vi.spyOn(asAny(instance).logger, 'log').mockImplementation(() => {});

    await expect(instance.listen()).resolves.toBe('info');
    expect(registerModules).not.toHaveBeenCalled();
  });

  it('flushes and rethrows when registration fails', async () => {
    const strategy = createStrategy();
    const { instance } = createApp({ strategy });
    const error = new Error('register failed');
    vi.spyOn(instance, 'registerModules').mockRejectedValue(error);
    const flush = vi
      .spyOn(asAny(instance), 'flushLogsIfAutoFlushEnabled')
      .mockImplementation(() => {});

    await expect(instance.listen()).rejects.toBe(error);
    expect(flush).toHaveBeenCalledTimes(1);
    expect(strategy.listen).not.toHaveBeenCalled();
  });
});

/**
 * `close` decisions:
 *   D1 `isTerminated` true? -> only detach process signal listeners.
 *      false -> mark terminated and run closeApplication.
 */
describe('NestMicroservice.close', () => {
  it('closes the server and the application (D1 false)', async () => {
    const strategy = createStrategy();
    const { instance } = createApp({ strategy });
    const closeApplication = vi
      .spyOn(asAny(instance), 'closeApplication')
      .mockResolvedValue(undefined);
    const unsubscribe = vi
      .spyOn(asAny(instance), 'unsubscribeFromProcessSignals')
      .mockImplementation(() => {});

    await instance.close();

    expect(strategy.close).toHaveBeenCalledTimes(1);
    expect(closeApplication).toHaveBeenCalledTimes(1);
    expect(unsubscribe).not.toHaveBeenCalled();
    expect(asAny(instance).isTerminated).toBe(true);
  });

  it('only detaches signal listeners when already terminated (D1 true)', async () => {
    const strategy = createStrategy();
    const { instance } = createApp({ strategy });
    const closeApplication = vi
      .spyOn(asAny(instance), 'closeApplication')
      .mockResolvedValue(undefined);
    const unsubscribe = vi
      .spyOn(asAny(instance), 'unsubscribeFromProcessSignals')
      .mockImplementation(() => {});
    instance.setIsTerminated(true);

    await instance.close();

    expect(strategy.close).toHaveBeenCalledTimes(1);
    expect(closeApplication).not.toHaveBeenCalled();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});

describe('NestMicroservice.setIsInitialized', () => {
  it('stores the initialized flag', () => {
    const { instance } = createApp({});

    instance.setIsInitialized(true);

    expect(asAny(instance).isInitialized).toBe(true);
  });
});

describe('NestMicroservice.setIsTerminated', () => {
  it('stores the terminated flag', () => {
    const { instance } = createApp({});

    instance.setIsTerminated(true);

    expect(asAny(instance).isTerminated).toBe(true);
  });
});

describe('NestMicroservice.setIsInitHookCalled', () => {
  it('stores the init-hook flag', () => {
    const { instance } = createApp({});

    instance.setIsInitHookCalled(true);

    expect(asAny(instance).wasInitHookCalled).toBe(true);
  });
});

describe('NestMicroservice.setIsConnectedToApplication', () => {
  it('stores the hybrid-application flag', () => {
    const { instance } = createApp({});

    instance.setIsConnectedToApplication(true);

    expect(asAny(instance).isConnectedToApplication).toBe(true);
  });
});

/**
 * `on` decisions:
 *   D1 `'on' in serverInstance`? true -> delegate, false -> throw.
 */
describe('NestMicroservice.on', () => {
  it('delegates to the server when supported (D1 true)', () => {
    const on = vi.fn(() => 'handled');
    const strategy = createStrategy({ on });
    const { instance } = createApp({ strategy });
    const callback = vi.fn();

    expect(instance.on('event', callback)).toBe('handled');
    expect(on).toHaveBeenCalledWith('event', callback);
  });

  it('throws when the server has no on method (D1 false)', () => {
    const { instance } = createApp({
      strategy: { listen: vi.fn(), close: vi.fn(async () => undefined) },
    });

    expect(() => instance.on('event', vi.fn())).toThrow(
      '"on" method not supported by the underlying server',
    );
  });
});

/**
 * `unwrap` decisions:
 *   D1 `'unwrap' in serverInstance`? true -> delegate, false -> throw.
 */
describe('NestMicroservice.unwrap', () => {
  it('delegates to the server when supported (D1 true)', () => {
    const unwrap = vi.fn(() => 'core');
    const strategy = createStrategy({ unwrap });
    const { instance } = createApp({ strategy });

    expect(instance.unwrap()).toBe('core');
    expect(unwrap).toHaveBeenCalledTimes(1);
  });

  it('throws when the server has no unwrap method (D1 false)', () => {
    const { instance } = createApp({
      strategy: {
        listen: vi.fn(),
        close: vi.fn(async () => undefined),
        on: vi.fn(),
      },
    });

    expect(() => instance.unwrap()).toThrow(
      '"unwrap" method not supported by the underlying server',
    );
  });
});

/**
 * `getTransportServer`: no decisions; returns the underlying server.
 */
describe('NestMicroservice.getTransportServer', () => {
  it('returns the server instance', () => {
    const strategy = createStrategy();
    const { instance } = createApp({ strategy });

    expect(instance.getTransportServer()).toBe(strategy);
  });
});

/**
 * `closeApplication` decisions:
 *   D1 `this.socketModule` truthy? true -> its close() is awaited.
 *   D2 `this.microservicesModule` truthy? always true in practice (created
 *      eagerly), so only the true branch is feasible.
 * The base close() is always awaited.
 */
describe('NestMicroservice.closeApplication', () => {
  it('closes the socket module and the microservices module (D1 true)', async () => {
    const { instance } = createApp({});
    const socketModule = { close: vi.fn(async () => undefined) };
    asAny(instance).socketModule = socketModule;
    const microservicesClose = vi
      .spyOn(asAny(instance).microservicesModule, 'close')
      .mockResolvedValue(undefined);
    instance.setIsTerminated(true);

    await asAny(instance).closeApplication();

    expect(socketModule.close).toHaveBeenCalledTimes(1);
    expect(microservicesClose).toHaveBeenCalledTimes(1);
  });

  it('closes the microservices module without a socket module (D1 false)', async () => {
    const { instance } = createApp({});
    const microservicesClose = vi
      .spyOn(asAny(instance).microservicesModule, 'close')
      .mockResolvedValue(undefined);
    instance.setIsTerminated(true);

    await asAny(instance).closeApplication();

    expect(microservicesClose).toHaveBeenCalledTimes(1);
  });
});

/**
 * `dispose` decisions:
 *   D1 `isTerminated` true? -> return immediately.
 *   D2 `this.socketModule` truthy? true -> close it.
 *   D3 `this.microservicesModule` truthy? always true in practice.
 */
describe('NestMicroservice.dispose', () => {
  it('does nothing when already terminated (D1 true)', async () => {
    const strategy = createStrategy();
    const { instance } = createApp({ strategy });
    const microservicesClose = vi
      .spyOn(asAny(instance).microservicesModule, 'close')
      .mockResolvedValue(undefined);
    instance.setIsTerminated(true);

    await asAny(instance).dispose();

    expect(strategy.close).not.toHaveBeenCalled();
    expect(microservicesClose).not.toHaveBeenCalled();
  });

  it('closes the server and the microservices module without a socket module (D1 false, D2 false)', async () => {
    const strategy = createStrategy();
    const { instance } = createApp({ strategy });
    const microservicesClose = vi
      .spyOn(asAny(instance).microservicesModule, 'close')
      .mockResolvedValue(undefined);

    await asAny(instance).dispose();

    expect(strategy.close).toHaveBeenCalledTimes(1);
    expect(microservicesClose).toHaveBeenCalledTimes(1);
  });

  it('also closes the socket module when present (D2 true)', async () => {
    const strategy = createStrategy();
    const { instance } = createApp({ strategy });
    const socketModule = { close: vi.fn(async () => undefined) };
    asAny(instance).socketModule = socketModule;
    vi.spyOn(asAny(instance).microservicesModule, 'close').mockResolvedValue(
      undefined,
    );

    await asAny(instance).dispose();

    expect(strategy.close).toHaveBeenCalledTimes(1);
    expect(socketModule.close).toHaveBeenCalledTimes(1);
  });
});

/**
 * `resolveAsyncOptions` decisions:
 *   D1 `config.inject` present? true -> each token is resolved through get()
 *      and the factory receives the values; false -> `inject?.map` yields
 *      undefined, which cannot be spread, so the call itself throws a
 *      TypeError (a config without inject can never reach the factory).
 */
describe('NestMicroservice.resolveAsyncOptions', () => {
  it('throws when inject is missing because the arguments cannot be spread (D1 false)', () => {
    const { instance } = createApp({});
    const useFactory = vi.fn(() => 'options');

    expect(() => asAny(instance).resolveAsyncOptions({ useFactory })).toThrow(
      TypeError,
    );
    expect(useFactory).not.toHaveBeenCalled();
  });

  it('resolves every injected token before calling the factory (D1 true)', () => {
    const { instance } = createApp({});
    const useFactory = vi.fn((_dep: string) => 'resolved');
    const get = vi.spyOn(asAny(instance), 'get').mockReturnValue('dep');

    const result = asAny(instance).resolveAsyncOptions({
      useFactory,
      inject: ['TOKEN'],
    });

    expect(get).toHaveBeenCalledWith('TOKEN', { strict: false });
    expect(useFactory).toHaveBeenCalledWith('dep');
    expect(result).toBe('resolved');
  });
});

/**
 * `applyInstanceDecoratorIfRegistered` decisions:
 *   D1 `appOptions.instrument?.instanceDecorator` present? true -> decorate
 *      each instance through makeSafeInstanceDecorator, false -> identity.
 */
describe('NestMicroservice.applyInstanceDecoratorIfRegistered', () => {
  it('returns the instances untouched without a decorator (D1 false)', () => {
    const { instance } = createApp({});
    const first = { id: 1 };
    const second = { id: 2 };

    const result = asAny(instance).applyInstanceDecoratorIfRegistered(
      first,
      second,
    );

    expect(result).toEqual([first, second]);
    expect(result[0]).toBe(first);
  });

  it('decorates every instance when a decorator is configured (D1 true)', () => {
    const decorator = vi.fn((target: any) => ({ ...target, decorated: true }));
    const { instance } = createApp({
      instrument: { instanceDecorator: decorator },
    });
    const first = { id: 1 };
    const second = { id: 2 };

    const result = asAny(instance).applyInstanceDecoratorIfRegistered(
      first,
      second,
    );

    expect(decorator).toHaveBeenCalledTimes(2);
    expect(result).toEqual([
      { id: 1, decorated: true },
      { id: 2, decorated: true },
    ]);
  });
});

/**
 * `loadSocketModule` decisions:
 *   D1 `this.socketModule` already set? true -> skip the optional require.
 *   D2 the required module exposes `SocketModule`? true -> instantiate,
 *      false -> leave it null.
 */
describe('NestMicroservice.loadSocketModule', () => {
  class FakeSocketModule {
    readonly loaded = true;
  }

  it('does not load the package twice (D1 true)', async () => {
    const { instance } = createApp({});
    const existing = { existing: true };
    asAny(instance).socketModule = existing;
    socketModuleStub.current = class Exploding {
      constructor() {
        throw new Error('the loader must not run');
      }
    };

    await asAny(instance).loadSocketModule();

    expect(asAny(instance).socketModule).toBe(existing);
  });

  it('instantiates the socket module when exposed (D1 false, D2 true)', async () => {
    const { instance } = createApp({});
    socketModuleStub.current = FakeSocketModule;

    await asAny(instance).loadSocketModule();

    expect(asAny(instance).socketModule).toBeInstanceOf(FakeSocketModule);
  });

  it('leaves the module null when the package exposes none (D2 false)', async () => {
    const { instance } = createApp({});
    socketModuleStub.current = undefined;

    await asAny(instance).loadSocketModule();

    expect(asAny(instance).socketModule).toBeNull();
  });
});
