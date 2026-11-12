import { EMPTY, lastValueFrom, of, throwError, toArray } from 'rxjs';
import { ExecutionContextHost } from '../../../packages/core/helpers/execution-context-host.js';
import { STATIC_CONTEXT } from '../../../packages/core/injector/constants.js';
import { InstanceWrapper } from '../../../packages/core/injector/instance-wrapper.js';
import { REQUEST_CONTEXT_ID } from '../../../packages/core/router/request/request-constants.js';
import { RequestContextHost } from '../../../packages/microservices/context/request-context-host.js';
import {
  DEFAULT_CALLBACK_METADATA,
  DEFAULT_GRPC_CALLBACK_METADATA,
} from '../../../packages/microservices/context/rpc-metadata-constants.js';
import { Transport } from '../../../packages/microservices/enums/transport.enum.js';
import type { EventOrMessageListenerDefinition } from '../../../packages/microservices/listener-metadata-explorer.js';
import { ListenersController } from '../../../packages/microservices/listeners-controller.js';
import { ServerGrpc } from '../../../packages/microservices/server/server-grpc.js';

const moduleKey = 'moduleKey';
const pattern = 'message.pattern';

const definition = (
  overrides: Partial<EventOrMessageListenerDefinition> = {},
): EventOrMessageListenerDefinition => ({
  patterns: [pattern],
  methodKey: 'handle',
  isEventHandler: false,
  targetCallback: () => 'callback',
  ...overrides,
});

