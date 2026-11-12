import { ExecutionContextHost, REQUEST_CONTEXT_ID } from '../../../packages/core/internal.js';
import { lastValueFrom, of, Subject, toArray } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  GATEWAY_OPTIONS,
  MESSAGE_METADATA,
  PORT_METADATA,
} from '../../../packages/websockets/constants.js';
import { SubscribeMessage } from '../../../packages/websockets/decorators/subscribe-message.decorator.js';
import { WebSocketServer } from '../../../packages/websockets/decorators/gateway-server.decorator.js';
import { InvalidSocketPortException } from '../../../packages/websockets/errors/invalid-socket-port.exception.js';
import { WsExceptionsHandler } from '../../../packages/websockets/exceptions/ws-exceptions-handler.js';
import { WebSocketsController } from '../../../packages/websockets/web-sockets-controller.js';

class Gateway {
  @WebSocketServer()
  server: any;

  @SubscribeMessage('message')
  onMessage() {}

  plain() {}

  afterInit() {}

  handleConnection() {}

  handleDisconnect() {}
}

const makeHost = () => ({
  init: new Subject(),
  connection: new Subject(),
  disconnect: new Subject(),
  server: { id: 'server' },
});

const setup = (appOptions: any = {}) => {
  const host = makeHost();
  const adapter = {
    bindClientConnect: vi.fn(),
    bindClientDisconnect: vi.fn(),
    bindMessageHandlers: vi.fn(),
  };
  const config = {
    getIoAdapter: () => adapter,
    getGlobalRequestGuards: vi.fn(() => []),
    getGlobalRequestPipes: vi.fn(() => []),
    getGlobalRequestInterceptors: vi.fn(() => []),
  };
  const moduleRef = { providers: new Map() };
  const container = {
    getModuleByKey: vi.fn(() => moduleRef),
    registerRequestProvider: vi.fn(),
  };
  const injector = {
    loadPerContext: vi.fn(async () => new Gateway()),
    loadEnhancersPerContext: vi.fn(async () => undefined),
    waitForDeferredLoads: vi.fn(async () => undefined),
  };
  const exceptionHandler = { handle: vi.fn() };
  const exceptionFiltersContext = {
    create: vi.fn(() => exceptionHandler),
  };
  const graphInspector = { insertEntrypointDefinition: vi.fn() };
  const contextCreator = {
    create: vi.fn(() => async () => 'handled'),
  };
  const socketServerProvider = {
    scanForSocketServer: vi.fn(() => host),
  };
  const controller = new WebSocketsController(
    socketServerProvider as any,
    config as any,
    contextCreator as any,
    container as any,
    injector as any,
    exceptionFiltersContext as any,
    graphInspector as any,
    appOptions,
  );
  return {
    controller,
    host,
    adapter,
    config,
    moduleRef,
    container,
    injector,
    exceptionHandler,
    exceptionFiltersContext,
    graphInspector,
    contextCreator,
    socketServerProvider,
  };
};

const wrapperFor = (instance: any, overrides: any = {}) => ({
  instance,
  metatype: instance.constructor,
  id: 'wrapper-id',
  isDependencyTreeStatic: () => true,
  isDependencyTreeDurable: () => false,
  getEnhancersMetadata: () => [],
  ...overrides,
});

describe('WebSocketsController', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('connectGatewayToServer', () => {
    it('should throw for a non-integer port', () => {
      const { controller } = setup();
      class BadGateway {}
      Reflect.defineMetadata(PORT_METADATA, 'abc', BadGateway);

      expect(() =>
        controller.connectGatewayToServer(
          { instance: new BadGateway(), metatype: BadGateway } as any,
          'module',
        ),
      ).toThrow(InvalidSocketPortException);
    });

    it('should use the metadata of a wrapper and subscribe to the server', () => {
      const { controller } = setup();
      const subscribe = vi
        .spyOn(controller, 'subscribeToServerEvents')
        .mockImplementation(() => undefined);
      const instance = new Gateway();
      const wrapper = wrapperFor(instance);

      controller.connectGatewayToServer(wrapper as any, 'module');

      expect(subscribe).toHaveBeenCalledWith(
        wrapper,
        {},
        0,
        'module',
        'wrapper-id',
      );
    });

    it('should read the port and options metadata of a gateway', () => {
      const { controller } = setup();
      const subscribe = vi
        .spyOn(controller, 'subscribeToServerEvents')
        .mockImplementation(() => undefined);
      class Configured {}
      Reflect.defineMetadata(PORT_METADATA, 3000, Configured);
      Reflect.defineMetadata(GATEWAY_OPTIONS, { namespace: '/chat' }, Configured);

      controller.connectGatewayToServer(
        new (Configured as any)(),
        Configured,
        'module',
        'id',
      );

      expect(subscribe).toHaveBeenCalledWith(
        expect.objectContaining({
          instance: expect.any(Configured),
          metatype: Configured,
          id: 'id',
        }),
        { namespace: '/chat' },
        3000,
        'module',
        'id',
      );
      const wrapper = subscribe.mock.calls[0][0] as any;
      expect(wrapper.isDependencyTreeStatic()).toBe(true);
      expect(wrapper.isDependencyTreeDurable()).toBe(false);
      expect(wrapper.getEnhancersMetadata()).toEqual([]);
    });

    it('should fall back to the constructor when no metatype is given', () => {
      const { controller } = setup();
      const subscribe = vi
        .spyOn(controller, 'subscribeToServerEvents')
        .mockImplementation(() => undefined);
      const instance = new Gateway();

      controller.connectGatewayToServer(
        instance,
        undefined as any,
        'module',
        'id',
      );

      expect(subscribe.mock.calls[0][1]).toEqual({});
    });
  });

  describe('subscribeToServerEvents', () => {
    it('should accept a gateway instance directly', () => {
      const { controller } = setup();
      const subscribe = vi
        .spyOn(controller, 'subscribeEvents')
        .mockImplementation(() => undefined);
      const instance = new Gateway();

      controller.subscribeToServerEvents(
        instance,
        {},
        0,
        'module',
        'instance-id',
      );

      const wrapper = subscribe.mock.calls[0][0] as any;
      expect(wrapper.instance).toBe(instance);
      expect(wrapper.metatype).toBe(Gateway);
      expect(wrapper.isDependencyTreeStatic()).toBe(true);
      expect(wrapper.isDependencyTreeDurable()).toBe(false);
      expect(wrapper.getEnhancersMetadata()).toEqual([]);
    });
    it('should create static handlers and subscribe to the created server', () => {
      const {
        controller,
        host,
        contextCreator,
        socketServerProvider,
        graphInspector,
      } = setup();
      const subscribe = vi
        .spyOn(controller, 'subscribeEvents')
        .mockImplementation(() => undefined);
      const assign = vi
        .spyOn(controller as any, 'assignServerToProperties')
        .mockImplementation(() => undefined);
      const instance = new Gateway();
      const wrapper = wrapperFor(instance);

      controller.subscribeToServerEvents(
        wrapper as any,
        { namespace: '/chat' },
        3000,
        'module',
        'wrapper-id',
      );

      expect(contextCreator.create).toHaveBeenCalledWith(
        instance,
        instance.onMessage,
        'module',
        'onMessage',
        expect.anything(),
        'wrapper-id',
      );
      expect(graphInspector.insertEntrypointDefinition).toHaveBeenCalledOnce();
      expect(socketServerProvider.scanForSocketServer).toHaveBeenCalledWith(
        { namespace: '/chat' },
        3000,
      );
      expect(assign).toHaveBeenCalledWith(instance, host.server);
      expect(subscribe).toHaveBeenCalledWith(
        wrapper,
        expect.any(Array),
        host,
        expect.any(Function),
        expect.any(Function),
      );
    });

    it('should stop before creating the server in preview mode', () => {
      const { controller, socketServerProvider } = setup({ preview: true });
      const subscribe = vi
        .spyOn(controller, 'subscribeEvents')
        .mockImplementation(() => undefined);
      const wrapper = wrapperFor(new Gateway());

      controller.subscribeToServerEvents(
        wrapper as any,
        {},
        0,
        'module',
        'wrapper-id',
      );

      expect(socketServerProvider.scanForSocketServer).not.toHaveBeenCalled();
      expect(subscribe).not.toHaveBeenCalled();
    });

    it('should create request scoped handlers for a non-static gateway', () => {
      const { controller } = setup();
      const scoped = vi
        .spyOn(controller, 'createRequestScopedHandler')
        .mockReturnValue(async () => undefined);
      const scopedEvent = vi
        .spyOn(controller, 'createRequestScopedEventHandler')
        .mockReturnValue(async () => undefined);
      const subscribe = vi
        .spyOn(controller, 'subscribeEvents')
        .mockImplementation(() => undefined);
      const wrapper = wrapperFor(new Gateway(), {
        isDependencyTreeStatic: () => false,
      });

      controller.subscribeToServerEvents(
        wrapper as any,
        {},
        0,
        'module',
        'wrapper-id',
      );

      expect(scoped).toHaveBeenCalledTimes(1);
      expect(scopedEvent).toHaveBeenCalledTimes(2);
      expect(subscribe).toHaveBeenCalledOnce();
    });

    it('should use request scoped handlers when global enhancers exist', () => {
      const { controller, config } = setup();
      config.getGlobalRequestGuards.mockReturnValue([
        {
          isDependencyTreeStatic: () => true,
          isDependencyTreeDurable: () => false,
        },
      ]);
      const scoped = vi
        .spyOn(controller, 'createRequestScopedHandler')
        .mockReturnValue(async () => undefined);
      const subscribe = vi
        .spyOn(controller, 'subscribeEvents')
        .mockImplementation(() => undefined);

      controller.subscribeToServerEvents(
        wrapperFor(new Gateway()) as any,
        {},
        0,
        'module',
        'wrapper-id',
      );

      expect(scoped).toHaveBeenCalledTimes(1);
      expect(subscribe).toHaveBeenCalledOnce();
    });
  });

  describe('subscribeEvents', () => {
    it('should subscribe every event, bind the connection and log', () => {
      const { controller, host, adapter } = setup();
      const init = vi.spyOn(controller, 'subscribeInitEvent');
      const connection = vi.spyOn(controller, 'subscribeConnectionEvent');
      const disconnect = vi.spyOn(controller, 'subscribeDisconnectEvent');
      const getHandler = vi
        .spyOn(controller, 'getConnectionHandler')
        .mockReturnValue('handler');
      const print = vi
        .spyOn(controller as any, 'printSubscriptionLogs')
        .mockImplementation(() => undefined);
      const instance = new Gateway();
      const handlers = [
        { message: 'a', methodName: 'a', callback: () => undefined, isAckHandledManually: false },
      ];

      controller.subscribeEvents(
        wrapperFor(instance) as any,
        handlers,
        host as any,
        'connect',
        'disconnect',
      );

      expect(init).toHaveBeenCalledWith(instance, host.init);
      expect(connection).toHaveBeenCalledWith('connect', host.connection);
      expect(disconnect).toHaveBeenCalledWith('disconnect', host.disconnect);
      expect(getHandler).toHaveBeenCalledWith(
        controller,
        instance,
        handlers,
        host.disconnect,
        host.connection,
      );
      expect(adapter.bindClientConnect).toHaveBeenCalledWith(
        host.server,
        'handler',
      );
      expect(print).toHaveBeenCalledWith(instance, handlers);
    });
  });

  describe('getConnectionHandler', () => {
    it('should hold and then flush a disconnect while connecting', () => {
      const { controller, adapter } = setup();
      const instance = new Gateway();
      const host = makeHost();
      const disconnectListener = vi.fn();
      adapter.bindClientDisconnect.mockImplementation(
        (_client: any, callback: Function) => {
          disconnectListener.mockImplementation(callback);
        },
      );
      const subscribeMessages = vi
        .spyOn(controller, 'subscribeMessages')
        .mockImplementation(() => undefined);
      const handler = controller.getConnectionHandler(
        controller,
        instance,
        [],
        host.disconnect,
        host.connection,
      );
      const disconnectNext = vi.spyOn(host.disconnect, 'next');
      const client = { id: 1 };

      handler(client);
      disconnectListener('client namespace disconnect');

      expect(subscribeMessages).toHaveBeenCalledWith([], client, instance);
      expect(disconnectNext).toHaveBeenCalledWith({
        client,
        reason: 'client namespace disconnect',
      });
    });

    it('should emit an immediate disconnect after connecting', () => {
      const { controller, adapter } = setup();
      const host = makeHost();
      let disconnectListener: Function = () => undefined;
      adapter.bindClientDisconnect.mockImplementation(
        (_client: any, callback: Function) => {
          disconnectListener = callback;
        },
      );
      vi.spyOn(controller, 'subscribeMessages').mockImplementation(
        () => undefined,
      );
      const handler = controller.getConnectionHandler(
        controller,
        new Gateway(),
        [],
        host.disconnect,
        host.connection,
      );
      const next = vi.spyOn(host.disconnect, 'next');

      handler({ id: 1 });
      disconnectListener('reason');

      expect(next).toHaveBeenCalledWith({ client: { id: 1 }, reason: 'reason' });
    });

    it('should work without a client disconnect hook', () => {
      const { controller, adapter } = setup();
      adapter.bindClientDisconnect = undefined as any;
      const host = makeHost();
      vi.spyOn(controller, 'subscribeMessages').mockImplementation(
        () => undefined,
      );
      const handler = controller.getConnectionHandler(
        controller,
        new Gateway(),
        [],
        host.disconnect,
        host.connection,
      );
      const next = vi.spyOn(host.connection, 'next');

      handler({ id: 1 });

      expect(next).toHaveBeenCalledWith([{ id: 1 }]);
    });

    it('should still flush a held disconnect when subscribing fails', () => {
      const { controller, adapter } = setup();
      const host = makeHost();
      let disconnectListener: Function = () => undefined;
      adapter.bindClientDisconnect.mockImplementation(
        (_client: any, callback: Function) => {
          disconnectListener = callback;
        },
      );
      vi.spyOn(controller, 'subscribeMessages').mockImplementation(() => {
        disconnectListener('reason');
        throw new Error('subscribe failed');
      });
      const next = vi.spyOn(host.disconnect, 'next');
      const handler = controller.getConnectionHandler(
        controller,
        new Gateway(),
        [],
        host.disconnect,
        host.connection,
      );

      expect(() => handler({ id: 1 })).toThrow('subscribe failed');
      expect(next).toHaveBeenCalledWith({ client: { id: 1 }, reason: 'reason' });
    });
  });

  describe('subscribeInitEvent', () => {
    it('should subscribe afterInit on the gateway', () => {
      const { controller } = setup();
      const instance = new Gateway();
      const event = new Subject();
      const subscribe = vi.spyOn(event, 'subscribe');
      const afterInit = vi.spyOn(instance, 'afterInit');

      controller.subscribeInitEvent(instance, event);
      event.next('server');

      expect(subscribe).toHaveBeenCalled();
      expect(afterInit).toHaveBeenCalledWith('server');
    });

    it('should do nothing without afterInit', () => {
      const { controller } = setup();
      const event = new Subject();
      const subscribe = vi.spyOn(event, 'subscribe');

      controller.subscribeInitEvent({} as any, event);

      expect(subscribe).not.toHaveBeenCalled();
    });
  });

  describe('subscribeConnectionEvent', () => {
    it('should accept a handler function', () => {
      const { controller } = setup();
      const event = new Subject<any[]>();
      const handler = vi.fn();
      const clientA = { client: 1 };
      const clientB = { client: 2 };

      controller.subscribeConnectionEvent(handler, event);
      event.next([clientA, {}]);
      event.next([clientA, {}]);
      event.next([clientB, {}]);

      expect(handler).toHaveBeenCalledTimes(2);
    });

    it('should use the gateway handleConnection and deduplicate clients', () => {
      const { controller, host } = setup();
      const instance = new Gateway();
      const handler = vi.spyOn(instance, 'handleConnection');
      const clientA = { id: 1 };
      const clientB = { id: 2 };

      controller.subscribeConnectionEvent(instance, host.connection);
      host.connection.next([clientA, 'data']);
      host.connection.next([clientA, 'other']);
      host.connection.next([clientB, 'data']);

      expect(handler).toHaveBeenCalledTimes(2);
      expect(handler).toHaveBeenCalledWith(clientA, 'data');
    });

    it('should do nothing without a handler', () => {
      const { controller } = setup();
      const event = new Subject();
      const subscribe = vi.spyOn(event, 'subscribe');

      controller.subscribeConnectionEvent(undefined, event);

      expect(subscribe).not.toHaveBeenCalled();
    });
  });

  describe('subscribeDisconnectEvent', () => {
    it('should pass the client and reason from an event object', () => {
      const { controller } = setup();
      const instance = new Gateway();
      const handler = vi.spyOn(instance, 'handleDisconnect');
      const event = new Subject<any>();

      controller.subscribeDisconnectEvent(instance, event);
      event.next({ client: { id: 1 }, reason: 'bye' });

      expect(handler).toHaveBeenCalledWith({ id: 1 }, 'bye');
    });

    it('should keep backward compatibility with a raw client', () => {
      const { controller } = setup();
      const handler = vi.fn();
      const event = new Subject<any>();
      const client = { id: 1 };

      controller.subscribeDisconnectEvent(handler, event);
      event.next(client);
      event.next(null);

      expect(handler).toHaveBeenNthCalledWith(1, client);
      expect(handler).toHaveBeenNthCalledWith(2, null);
    });

    it('should deduplicate events of the same client', () => {
      const { controller } = setup();
      const handler = vi.fn();
      const event = new Subject<any>();
      const clientA = { id: 1 };
      const clientB = { id: 2 };

      controller.subscribeDisconnectEvent(handler, event);
      event.next({ client: clientA, reason: 'a' });
      event.next({ client: clientA, reason: 'b' });
      event.next({ client: clientB, reason: 'c' });

      expect(handler).toHaveBeenCalledTimes(2);
    });

    it('should do nothing without a handler', () => {
      const { controller } = setup();
      const event = new Subject();
      const subscribe = vi.spyOn(event, 'subscribe');

      controller.subscribeDisconnectEvent(undefined, event);

      expect(subscribe).not.toHaveBeenCalled();
    });
  });

  describe('subscribeMessages', () => {
    it('should bind each handler to the instance and the client', () => {
      const { controller, adapter } = setup();
      const instance = new Gateway();
      const client = { id: 1 };
      const callback = vi.fn(async (_client: unknown, _data: unknown) => 'ok');
      const handlers = [
        { message: 'a', methodName: 'a', callback, isAckHandledManually: true },
      ];

      controller.subscribeMessages(handlers as any, client, instance);

      const [boundClient, boundHandlers, transform] =
        adapter.bindMessageHandlers.mock.calls[0];
      expect(boundClient).toBe(client);
      expect(boundHandlers[0].message).toBe('a');
      expect(boundHandlers[0].isAckHandledManually).toBe(true);
      expect(boundHandlers[0].callback).not.toBe(callback);
      transform(Promise.resolve(of('value')));
    });
  });

  describe('pickResult', () => {
    it('should return an observable unchanged', async () => {
      const { controller } = setup();
      const observable = of(1);

      await expect(controller.pickResult(Promise.resolve(observable))).resolves.toBe(
        observable,
      );
    });

    it('should wrap a promise result', async () => {
      const { controller } = setup();

      const result = await controller.pickResult(Promise.resolve(Promise.resolve(1)));

      await expect(lastValueFrom(result)).resolves.toBe(1);
    });

    it('should wrap a plain value', async () => {
      const { controller } = setup();

      const result = await controller.pickResult(Promise.resolve('value'));

      await expect(lastValueFrom(result)).resolves.toBe('value');
    });
  });

  describe('inspectEntrypointDefinitions', () => {
    it('should insert every message handler', () => {
      const { controller, graphInspector } = setup();
      const instance = new Gateway();
      const handlers = [
        { message: 'a', methodName: 'a', callback: () => undefined, isAckHandledManually: false },
        { message: 'b', methodName: 'b', callback: () => undefined, isAckHandledManually: false },
      ];

      controller.inspectEntrypointDefinitions(
        instance,
        3000,
        handlers as any,
        'id',
      );

      expect(graphInspector.insertEntrypointDefinition).toHaveBeenCalledTimes(2);
      expect(graphInspector.insertEntrypointDefinition).toHaveBeenCalledWith(
        {
          type: 'websocket',
          methodName: 'a',
          className: 'Gateway',
          classNodeId: 'id',
          metadata: { port: 3000, key: 'a', message: 'a' },
        },
        'id',
      );
    });
  });

  describe('createRequestScopedHandler', () => {
    it('should load global enhancers for a singleton without resolving it', async () => {
      const { controller, container, injector, contextCreator, config } = setup();
      const instance = new Gateway();
      const wrapper = wrapperFor(instance);
      const guard = {
        isDependencyTreeStatic: () => true,
        isDependencyTreeDurable: () => false,
      };
      config.getGlobalRequestGuards.mockReturnValue([guard]);
      const create = vi.spyOn(contextCreator, 'create');
      const client: any = {};

      const handler = controller.createRequestScopedHandler(
        wrapper as any,
        { providers: new Map() } as any,
        'module',
        'onMessage',
      );
      await handler(client);

      expect(injector.loadPerContext).not.toHaveBeenCalled();
      expect(injector.loadEnhancersPerContext).toHaveBeenCalledWith(
        wrapper,
        client[REQUEST_CONTEXT_ID],
        wrapper,
        [guard],
      );
      expect(injector.waitForDeferredLoads).toHaveBeenCalledWith(
        client[REQUEST_CONTEXT_ID],
      );
      expect(create).toHaveBeenCalledWith(
        instance,
        instance.onMessage,
        'module',
        'onMessage',
        client[REQUEST_CONTEXT_ID],
        'wrapper-id',
      );
    });

    it('should resolve a transient gateway per context', async () => {
      const { controller, injector } = setup();
      const instance = new Gateway();
      const contextInstance = new Gateway();
      injector.loadPerContext.mockResolvedValue(contextInstance);
      const wrapper = wrapperFor(instance, {
        isDependencyTreeStatic: () => false,
      });

      const handler = controller.createRequestScopedHandler(
        wrapper as any,
        { providers: new Map() } as any,
        'module',
        'onMessage',
      );
      await handler({});

      expect(injector.loadPerContext).toHaveBeenCalledOnce();
      expect(injector.loadEnhancersPerContext).toHaveBeenCalledWith(
        wrapper,
        expect.anything(),
        wrapper,
        [],
      );
    });

    it('should use the durability of global enhancers for a singleton', async () => {
      const { controller, config, injector } = setup();
      config.getGlobalRequestGuards.mockReturnValue([
        {
          isDependencyTreeStatic: () => false,
          isDependencyTreeDurable: () => true,
        },
      ]);
      const wrapper = wrapperFor(new Gateway());
      const spy = vi.spyOn(controller as any, 'getContextId');

      await controller.createRequestScopedHandler(
        wrapper as any,
        { providers: new Map() } as any,
        'module',
        'onMessage',
      )({});

      expect(spy).toHaveBeenCalledWith(expect.anything(), true);
      expect(injector.loadEnhancersPerContext).toHaveBeenCalledOnce();
    });

    it('should default missing enhancer metadata to an empty list', async () => {
      const { controller, config } = setup();
      config.getGlobalRequestGuards.mockReturnValue([]);
      const wrapper = wrapperFor(new Gateway(), {
        getEnhancersMetadata: () => undefined,
      });

      await controller.createRequestScopedHandler(
        wrapper as any,
        { providers: new Map() } as any,
        'module',
        'onMessage',
      )({});

      expect(true).toBe(true);
    });

    it('should pass handler errors to lazily created exception filters', async () => {
      const { controller, exceptionFiltersContext, exceptionHandler } = setup();
      const instance = new Gateway();
      const wrapper = wrapperFor(instance);
      const error = new Error('handler failed');
      const handlerFn = vi.fn(() => {
        throw error;
      });
      (controller as any).contextCreator = {
        create: () => handlerFn,
      };
      const filter = vi.fn();
      exceptionFiltersContext.create.mockReturnValue({ handle: filter });

      await controller.createRequestScopedHandler(
        wrapper as any,
        { providers: new Map() } as any,
        'module',
        'onMessage',
      )({ id: 1 });

      expect(exceptionFiltersContext.create).toHaveBeenCalledWith(
        instance,
        instance.onMessage,
        'module',
      );
      expect(filter).toHaveBeenCalledWith(error, expect.any(ExecutionContextHost));
    });

    it('should use the unknown pattern when the method has no message metadata', async () => {
      const { controller, exceptionFiltersContext } = setup();
      const instance = new Gateway();
      const wrapper = wrapperFor(instance);
      (controller as any).contextCreator = {
        create: () => () => {
          throw new Error('failed');
        },
      };
      const filter = vi.fn();
      exceptionFiltersContext.create.mockReturnValue({ handle: filter });

      await controller.createRequestScopedHandler(
        wrapper as any,
        { providers: new Map() } as any,
        'module',
        'plain',
      )({ id: 1 });

      const host = filter.mock.calls[0][1];
      expect(host.switchToWs().getPattern()).toBe('unknown');
    });
  });

  describe('createRequestScopedEventHandler', () => {
    it('should run a handleConnection hook on a static gateway', async () => {
      const { controller, injector } = setup();
      const instance = new Gateway();
      const result = { ok: true };
      instance.handleConnection = vi.fn(() => result);
      const wrapper = wrapperFor(instance);

      const handler = controller.createRequestScopedEventHandler(
        wrapper as any,
        { providers: new Map() } as any,
        'module',
        'handleConnection',
        {},
      );

      await expect(handler({ id: 1 })).resolves.toBe(result);
      expect(injector.loadPerContext).not.toHaveBeenCalled();
    });

    it('should assign the server to a transient instance', async () => {
      const { controller, injector } = setup();
      const instance = new Gateway();
      const contextInstance = new Gateway();
      contextInstance.handleConnection = vi.fn();
      injector.loadPerContext.mockResolvedValue(contextInstance);
      const assign = vi
        .spyOn(controller as any, 'assignServerToProperties')
        .mockImplementation(() => undefined);
      const wrapper = wrapperFor(instance, {
        isDependencyTreeStatic: () => false,
      });

      const handler = controller.createRequestScopedEventHandler(
        wrapper as any,
        { providers: new Map() } as any,
        'module',
        'handleConnection',
        { id: 'server' },
      );
      await handler({ id: 1 });

      expect(assign).toHaveBeenCalledWith(contextInstance, { id: 'server' });
    });

    it('should not assign the server to a static instance', async () => {
      const { controller } = setup();
      const instance = new Gateway();
      instance.handleConnection = vi.fn(() => undefined);
      const assign = vi
        .spyOn(controller as any, 'assignServerToProperties')
        .mockImplementation(() => undefined);
      const wrapper = wrapperFor(instance);

      const handler = controller.createRequestScopedEventHandler(
        wrapper as any,
        { providers: new Map() } as any,
        'module',
        'handleConnection',
        { id: 'server' },
      );
      await handler({ id: 1 });

      expect(assign).not.toHaveBeenCalled();
    });

    it('should count pending disconnects and clean up the last one', async () => {
      const { controller } = setup();
      const instance = new Gateway();
      const client: any = { id: 1 };
      const handler = controller.createRequestScopedEventHandler(
        wrapperFor(instance) as any,
        { providers: new Map() } as any,
        'module',
        'handleDisconnect',
        {},
      );

      await handler(client, 'bye');

      expect(client[REQUEST_CONTEXT_ID]).toBeUndefined();
    });

    it('should retain the context while another disconnect is pending', async () => {
      const { controller } = setup();
      const instance = new Gateway();
      const client: any = { id: 1 };
      let release!: () => void;
      const gate = new Promise<void>(resolve => {
        release = resolve;
      });
      instance.handleDisconnect = vi.fn(async () => {
        await gate;
      });
      const create = () =>
        controller.createRequestScopedEventHandler(
          wrapperFor(instance) as any,
          { providers: new Map() } as any,
          'module',
          'handleDisconnect',
          {},
        );

      const first = create()(client, 'bye');
      const second = create()(client, 'bye');
      release();
      await Promise.all([first, second]);

      expect(client[REQUEST_CONTEXT_ID]).toBeUndefined();
    });

    it('should not remove a newer context of the same client', async () => {
      const { controller } = setup();
      const instance = new Gateway();
      const client: any = { id: 1 };
      instance.handleDisconnect = vi.fn(async () => {
        Object.defineProperty(client, REQUEST_CONTEXT_ID, {
          value: 'newer',
          configurable: true,
        });
      });
      const handler = controller.createRequestScopedEventHandler(
        wrapperFor(instance) as any,
        { providers: new Map() } as any,
        'module',
        'handleDisconnect',
        {},
      );

      await handler(client, 'bye');

      expect(client[REQUEST_CONTEXT_ID]).toBe('newer');
    });

    it('should log when a gateway without the hook fails to resolve', async () => {
      const { controller, injector } = setup();
      const instance = new Gateway();
      instance.handleConnection = undefined as any;
      injector.loadPerContext.mockRejectedValue(new Error('resolve failed'));
      const logger = (controller as any).logger;
      const error = vi.spyOn(logger, 'error').mockImplementation(() => undefined);
      const wrapper = wrapperFor(instance, {
        isDependencyTreeStatic: () => false,
      });

      const handler = controller.createRequestScopedEventHandler(
        wrapper as any,
        { providers: new Map() } as any,
        'module',
        'handleConnection',
        {},
      );

      await expect(handler({ id: 1 })).resolves.toBeUndefined();
      expect(error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to resolve'),
        expect.anything(),
      );
    });

    it('should log a disconnection resolution failure', async () => {
      const { controller, injector } = setup();
      const instance = new Gateway();
      instance.handleDisconnect = undefined as any;
      injector.loadPerContext.mockRejectedValue(new Error('resolve failed'));
      const logger = (controller as any).logger;
      const error = vi.spyOn(logger, 'error').mockImplementation(() => undefined);
      const wrapper = wrapperFor(instance, {
        isDependencyTreeStatic: () => false,
      });

      const handler = controller.createRequestScopedEventHandler(
        wrapper as any,
        { providers: new Map() } as any,
        'module',
        'handleDisconnect',
        {},
      );
      await handler({ id: 1 }, 'bye');

      expect(error).toHaveBeenCalledWith(
        expect.stringContaining('disconnection'),
        expect.anything(),
      );
    });

    it('should log when the enhancers also fail to resolve', async () => {
      const { controller, injector } = setup();
      const instance = new Gateway();
      injector.loadPerContext.mockRejectedValue(new Error('resolve failed'));
      injector.loadEnhancersPerContext.mockRejectedValue(
        new Error('enhancer failed'),
      );
      const logger = (controller as any).logger;
      const error = vi.spyOn(logger, 'error').mockImplementation(() => undefined);
      const wrapper = wrapperFor(instance, {
        isDependencyTreeStatic: () => false,
      });

      const handler = controller.createRequestScopedEventHandler(
        wrapper as any,
        { providers: new Map() } as any,
        'module',
        'handleConnection',
        {},
      );

      await handler({ id: 1 });

      expect(error).toHaveBeenCalledOnce();
    });

    it('should create enhancers then filter the error when resolution fails', async () => {
      const { controller, injector, exceptionFiltersContext } = setup();
      const instance = new Gateway();
      const client: any = { id: 1 };
      injector.loadPerContext.mockRejectedValue(new Error('resolve failed'));
      const filter = vi.fn();
      exceptionFiltersContext.create.mockReturnValue({ handle: filter });
      const wrapper = wrapperFor(instance, {
        isDependencyTreeStatic: () => false,
      });

      const handler = controller.createRequestScopedEventHandler(
        wrapper as any,
        { providers: new Map() } as any,
        'module',
        'handleConnection',
        {},
      );
      await handler(client, 'data');

      expect(injector.loadEnhancersPerContext).toHaveBeenCalledWith(
        wrapper,
        client[REQUEST_CONTEXT_ID],
        wrapper,
      );
      expect(exceptionFiltersContext.create).toHaveBeenCalledWith(
        instance,
        instance.handleConnection,
        'module',
        client[REQUEST_CONTEXT_ID],
        'wrapper-id',
      );
      expect(filter).toHaveBeenCalledOnce();
    });

    it('should pass a hook rejection to the exception filter', async () => {
      const { controller, exceptionFiltersContext } = setup();
      const instance = new Gateway();
      const error = new Error('hook failed');
      instance.handleConnection = vi.fn(async () => {
        throw error;
      });
      const filter = vi.fn();
      exceptionFiltersContext.create.mockReturnValue({ handle: filter });

      const handler = controller.createRequestScopedEventHandler(
        wrapperFor(instance) as any,
        { providers: new Map() } as any,
        'module',
        'handleConnection',
        {},
      );
      await handler({ id: 1 });

      expect(filter).toHaveBeenCalledWith(error, expect.any(ExecutionContextHost));
    });

    it('should pass the disconnect reason as the data of the filter host', async () => {
      const { controller, exceptionFiltersContext } = setup();
      const instance = new Gateway();
      instance.handleDisconnect = vi.fn(async () => {
        throw new Error('disconnect failed');
      });
      const filter = vi.fn();
      exceptionFiltersContext.create.mockReturnValue({ handle: filter });

      const handler = controller.createRequestScopedEventHandler(
        wrapperFor(instance) as any,
        { providers: new Map() } as any,
        'module',
        'handleDisconnect',
        {},
      );
      await handler({ id: 1 }, 'gone');

      const host = filter.mock.calls[0][1];
      expect(host.switchToWs().getData()).toBe('gone');
      expect(host.switchToWs().getPattern()).toBe('handleDisconnect');
    });
  });

  describe('createStaticEventHandler', () => {
    it('should return undefined without a hook', () => {
      const { controller } = setup();
      const instance = new Gateway();
      instance.handleConnection = undefined as any;

      expect(
        controller.createStaticEventHandler(instance, 'module', 'handleConnection'),
      ).toBeUndefined();
    });

    it('should run the hook synchronously', () => {
      const { controller } = setup();
      const instance = new Gateway();
      const result = { ok: true };
      instance.handleConnection = vi.fn(() => result);

      const handler = controller.createStaticEventHandler(
        instance,
        'module',
        'handleConnection',
      )!;

      expect(handler({ id: 1 })).toBe(result);
    });

    it('should catch a synchronous error with a lazily created filter', () => {
      const { controller, exceptionFiltersContext } = setup();
      const instance = new Gateway();
      const error = new Error('sync');
      instance.handleConnection = vi.fn(() => {
        throw error;
      });
      const filter = vi.fn();
      exceptionFiltersContext.create.mockReturnValue({ handle: filter });

      const handler = controller.createStaticEventHandler(
        instance,
        'module',
        'handleConnection',
      )!;
      handler({ id: 1 });

      expect(exceptionFiltersContext.create).toHaveBeenCalledWith(
        instance,
        instance.handleConnection,
        'module',
      );
      expect(filter).toHaveBeenCalledWith(error, expect.any(ExecutionContextHost));
    });

    it('should catch a rejected hook promise', async () => {
      const { controller, exceptionFiltersContext } = setup();
      const instance = new Gateway();
      const error = new Error('async');
      instance.handleConnection = vi.fn(async () => {
        throw error;
      });
      const filter = vi.fn();
      exceptionFiltersContext.create.mockReturnValue({ handle: filter });
      const handler = controller.createStaticEventHandler(
        instance,
        'module',
        'handleConnection',
      )!;

      await handler({ id: 1 });

      expect(filter).toHaveBeenCalledWith(error, expect.any(ExecutionContextHost));
    });

    it('should pass the disconnect reason to the filter', async () => {
      const { controller, exceptionFiltersContext } = setup();
      const instance = new Gateway();
      instance.handleDisconnect = vi.fn(async () => {
        throw new Error('async');
      });
      const filter = vi.fn();
      exceptionFiltersContext.create.mockReturnValue({ handle: filter });
      const handler = controller.createStaticEventHandler(
        instance,
        'module',
        'handleDisconnect',
      )!;

      await handler({ id: 1 }, 'bye');

      const host = filter.mock.calls[0][1];
      expect(host.switchToWs().getData()).toBe('bye');
      expect(host.switchToWs().getPattern()).toBe('handleDisconnect');
    });
  });

  describe('getContextId', () => {
    it('should define and register a new request context', () => {
      const { controller, container } = setup();
      const client: any = { id: 1 };

      const contextId = controller.getContextId(client, false);

      expect(client[REQUEST_CONTEXT_ID]).toBe(contextId);
      expect(Object.keys(client)).not.toContain(String(REQUEST_CONTEXT_ID));
      expect(container.registerRequestProvider).toHaveBeenCalledWith(
        client,
        contextId,
      );
      expect(controller.getContextId(client, false)).toBe(contextId);
    });

    it('should register the payload for a durable tree', () => {
      const { controller, container } = setup();
      const client: any = { id: 1 };

      controller.getContextId(client, true);

      expect(container.registerRequestProvider).toHaveBeenCalledOnce();
    });
  });

  describe('assignServerToProperties and logs', () => {
    it('should assign the server to decorated properties', () => {
      const { controller } = setup();
      const instance = new Gateway();
      const server = { id: 'server' };

      (controller as any).assignServerToProperties(instance, server);

      expect(instance.server).toBe(server);
    });

    it('should skip logging when the instance has no constructor name', () => {
      const { controller } = setup();
      const logger = (controller as any).logger;
      const log = vi.spyOn(logger, 'log').mockImplementation(() => undefined);
      const instance = Object.create(null);

      (controller as any).printSubscriptionLogs(instance, [
        { message: 'a' },
      ]);

      expect(log).not.toHaveBeenCalled();
    });

    it('should log each subscribed message', () => {
      const { controller } = setup();
      const logger = (controller as any).logger;
      const log = vi.spyOn(logger, 'log').mockImplementation(() => undefined);

      (controller as any).printSubscriptionLogs(new Gateway(), [
        { message: 'a' },
        { message: 'b' },
      ]);

      expect(log).toHaveBeenCalledTimes(2);
    });
  });
});