describe('ListenersController', () => {
  let instance: ListenersController;
  let clientsContainer: any;
  let contextCreator: any;
  let container: any;
  let injector: any;
  let clientFactory: any;
  let exceptionFiltersContext: any;
  let graphInspector: any;
  let proxySpy: any;
  let moduleRef: any;

  beforeEach(() => {
    moduleRef = { controllers: new Map() };
    clientsContainer = { addClient: vi.fn() };
    contextCreator = { create: vi.fn() };
    container = {
      getModuleByKey: vi.fn(() => moduleRef),
      registerRequestProvider: vi.fn(),
    };
    injector = { loadPerContext: vi.fn() };
    clientFactory = { create: vi.fn() };
    exceptionFiltersContext = { create: vi.fn() };
    graphInspector = { insertEntrypointDefinition: vi.fn() };
    instance = new ListenersController(
      clientsContainer,
      contextCreator,
      container,
      injector,
      clientFactory,
      exceptionFiltersContext,
      graphInspector,
    );
    proxySpy = vi.fn(() => of('proxied'));
    contextCreator.create.mockReturnValue(proxySpy);
  });

  /** Constructor: pure assignment of the seven collaborators, no decisions. */
  describe('constructor', () => {
    it('stores every collaborator', () => {
      expect((instance as any).clientsContainer).toBe(clientsContainer);
      expect((instance as any).contextCreator).toBe(contextCreator);
      expect((instance as any).container).toBe(container);
      expect((instance as any).injector).toBe(injector);
      expect((instance as any).clientFactory).toBe(clientFactory);
      expect((instance as any).exceptionFiltersContext).toBe(
        exceptionFiltersContext,
      );
      expect((instance as any).graphInspector).toBe(graphInspector);
    });

    it('creates its own metadata explorer', () => {
      expect((instance as any).metadataExplorer.constructor.name).toBe(
        'ListenerMetadataExplorer',
      );
    });
  });

  /**
   * CFG / C3 of registerPatternHandlers:
   * D1: serverInstance instanceof ServerGrpc              -> c1 (callback metadata)
   * D2: isUndefined(transport) || isUndefined(transportId) || transport === transportId
   *                                                       -> c2, c3, c4
   * D3: isStatic (instanceWrapper.isDependencyTreeStatic)-> static vs request path
   * D4: isEventHandler && !propagatesEventHandlerErrors  -> c5, c6
   * D5: isEventHandler (static path handler shape)       -> both outcomes
   * D6: dataOrContextHost instanceof RequestContextHost  -> both outcomes
   * Infeasible: none; every atomic condition is exercised true and false.
   */
  describe('registerPatternHandlers', () => {
    const explore = (definitions: EventOrMessageListenerDefinition[]) =>
      vi
        .spyOn((instance as any).metadataExplorer, 'explore')
        .mockReturnValue(definitions);

    const createWrapper = (
      isStatic = true,
      metatype: any = class TestController {},
    ) => {
      const wrapper = new InstanceWrapper({
        instance: { handle: () => 'handler' },
        metatype,
      });
      vi.spyOn(wrapper, 'isDependencyTreeStatic').mockReturnValue(isStatic);
      return wrapper;
    };

    const createServer = (overrides: Record<string, any> = {}) => ({
      addHandler: vi.fn(),
      transportId: Transport.TCP,
      propagatesEventHandlerErrors: false,
      ...overrides,
    });

    it('D1(F) D3(T) D5(F) - creates a static message proxy with default callback metadata', () => {
      const handlerDefinition = definition();
      explore([handlerDefinition]);
      const server = createServer();
      const wrapper = createWrapper();

      instance.registerPatternHandlers(wrapper, server as any, moduleKey);

      expect(container.getModuleByKey).toHaveBeenCalledWith(moduleKey);
      expect(contextCreator.create).toHaveBeenCalledWith(
        wrapper.instance,
        handlerDefinition.targetCallback,
        moduleKey,
        'handle',
        STATIC_CONTEXT,
        wrapper.id,
        DEFAULT_CALLBACK_METADATA,
        false,
      );
      expect(server.addHandler).toHaveBeenCalledExactlyOnceWith(
        pattern,
        proxySpy,
        false,
        undefined,
      );
    });

    it('D1(T) - uses the gRPC default callback metadata for ServerGrpc', () => {
      explore([definition()]);
      const server: any = Object.create(ServerGrpc.prototype);
      server.addHandler = vi.fn();
      server.transportId = Transport.GRPC;
      server.propagatesEventHandlerErrors = false;

      instance.registerPatternHandlers(createWrapper(), server, moduleKey);

      expect(contextCreator.create.mock.calls[0][6]).toBe(
        DEFAULT_GRPC_CALLBACK_METADATA,
      );
      expect(server.addHandler).toHaveBeenCalledOnce();
    });

    it.each([
      ['D2(c2 T) - handler without transport', undefined, Transport.TCP, 1],
      [
        'D2(c2 F,c3 T) - server without transportId',
        Transport.KAFKA,
        undefined,
        1,
      ],
      [
        'D2(c2 F,c3 F,c4 T) - matching transport',
        Transport.TCP,
        Transport.TCP,
        1,
      ],
      [
        'D2(c2 F,c3 F,c4 F) - different transport',
        Transport.KAFKA,
        Transport.TCP,
        0,
      ],
    ])('%s', (_label, handlerTransport, serverTransportId, expectedCalls) => {
      explore([definition({ transport: handlerTransport })]);
      const server = createServer({ transportId: serverTransportId });

      instance.registerPatternHandlers(
        createWrapper(),
        server as any,
        moduleKey,
      );

      expect(server.addHandler).toHaveBeenCalledTimes(expectedCalls);
    });

    it('D5(T) - wraps a static event handler', async () => {
      explore([
        definition({ isEventHandler: true, patterns: ['event.pattern'] }),
      ]);
      const server = createServer();

      instance.registerPatternHandlers(
        createWrapper(),
        server as any,
        moduleKey,
      );

      const registered = server.addHandler.mock.calls[0][1];
      expect(registered).not.toBe(proxySpy);
      expect(server.addHandler).toHaveBeenCalledWith(
        'event.pattern',
        registered,
        true,
        undefined,
      );

      await registered('data', 'context');

      expect(proxySpy).toHaveBeenCalledWith('data', 'context');
    });

    it('D6(T) - a RequestContextHost first argument is dropped before the proxy call', async () => {
      explore([
        definition({ isEventHandler: true, patterns: ['event.pattern'] }),
      ]);
      const server = createServer();
      instance.registerPatternHandlers(
        createWrapper(),
        server as any,
        moduleKey,
      );
      const registered = server.addHandler.mock.calls[0][1];

      const host = RequestContextHost.create(
        'event.pattern',
        'data',
        'ctx' as any,
      );
      await registered(host, 'extra');

      expect(proxySpy).toHaveBeenCalledExactlyOnceWith('extra');
    });

    it('D6(F) - arguments are kept when the first one is not a RequestContextHost', async () => {
      explore([
        definition({ isEventHandler: true, patterns: ['event.pattern'] }),
      ]);
      const server = createServer();
      instance.registerPatternHandlers(
        createWrapper(),
        server as any,
        moduleKey,
      );
      const registered = server.addHandler.mock.calls[0][1];

      await registered('data', 'extra');

      expect(proxySpy).toHaveBeenCalledExactlyOnceWith('data', 'extra');
    });

    it.each([
      [
        'D4(c5 T,c6 T) - event handler reports unhandled errors',
        true,
        false,
        true,
      ],
      [
        'D4(c5 T,c6 F) - transport propagates the error itself',
        true,
        true,
        false,
      ],
      ['D4(c5 F) - message handler never reports', false, false, false],
    ])('%s', (_label, isEventHandler, propagates, expectedReport) => {
      explore([definition({ isEventHandler })]);
      const server = createServer({ propagatesEventHandlerErrors: propagates });

      instance.registerPatternHandlers(
        createWrapper(),
        server as any,
        moduleKey,
      );

      expect(contextCreator.create.mock.calls[0][7]).toBe(expectedReport);
    });

    it('D2 - registers one handler per pattern of a multi-pattern definition', () => {
      explore([definition({ patterns: ['first', 'second'] })]);
      const server = createServer();

      instance.registerPatternHandlers(
        createWrapper(),
        server as any,
        moduleKey,
      );

      expect(server.addHandler).toHaveBeenCalledTimes(2);
      expect(server.addHandler.mock.calls.map(call => call[0])).toEqual([
        'first',
        'second',
      ]);
    });

    it('forwards the definition extras to addHandler', () => {
      explore([definition({ extras: { qos: 1 } })]);
      const server = createServer();

      instance.registerPatternHandlers(
        createWrapper(),
        server as any,
        moduleKey,
      );

      expect(server.addHandler.mock.calls[0][3]).toEqual({ qos: 1 });
    });

    it('D3(F) - a request scoped wrapper registers a deferred handler', () => {
      explore([definition()]);
      const server = createServer();
      const asyncHandler = vi.fn();
      const createScoped = vi
        .spyOn(instance, 'createRequestScopedHandler')
        .mockReturnValue(asyncHandler as any);
      const wrapper = createWrapper(false);

      instance.registerPatternHandlers(wrapper, server as any, moduleKey);

      expect(createScoped).toHaveBeenCalledWith(
        wrapper,
        pattern,
        moduleRef,
        moduleKey,
        'handle',
        DEFAULT_CALLBACK_METADATA,
        false,
        false,
      );
      expect(server.addHandler).toHaveBeenCalledWith(
        pattern,
        asyncHandler,
        false,
        undefined,
      );
    });

    it.each([
      ['event handler', true, false, true],
      ['event handler with propagation', true, true, false],
      ['message handler', false, false, false],
    ])(
      'D3(F) - request scoped %s forwards the report flag',
      (_label, isEventHandler, propagates, expectedReport) => {
        explore([definition({ isEventHandler })]);
        const server = createServer({
          propagatesEventHandlerErrors: propagates,
        });
        const createScoped = vi
          .spyOn(instance, 'createRequestScopedHandler')
          .mockReturnValue(vi.fn() as any);

        instance.registerPatternHandlers(
          createWrapper(false),
          server as any,
          moduleKey,
        );

        expect(createScoped.mock.calls[0][6]).toBe(isEventHandler);
        expect(createScoped.mock.calls[0][7]).toBe(expectedReport);
      },
    );

    it('inserts an entrypoint definition for every registered handler', () => {
      explore([definition({ patterns: ['first', 'second'] })]);
      const server = createServer();

      instance.registerPatternHandlers(
        createWrapper(),
        server as any,
        moduleKey,
      );

      expect(graphInspector.insertEntrypointDefinition).toHaveBeenCalledTimes(
        2,
      );
      expect(
        graphInspector.insertEntrypointDefinition.mock.calls[0][0].metadata.key,
      ).toBe('first');
    });
  });

  /**
   * CFG / C3 of insertEntrypointDefinition:
   * D1: typeof transportId === 'number' -> both outcomes (Transport name vs symbol)
   * Infeasible: none.
   */
  describe('insertEntrypointDefinition', () => {
    const build = () => {
      class SceneController {}
      const wrapper = new InstanceWrapper({
        metatype: SceneController,
        name: SceneController.name,
      });
      return { wrapper, metadata: definition() };
    };

    it('D1(T) - maps a numeric transport id to its enum name', () => {
      const { wrapper, metadata } = build();

      instance.insertEntrypointDefinition(wrapper, metadata, Transport.MQTT);

      expect(graphInspector.insertEntrypointDefinition).toHaveBeenCalledWith(
        {
          type: 'microservice',
          methodName: 'handle',
          className: 'SceneController',
          classNodeId: wrapper.id,
          metadata: {
            key: pattern,
            transportId: 'MQTT',
            patterns: [pattern],
            isEventHandler: false,
            extras: undefined,
          },
        },
        wrapper.id,
      );
    });

    it('D1(F) - keeps a symbol transport id untouched', () => {
      const { wrapper, metadata } = build();
      const customTransport = Symbol('custom');

      instance.insertEntrypointDefinition(wrapper, metadata, customTransport);

      const [entrypointDefinition] =
        graphInspector.insertEntrypointDefinition.mock.calls[0];

      expect(entrypointDefinition.metadata.transportId).toBe(customTransport);
    });
  });

  /**
   * CFG / C3 of forkJoinHandlersIfAttached:
   * D1: handlerRef.next                       -> c1
   * D2: current.hasFailed                     -> c2
   * D3: next.hasFailed                        -> c3
   * Infeasible: c3 is only evaluated when c2 is false (both-failed rejects the
   * current error first); that ordering is asserted below.
   */
  describe('forkJoinHandlersIfAttached', () => {
    const handlerWithNext = (next?: any) => {
      const handler: any = async () => undefined;
      if (next) handler.next = next;
      return handler;
    };

    it('D1(F) - returns the current value untouched when no next handler is attached', () => {
      const current$ = of('current');

      expect(
        instance.forkJoinHandlersIfAttached(current$, [], handlerWithNext()),
      ).toBe(current$);
    });

    it('D1(T) D2(F) D3(F) - joins both successful handlers', async () => {
      const next = vi.fn(() => of('next'));

      const result$ = instance.forkJoinHandlersIfAttached(
        of('current'),
        ['arg'],
        handlerWithNext(next),
      );

      await expect(lastValueFrom(result$)).resolves.toEqual({
        current: 'current',
        next: 'next',
      });
      expect(next).toHaveBeenCalledExactlyOnceWith('arg');
    });

    it('D2(F) - an empty current stream still settles the join', async () => {
      const result$ = instance.forkJoinHandlersIfAttached(
        EMPTY,
        [],
        handlerWithNext(vi.fn(() => of('next'))),
      );

      await expect(lastValueFrom(result$)).resolves.toEqual({
        current: undefined,
        next: 'next',
      });
    });

    it('D2(T) - a failing current handler fails the join after the next ran', async () => {
      const failure = new Error('current failed');
      const next = vi.fn(() => of('next'));

      const result$ = instance.forkJoinHandlersIfAttached(
        throwError(() => failure),
        [],
        handlerWithNext(next),
      );

      await expect(lastValueFrom(result$)).rejects.toBe(failure);
      expect(next).toHaveBeenCalledOnce();
    });

    it('D2(F) D3(T) - a failing next handler fails the join', async () => {
      const failure = new Error('next failed');

      const result$ = instance.forkJoinHandlersIfAttached(
        of('current'),
        [],
        handlerWithNext(() => throwError(() => failure)),
      );

      await expect(lastValueFrom(result$)).rejects.toBe(failure);
    });

    it('D2(T) - the current error wins when both handlers fail', async () => {
      const currentFailure = new Error('current failed');
      const nextFailure = new Error('next failed');

      const result$ = instance.forkJoinHandlersIfAttached(
        throwError(() => currentFailure),
        [],
        handlerWithNext(() => throwError(() => nextFailure)),
      );

      await expect(lastValueFrom(result$)).rejects.toBe(currentFailure);
    });
  });

  /**
   * CFG / C3 of settleHandlerResult:
   * D1: catchError             -> error vs value outcome
   * D2: defaultIfEmpty         -> empty stream vs non-empty stream
   * Infeasible: none.
   */
  describe('settleHandlerResult', () => {
    const settle = (value: any) =>
      lastValueFrom((instance as any).settleHandlerResult(value));

    it('settles a value as a success', async () => {
      await expect(settle(of('value'))).resolves.toEqual({
        hasFailed: false,
        value: 'value',
      });
    });

    it('D2(T) - settles an empty stream as undefined success', async () => {
      await expect(settle(EMPTY)).resolves.toEqual({
        hasFailed: false,
        value: undefined,
      });
    });

    it('D1(T) - settles an error', async () => {
      const failure = new Error('boom');

      await expect(settle(throwError(() => failure))).resolves.toEqual({
        hasFailed: true,
        error: failure,
      });
    });

    it('settles a promise by waiting for it', async () => {
      await expect(settle(Promise.resolve('async'))).resolves.toEqual({
        hasFailed: false,
        value: 'async',
      });
    });

    it('settles a rejected promise as a failure', async () => {
      const failure = new Error('async boom');

      await expect(settle(Promise.reject(failure))).resolves.toEqual({
        hasFailed: true,
        error: failure,
      });
    });
  });

  /**
   * CFG / C3 of assignClientsToProperties: no decisions of its own; it walks
   * the hooks iterator (empty and non-empty) and delegates to the factory,
   * the container and assignClientToInstance.
   */
  describe('assignClientsToProperties', () => {
    const hookUp = (hooks: Array<{ property: string; metadata: any }>) =>
      vi
        .spyOn((instance as any).metadataExplorer, 'scanForClientHooks')
        .mockImplementation(function* () {
          yield* hooks;
        });

    it('creates and assigns one client per hook', () => {
      const firstClient = { name: 'first' };
      const secondClient = { name: 'second' };
      clientFactory.create
        .mockReturnValueOnce(firstClient)
        .mockReturnValueOnce(secondClient);
      hookUp([
        { property: 'first', metadata: { transport: Transport.TCP } },
        { property: 'second', metadata: { transport: Transport.REDIS } },
      ]);
      const controller: any = {};

      instance.assignClientsToProperties(controller);

      expect(clientFactory.create).toHaveBeenCalledTimes(2);
      expect(clientsContainer.addClient).toHaveBeenCalledTimes(2);
      expect(controller.first).toBe(firstClient);
      expect(controller.second).toBe(secondClient);
    });

    it('does nothing when there are no client hooks', () => {
      hookUp([]);
      const controller: any = {};

      instance.assignClientsToProperties(controller);

      expect(clientFactory.create).not.toHaveBeenCalled();
      expect(clientsContainer.addClient).not.toHaveBeenCalled();
      expect(controller).toEqual({});
    });
  });

  /** CFG / C3 of assignClientToInstance: single Reflect.set, no decisions. */
  describe('assignClientToInstance', () => {
    it('assigns the client to the property', () => {
      const controller: any = {};
      const client = { name: 'client' };

      instance.assignClientToInstance(controller, 'client', client);

      expect(controller.client).toBe(client);
    });

    it('overwrites an existing value', () => {
      const controller: any = { client: null };

      instance.assignClientToInstance(controller, 'client', 'created');

      expect(controller.client).toBe('created');
    });
  });

  /**
   * CFG / C3 of createRequestScopedHandler:
   * D1: dataOrContextHost instanceof RequestContextHost -> c1
   * D2: isTreeDurable (ternary in getContextId)          -> both outcomes
   * D3: !request[REQUEST_CONTEXT_ID]                     -> c2
   * D4: isEventHandler                                    -> both outcomes
   * D5: exceptionFilter ??= (cache hit vs miss)           -> both outcomes
   * Infeasible: none; the catch block and the success path are both reachable.
   */
  describe('createRequestScopedHandler', () => {
    const methodKey = 'handle';
    class ScopedController {
      public handle(..._args: unknown[]) {
        return 'handler';
      }
    }
    let wrapper: InstanceWrapper;
    let contextInstance: ScopedController;

    beforeEach(() => {
      contextInstance = new ScopedController();
      wrapper = new InstanceWrapper({
        instance: new ScopedController(),
        metatype: ScopedController,
      });
      injector.loadPerContext.mockResolvedValue(contextInstance);
      contextCreator.create.mockReturnValue(proxySpy);
      vi.spyOn(wrapper, 'isDependencyTreeDurable').mockReturnValue(false);
    });

    const createHandler = (overrides: any[] = []) =>
      (instance.createRequestScopedHandler as any)(
        wrapper,
        pattern,
        moduleRef,
        moduleKey,
        methodKey,
        ...overrides,
      );

    it('D1(F) - loads the context instance and forwards the args', async () => {
      const result = await createHandler()('data', 'context');

      expect(injector.loadPerContext).toHaveBeenCalledWith(
        wrapper.instance,
        moduleRef,
        moduleRef.controllers,
        expect.objectContaining({ id: expect.any(Number) }),
      );
      expect(contextCreator.create).toHaveBeenCalledWith(
        contextInstance,
        contextInstance.handle,
        moduleKey,
        methodKey,
        expect.anything(),
        wrapper.id,
        DEFAULT_CALLBACK_METADATA,
        false,
      );
      expect(proxySpy).toHaveBeenCalledExactlyOnceWith('data', 'context');
      expect(result).toBe(proxySpy.mock.results[0].value);
    });

    it('D1(T) - shifts a RequestContextHost first argument', async () => {
      const host = RequestContextHost.create(pattern, 'data', 'ctx' as any);

      await createHandler()(host, 'extra');

      expect(proxySpy).toHaveBeenCalledExactlyOnceWith('extra');
      expect(contextCreator.create.mock.calls[0][4]).toEqual(
        expect.objectContaining({ id: expect.any(Number) }),
      );
    });

    it('D3(T) - registers the request provider for a fresh request', async () => {
      await createHandler()('data');

      const [requestProviderValue, contextId] =
        container.registerRequestProvider.mock.calls[0];

      expect(requestProviderValue).toBeInstanceOf(RequestContextHost);
      expect(contextId).toBe(contextCreator.create.mock.calls[0][4]);
    });

    it('D3(F) - reuses an existing request context id', async () => {
      const host: any = RequestContextHost.create(pattern, 'data', null as any);
      const existingContextId = { id: 42 };
      Object.defineProperty(host, REQUEST_CONTEXT_ID, {
        value: existingContextId,
        enumerable: false,
        writable: false,
        configurable: false,
      });

      await createHandler()(host);

      expect(container.registerRequestProvider).not.toHaveBeenCalled();
      expect(contextCreator.create.mock.calls[0][4]).toBe(existingContextId);
    });

    it('D2(T) - a durable tree receives the context id payload', async () => {
      vi.spyOn(wrapper, 'isDependencyTreeDurable').mockReturnValue(true);

      await createHandler()('data');

      expect(
        container.registerRequestProvider.mock.calls[0][0],
      ).toBeUndefined();
    });

    it('D5(T) D4(F) - delegates a load failure to the exception filters', async () => {
      const failure = new Error('load failed');
      injector.loadPerContext.mockRejectedValue(failure);
      const handle = vi.fn(() => of('handled'));
      exceptionFiltersContext.create.mockReturnValue({ handle });

      const result = await createHandler()('data');

      expect(exceptionFiltersContext.create).toHaveBeenCalledWith(
        wrapper.instance,
        wrapper.instance[methodKey],
        moduleKey,
      );
      const [error, host, report] = handle.mock.calls[0];
      expect(error).toBe(failure);
      expect(host).toBeInstanceOf(ExecutionContextHost);
      expect(host.getType()).toBe('rpc');
      expect(host.getArgs()).toEqual(['data']);
      expect(report).toBe(false);
      expect(await lastValueFrom(result)).toBe('handled');
    });

    it('D5(F) - the exception filter is created once per handler and pattern', async () => {
      injector.loadPerContext.mockRejectedValue(new Error('load failed'));
      const handle = vi.fn(() => of('handled'));
      exceptionFiltersContext.create.mockReturnValue({ handle });
      const handler = createHandler();

      await handler('data');
      await handler('data');

      expect(exceptionFiltersContext.create).toHaveBeenCalledOnce();
      expect(handle).toHaveBeenCalledTimes(2);
    });

    it('D4(T) - an event handler forks the next handler and reports unhandled errors', async () => {
      const failure = new Error('load failed');
      injector.loadPerContext.mockRejectedValue(failure);
      const handle = vi.fn(() => of('handled'));
      exceptionFiltersContext.create.mockReturnValue({ handle });
      const next = vi.fn(() => of('next'));
      const handler: any = createHandler([undefined, true, true]);
      handler.next = next;

      const result$ = await handler('data');

      await expect(lastValueFrom(result$)).resolves.toEqual({
        current: 'handled',
        next: 'next',
      });
      expect(handle.mock.calls[0][2]).toBe(true);
      expect(next).toHaveBeenCalledExactlyOnceWith('data');
    });

    it('D4(F) - a message handler returns the filter result directly', async () => {
      injector.loadPerContext.mockRejectedValue(new Error('load failed'));
      const handled$ = of('handled');
      exceptionFiltersContext.create.mockReturnValue({
        handle: vi.fn(() => handled$),
      });

      const result = await createHandler()('data');

      expect(result).toBe(handled$);
    });

    it('D4(T) - a successful event handler forwards the request context host to next', async () => {
      const host = RequestContextHost.create(pattern, 'data', 'ctx' as any);
      const next = vi.fn(() => of('next'));
      const handler: any = createHandler([undefined, true, false]);
      handler.next = next;

      const result$ = await handler(host);

      await expect(lastValueFrom(result$)).resolves.toEqual({
        current: 'proxied',
        next: 'next',
      });
      expect(next).toHaveBeenCalledExactlyOnceWith(host);
    });
  });

  /**
   * CFG / C3 of getContextId:
   * D1: isTreeDurable ? contextId.payload : Object.assign(...) -> both outcomes
   * D2: !request[REQUEST_CONTEXT_ID]                            -> c1
   * Infeasible: none.
   */
  describe('getContextId', () => {
    const getContextId = (request: any, isTreeDurable: boolean) =>
      (instance as any).getContextId(request, isTreeDurable);

    it('D1(F) D2(T) - stamps the request and registers it as provider', () => {
      const request: any = {};

      const contextId = getContextId(request, false);

      expect(request[REQUEST_CONTEXT_ID]).toBe(contextId);
      expect(
        Object.getOwnPropertyDescriptor(request, REQUEST_CONTEXT_ID)!
          .enumerable,
      ).toBe(false);
      expect(container.registerRequestProvider).toHaveBeenCalledExactlyOnceWith(
        request,
        contextId,
      );
    });

    it('D1(T) D2(T) - a durable tree registers the payload instead of the request', () => {
      const request: any = {};

      const contextId = getContextId(request, true);

      expect(request[REQUEST_CONTEXT_ID]).toBe(contextId);
      expect(container.registerRequestProvider).toHaveBeenCalledExactlyOnceWith(
        undefined,
        contextId,
      );
    });

    it('D2(F) - returns the stored context id without registering again', () => {
      const existing = { id: 7 };
      const request: any = {};
      Object.defineProperty(request, REQUEST_CONTEXT_ID, {
        value: existing,
        enumerable: false,
        configurable: false,
      });

      expect(getContextId(request, false)).toBe(existing);
      expect(container.registerRequestProvider).not.toHaveBeenCalled();
    });
  });

  /**
   * CFG / C3 of transformToObservable:
   * D1: resultOrDeferred instanceof Promise  -> c1
   * D2: isObservable(value) inside mergeMap  -> c2 (only when c1 is true)
   * D3: isObservable(resultOrDeferred)       -> c3 (only when c1 is false)
   * Infeasible: c2 is not evaluated when c1 is false; c3 is not evaluated when
   * c1 is true. Both are exercised in their reachable branch.
   */
  describe('transformToObservable', () => {
    it('D1(T) D2(F) - wraps a resolved promise value', async () => {
      await expect(
        lastValueFrom(instance.transformToObservable(Promise.resolve('value'))),
      ).resolves.toBe('value');
    });

    it('D1(T) D2(T) - flattens a promise resolving to an observable', async () => {
      const values = await lastValueFrom(
        instance
          .transformToObservable(Promise.resolve(of(1, 2)))
          .pipe(toArray()),
      );

      expect(values).toEqual([1, 2]);
    });

    it('D1(T) - propagates a rejected promise', async () => {
      const failure = new Error('async boom');

      await expect(
        lastValueFrom(instance.transformToObservable(Promise.reject(failure))),
      ).rejects.toBe(failure);
    });

    it('D1(F) D3(T) - returns an observable untouched', () => {
      const source$ = of('value');

      expect(instance.transformToObservable(source$)).toBe(source$);
    });

    it.each([
      ['string', 'value'],
      ['zero', 0],
      ['false', false],
      ['null', null],
    ])('D1(F) D3(F) - wraps the %s plain value', async (_label, value) => {
      await expect(
        lastValueFrom(instance.transformToObservable(value as any)),
      ).resolves.toBe(value);
    });
  });
});
