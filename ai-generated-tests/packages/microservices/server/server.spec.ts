import { lastValueFrom, Observable, of, Subject, throwError } from 'rxjs';
import { BaseRpcContext } from '../../../../packages/microservices/ctx-host/base-rpc.context.js';
import { IncomingRequestDeserializer } from '../../../../packages/microservices/deserializers/incoming-request.deserializer.js';
import { InvalidPacketIdException } from '../../../../packages/microservices/errors/invalid-packet-id.exception.js';
import { Server } from '../../../../packages/microservices/server/server.js';
import { IdentitySerializer } from '../../../../packages/microservices/serializers/identity.serializer.js';
import { UNSERIALIZABLE_PATTERN } from '../../../../packages/microservices/constants.js';

type AnyFunction = (...args: any[]) => any;

class TestServer extends Server {
  public answerRejectedRequest = true;

  public on<
    EventKey extends string = string,
    EventCallback extends AnyFunction = AnyFunction,
  >(_event: EventKey, _callback: EventCallback) {}

  public unwrap<T>(): T {
    return undefined as T;
  }

  public listen(_callback: () => void) {}

  public close() {}

  protected shouldAnswerRejectedRequest(): boolean {
    return this.answerRejectedRequest;
  }

  public callHandleRequest(
    context: BaseRpcContext,
    produce: AnyFunction,
    respond: AnyFunction,
  ) {
    return this.handleRequest(context, produce, respond);
  }

  public callRunWithProcessingHooks(
    context: BaseRpcContext,
    fn: (runEndHook: () => void) => Promise<void>,
    endHookContext?: BaseRpcContext,
  ) {
    return endHookContext === undefined
      ? this.runWithProcessingHooks(context, fn)
      : this.runWithProcessingHooks(context, fn, endHookContext);
  }

  public callCreateProcessingEndHookRunner(context: BaseRpcContext) {
    return this.createProcessingEndHookRunner(context);
  }

  public callGetRouteFromPattern(pattern: string) {
    return this.getRouteFromPattern(pattern);
  }

  public callNormalizePattern(pattern: any) {
    return this.normalizePattern(pattern);
  }

  public callGetPatternAsString(pattern: unknown) {
    return this.getPatternAsString(pattern);
  }

  public callAssertValidPacketId(id: unknown) {
    return this.assertValidPacketId(id);
  }

  public callInitializeSerializer(options: any) {
    this.initializeSerializer(options);
  }

  public callInitializeDeserializer(options: any) {
    this.initializeDeserializer(options);
  }

  public callHandleError(error: string) {
    this.handleError(error);
  }

  public callLoadPackage<T>(name: string, ctx: string, loader?: () => T) {
    return this.loadPackage(name, ctx, loader);
  }

  public callLoadPackageSynchronously<T>(
    name: string,
    ctx: string,
    loader?: () => T,
  ) {
    return this.loadPackageSynchronously(name, ctx, loader);
  }

  public callWarnIfEventHandlerReplies(handler: any, pattern: string) {
    this.warnIfEventHandlerReplies(handler, pattern);
  }

  public get serializerRef() {
    return this.serializer;
  }

  public get deserializerRef() {
    return this.deserializer;
  }
}

describe('Server', () => {
  let server: TestServer;
  let untypedServer: any;
  const flush = () => new Promise<void>(resolve => setImmediate(resolve));

  beforeEach(() => {
    server = new TestServer();
    untypedServer = server as any;
    untypedServer.messageHandlers = new Map();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // D0: none (ReplaySubject + distinctUntilChanged is library behaviour)
  describe('status', () => {
    it('should emit the last status to a late subscriber', () => {
      untypedServer._status$.next('connected');

      const statuses: string[] = [];
      const subscription = server.status.subscribe(status =>
        statuses.push(status),
      );
      subscription.unsubscribe();

      expect(statuses).toEqual(['connected']);
    });

    it('should suppress consecutive duplicate statuses but emit a change', () => {
      const statuses: string[] = [];
      const subscription = server.status.subscribe(status =>
        statuses.push(status),
      );

      untypedServer._status$.next('connected');
      untypedServer._status$.next('connected');
      untypedServer._status$.next('disconnected');
      untypedServer._status$.next('disconnected');
      subscription.unsubscribe();

      expect(statuses).toEqual(['connected', 'disconnected']);
    });
  });

  // D0: assignment only
  describe('setTransportId', () => {
    it.each([
      ['symbol', Symbol('id')],
      ['transport', 0],
    ])('should assign the %s transport id', (_label, transportId) => {
      server.setTransportId(transportId as any);
      expect(server.transportId).toBe(transportId);
    });
  });

  describe('setOnProcessingStartHook', () => {
    // D0: assignment only
    it('should replace the start hook', () => {
      const hook = vi.fn();
      server.setOnProcessingStartHook(hook);
      expect(untypedServer.onProcessingStartHook).toBe(hook);
    });
  });

  describe('setOnProcessingEndHook', () => {
    // D0: assignment only
    it('should replace the end hook', () => {
      const hook = vi.fn();
      server.setOnProcessingEndHook(hook);
      expect(untypedServer.onProcessingEndHook).toBe(hook);
    });
  });

  // D1: messageHandlers.has(normalized) && isEventHandler
  // D2: getTail: handler?.next truthy vs falsy (recursion)
  describe('addHandler', () => {
    it('should store a new message handler with its flags and extras', () => {
      const handler: any = vi.fn();
      server.addHandler({ cmd: 'a' }, handler, false, { queue: 'q' });

      expect(untypedServer.messageHandlers.get('{"cmd":"a"}')).toBe(handler);
      expect(handler.isEventHandler).toBe(false);
      expect(handler.extras).toEqual({ queue: 'q' });
    });

    it('should overwrite an existing pattern when the new handler is not an event handler', () => {
      const first: any = vi.fn();
      const second: any = vi.fn();
      server.addHandler('p', first);
      server.addHandler('p', second);

      expect(untypedServer.messageHandlers.get('p')).toBe(second);
      expect(first.next).toBeUndefined();
    });

    it('should append event handlers to the tail of a three-handler chain', () => {
      const first: any = vi.fn();
      const second: any = vi.fn();
      const third: any = vi.fn();
      server.addHandler('p', first, true);
      server.addHandler('p', second, true);
      server.addHandler('p', third, true);

      expect(untypedServer.messageHandlers.get('p')).toBe(first);
      expect(first.next).toBe(second);
      expect(second.next).toBe(third);
      expect(third.next).toBeUndefined();
    });

    it('should append to a non-event head when the new handler is an event handler', () => {
      const head: any = vi.fn();
      const eventHandler: any = vi.fn();
      server.addHandler('p', head, false);
      server.addHandler('p', eventHandler, true);

      expect(head.next).toBe(eventHandler);
    });
  });

  describe('getHandlers', () => {
    // D0: returns the map
    it('should return the handler map', () => {
      const handler: any = vi.fn();
      server.addHandler('p', handler);
      expect(server.getHandlers()).toBe(untypedServer.messageHandlers);
    });
  });

  // D1: messageHandlers.has(pattern)
  // D2: messageHandlers.has(route) ? get : null
  describe('getHandlerByPattern', () => {
    it('should return the handler stored under the exact pattern', () => {
      const handler: any = vi.fn();
      untypedServer.messageHandlers.set('1.0', handler);
      expect(server.getHandlerByPattern('1.0')).toBe(handler);
    });

    it('should find an object handler through its JSON text', () => {
      const handler: any = vi.fn();
      server.addHandler({ b: 2, a: 1 }, handler);
      expect(server.getHandlerByPattern('{"a":1,"b":2}')).toBe(handler);
    });

    it('should return null when neither the pattern nor its route is registered', () => {
      expect(server.getHandlerByPattern('missing')).toBeNull();
    });
  });

  // D1: data.isDisposed && dataQueue.length > nextIndex
  // D2: !isProcessing
  // D3: packet.isDisposed && !isFallbackQueued
  // D4: while nextIndex < dataQueue.length (loop entry and exit)
  // Infeasible: a non-disposed packet failing after isFallbackQueued is true -
  // the fallback is only queued for the final disposed packet, so no reply can
  // follow it.
  describe('send', () => {
    it('should publish every response and mark the final packet disposed', async () => {
      const respond = vi.fn();
      server.send(of('first', 'second'), respond);
      await flush();

      expect(respond.mock.calls).toEqual([
        [{ response: 'first' }],
        [{ response: 'second', isDisposed: true }],
      ]);
    });

    it('should publish a stream error as a disposed packet', async () => {
      const respond = vi.fn();
      server.send(
        throwError(() => 'boom'),
        respond,
      );
      await flush();

      expect(respond).toHaveBeenCalledWith({ err: 'boom', isDisposed: true });
    });

    it('should merge a completion into the last queued packet', async () => {
      const respond = vi.fn();
      const subject = new Subject<string>();
      server.send(subject, respond);
      subject.next('first');
      subject.next('second');
      subject.complete();
      await flush();

      expect(respond.mock.calls).toEqual([
        [{ response: 'first' }],
        [{ response: 'second', isDisposed: true }],
      ]);
    });

    it('should queue the completion on its own when the queue is empty', async () => {
      const respond = vi.fn();
      const subject = new Subject<string>();
      server.send(subject, respond);
      subject.next('only');
      await flush();
      subject.complete();
      await flush();

      expect(respond.mock.calls).toEqual([
        [{ response: 'only' }],
        [{ isDisposed: true }],
      ]);
    });

    it('should keep processing queued packets when a non-disposed reply rejects', async () => {
      const error = new Error('publish failed');
      const errorSpy = vi
        .spyOn(untypedServer.logger, 'error')
        .mockImplementation(() => {});
      const respond = vi
        .fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValue(undefined);

      server.send(of('first', 'second'), respond);
      await flush();

      expect(errorSpy).toHaveBeenCalledExactlyOnceWith(error);
      expect(respond.mock.calls).toEqual([
        [{ response: 'first' }],
        [{ response: 'second', isDisposed: true }],
      ]);
    });

    it('should queue one fallback error when a disposed reply rejects', async () => {
      const errorSpy = vi
        .spyOn(untypedServer.logger, 'error')
        .mockImplementation(() => {});
      const respond = vi
        .fn()
        .mockRejectedValueOnce(new Error('publish failed'))
        .mockResolvedValue(undefined);

      server.send(of('value'), respond);
      await flush();

      expect(errorSpy).toHaveBeenCalledOnce();
      expect(respond.mock.calls).toEqual([
        [{ response: 'value', isDisposed: true }],
        [
          {
            err: { status: 'error', message: 'Internal server error' },
            isDisposed: true,
          },
        ],
      ]);
    });

    it('should not queue a second fallback when every reply rejects', async () => {
      const errorSpy = vi
        .spyOn(untypedServer.logger, 'error')
        .mockImplementation(() => {});
      const respond = vi.fn().mockRejectedValue(new Error('publish failed'));

      server.send(of('value'), respond);
      await flush();

      expect(errorSpy).toHaveBeenCalledTimes(2);
      expect(respond).toHaveBeenCalledTimes(2);
      expect(respond).toHaveBeenLastCalledWith({
        err: { status: 'error', message: 'Internal server error' },
        isDisposed: true,
      });
    });
  });

  // D1: !handler
  // D2: isObservable(resultOrStream)
  describe('handleEvent', () => {
    const context = new BaseRpcContext([]);

    function register(resultOrThrow: () => unknown, endHook = vi.fn()) {
      untypedServer.onProcessingEndHook = endHook;
      untypedServer.messageHandlers.set('event', async () => resultOrThrow());
      return endHook;
    }

    it('should log an error and not run hooks when no handler exists', async () => {
      const errorSpy = vi
        .spyOn(untypedServer.logger, 'error')
        .mockImplementation(() => {});
      const startHook = vi.fn();
      untypedServer.onProcessingStartHook = startHook;

      await server.handleEvent(
        'unknown',
        { pattern: 'unknown', data: null },
        context,
      );

      expect(errorSpy).toHaveBeenCalledOnce();
      expect(startHook).not.toHaveBeenCalled();
    });

    it('should run the end hook once for a plain value', async () => {
      const endHook = register(() => 'plain');

      await server.handleEvent(
        'event',
        { pattern: 'event', data: null },
        context,
      );

      expect(endHook).toHaveBeenCalledOnce();
    });

    it('should run the end hook once when the returned observable completes', async () => {
      const endHook = register(() => of('a', 'b'));

      await server.handleEvent(
        'event',
        { pattern: 'event', data: null },
        context,
      );

      expect(endHook).toHaveBeenCalledOnce();
    });

    it('should run the end hook once when the returned observable errors', async () => {
      const endHook = register(() =>
        throwError(() => new Error('stream failed')),
      );

      await server.handleEvent(
        'event',
        { pattern: 'event', data: null },
        context,
      );

      expect(endHook).toHaveBeenCalledOnce();
    });

    it('should run the end hook once and rethrow when the handler rejects', async () => {
      const endHook = register(() => {
        throw new Error('handler failed');
      });

      await expect(
        server.handleEvent('event', { pattern: 'event', data: null }, context),
      ).rejects.toThrow('handler failed');
      expect(endHook).toHaveBeenCalledOnce();
    });

    it('should pass the packet data and context to the handler', async () => {
      const handler = vi.fn(async () => null);
      untypedServer.messageHandlers.set('event', handler);

      await server.handleEvent(
        'event',
        { pattern: 'event', data: 'payload' },
        context,
      );

      expect(handler).toHaveBeenCalledWith('payload', context);
    });
  });

  // D1: produce resolves vs rejects (try/catch)
  // D2: shouldAnswerRejectedRequest(err)
  describe('handleRequest', () => {
    const context = new BaseRpcContext([]);

    beforeEach(() => {
      untypedServer.onProcessingEndHook = vi.fn();
    });

    it('should reply with every value of the resolved response stream', async () => {
      const respond = vi.fn();
      const endHook = vi.fn();
      untypedServer.onProcessingEndHook = endHook;

      await untypedServer.handleRequest(
        context,
        async () => of('a', 'b'),
        respond,
      );
      await flush();

      expect(respond.mock.calls).toEqual([
        [{ response: 'a' }],
        [{ response: 'b', isDisposed: true }],
      ]);
      expect(endHook).toHaveBeenCalledExactlyOnceWith(
        server.transportId,
        context,
      );
    });

    it('should answer a rejection and pass it on when the request should be answered', async () => {
      const respond = vi.fn();
      const endHook = vi.fn();
      untypedServer.onProcessingEndHook = endHook;

      await expect(
        server.callHandleRequest(
          context,
          async () => {
            throw new Error('handler failed');
          },
          respond,
        ),
      ).rejects.toThrow('handler failed');
      await flush();

      expect(respond).toHaveBeenCalledExactlyOnceWith({
        err: { status: 'error', message: 'Internal server error' },
        isDisposed: true,
      });
      expect(endHook).toHaveBeenCalledOnce();
    });

    it('should not answer a rejection when the request should not be answered', async () => {
      const respond = vi.fn();
      server.answerRejectedRequest = false;

      await expect(
        server.callHandleRequest(
          context,
          async () => {
            throw new Error('handler failed');
          },
          respond,
        ),
      ).rejects.toThrow('handler failed');
      await flush();

      expect(respond).not.toHaveBeenCalled();
    });
  });

  // D0: always true in the base class
  describe('shouldAnswerRejectedRequest', () => {
    it('should answer rejected requests by default', () => {
      const base = new TestServer();
      expect((base as any).shouldAnswerRejectedRequest(new Error('x'))).toBe(
        true,
      );
    });
  });

  // D1: !handler.isEventHandler
  // D2: eventHandlersThatReplied.has(handler)
  describe('warnIfEventHandlerReplies', () => {
    it('should not warn for a message handler', () => {
      const warnSpy = vi
        .spyOn(untypedServer.logger, 'warn')
        .mockImplementation(() => {});
      server.callWarnIfEventHandlerReplies(
        Object.assign(async () => null, { isEventHandler: false }),
        'p',
      );
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('should warn only once per event handler', () => {
      const warnSpy = vi
        .spyOn(untypedServer.logger, 'warn')
        .mockImplementation(() => {});
      const handler = Object.assign(async () => null, { isEventHandler: true });

      server.callWarnIfEventHandlerReplies(handler, 'user.created');
      server.callWarnIfEventHandlerReplies(handler, 'user.created');

      expect(warnSpy).toHaveBeenCalledOnce();
      expect(warnSpy.mock.calls[0][0]).toContain('Pattern: user.created');
    });
  });

  // D1: fn resolves vs rejects (catch block)
  describe('runWithProcessingHooks', () => {
    const context = new BaseRpcContext(['start']);

    it('should run fn between the start hook and the runner', async () => {
      const order: string[] = [];
      const endHook = vi.fn();
      server.setOnProcessingStartHook((_id, _ctx, done) => {
        order.push('start');
        return done();
      });
      server.setOnProcessingEndHook(endHook);

      await server.callRunWithProcessingHooks(context, async runEndHook => {
        order.push('fn');
        runEndHook();
      });

      expect(order).toEqual(['start', 'fn']);
      expect(endHook).toHaveBeenCalledExactlyOnceWith(
        server.transportId,
        context,
      );
    });

    it('should run the end hook once and rethrow when fn rejects', async () => {
      const endHook = vi.fn();
      untypedServer.onProcessingEndHook = endHook;

      await expect(
        server.callRunWithProcessingHooks(context, async () => {
          throw new Error('fn failed');
        }),
      ).rejects.toThrow('fn failed');

      expect(endHook).toHaveBeenCalledOnce();
    });

    it('should pass a separate end hook context to the end hook', async () => {
      const endHook = vi.fn();
      untypedServer.onProcessingEndHook = endHook;
      const endHookContext = new BaseRpcContext(['end']);

      await server.callRunWithProcessingHooks(
        context,
        async runEndHook => runEndHook(),
        endHookContext,
      );

      expect(endHook).toHaveBeenCalledWith(server.transportId, endHookContext);
    });
  });

  // D1: isEndHookCalled
  // D2: onProcessingEndHook optional call
  describe('createProcessingEndHookRunner', () => {
    it('should run the end hook exactly once even when called twice', () => {
      const endHook = vi.fn();
      untypedServer.onProcessingEndHook = endHook;
      const context = new BaseRpcContext([]);

      const runEndHook = server.callCreateProcessingEndHookRunner(context);
      runEndHook();
      runEndHook();

      expect(endHook).toHaveBeenCalledOnce();
    });

    it('should tolerate a missing end hook', () => {
      untypedServer.onProcessingEndHook = undefined;
      const runEndHook = server.callCreateProcessingEndHookRunner(
        new BaseRpcContext([]),
      );

      expect(() => runEndHook()).not.toThrow();
    });
  });

  // D1: resultOrDeferred instanceof Promise
  // D2: resolved promise value is an Observable
  // D3: resultOrDeferred is an Observable
  describe('transformToObservable', () => {
    it('should unwrap a promise that resolves to an observable', async () => {
      const value = await lastValueFrom(
        server.transformToObservable(Promise.resolve(of(42))),
      );
      expect(value).toBe(42);
    });

    it('should emit the value of a promise that resolves to a plain value', async () => {
      await expect(
        lastValueFrom(server.transformToObservable(Promise.resolve(7))),
      ).resolves.toBe(7);
    });

    it('should return an observable unchanged', () => {
      const source = of(1);
      expect(server.transformToObservable(source)).toBe(source);
    });

    it('should wrap a plain value into an observable', async () => {
      await expect(
        lastValueFrom(server.transformToObservable([1, 2])),
      ).resolves.toEqual([1, 2]);
    });
  });

  // D1: obj truthy
  // D2: prop in obj
  describe('getOptionsProp', () => {
    it.each([
      ['present without default', { a: 1 }, 'a', undefined, 1],
      ['present but undefined', { a: undefined }, 'a', 5, undefined],
      ['missing with default', { b: 2 }, 'a', 5, 5],
      ['missing without default', {}, 'a', undefined, undefined],
      ['obj undefined with default', undefined, 'a', 9, 9],
    ])(
      'should return the expected value for %s',
      (_label, obj, prop, defaultValue, expected) => {
        expect((server.getOptionsProp as any)(obj, prop, defaultValue)).toBe(
          expected,
        );
      },
    );
  });

  describe('handleError', () => {
    // D0: logging only
    it('should log the error through the logger', () => {
      const errorSpy = vi
        .spyOn(untypedServer.logger, 'error')
        .mockImplementation(() => {});
      server.callHandleError('broken');
      expect(errorSpy).toHaveBeenCalledWith('broken');
    });
  });

  describe('loadPackage', () => {
    // D1: loader provided vs default import
    it('should use the provided loader', async () => {
      const loaded = { marker: true };
      await expect(
        server.callLoadPackage('ai-test-async-loader', 'ctx', () => loaded),
      ).resolves.toBe(loaded);
    });

    it('should import the package when no loader is provided', async () => {
      const loaded = await server.callLoadPackage<any>('node:path', 'ctx');
      expect(typeof loaded.join).toBe('function');
    });
  });

  describe('loadPackageSynchronously', () => {
    // D1: loader provided vs createRequire
    it('should use the provided loader', () => {
      const loaded = { marker: true };
      expect(
        server.callLoadPackageSynchronously(
          'ai-test-sync-loader',
          'ctx',
          () => loaded,
        ),
      ).toBe(loaded);
    });

    it('should require the package when no loader is provided', () => {
      const loaded = server.callLoadPackageSynchronously<any>('node:fs', 'ctx');
      expect(typeof loaded.existsSync).toBe('function');
    });
  });

  // D1: options truthy
  // D2: options.serializer truthy
  describe('initializeSerializer', () => {
    it('should keep a custom serializer', () => {
      const serializer = { serialize: vi.fn() };
      server.callInitializeSerializer({ serializer });
      expect(server.serializerRef).toBe(serializer);
    });

    it('should fall back to IdentitySerializer when no serializer is configured', () => {
      server.callInitializeSerializer({});
      expect(server.serializerRef).toBeInstanceOf(IdentitySerializer);
    });

    it('should fall back to IdentitySerializer when options are missing', () => {
      server.callInitializeSerializer(undefined);
      expect(server.serializerRef).toBeInstanceOf(IdentitySerializer);
    });
  });

  // D1: options truthy
  // D2: options.deserializer truthy
  describe('initializeDeserializer', () => {
    it('should keep a custom deserializer', () => {
      const deserializer = { deserialize: vi.fn() };
      server.callInitializeDeserializer({ deserializer });
      expect(server.deserializerRef).toBe(deserializer);
    });

    it('should fall back to IncomingRequestDeserializer when none is configured', () => {
      server.callInitializeDeserializer({});
      expect(server.deserializerRef).toBeInstanceOf(
        IncomingRequestDeserializer,
      );
    });

    it('should fall back to IncomingRequestDeserializer when options are missing', () => {
      server.callInitializeDeserializer(undefined);
      expect(server.deserializerRef).toBeInstanceOf(
        IncomingRequestDeserializer,
      );
    });
  });

  // D1: JSON_TEXT.test(pattern) -> JSON.parse success or throw
  describe('getRouteFromPattern', () => {
    it.each([
      ['plain string', 'user.created', 'user.created'],
      [
        'json object',
        '{"controller":"app","use":"getHello"}',
        '{"controller":"app","use":"getHello"}',
      ],
      ['json number', '42', '42'],
      // transformPatternToRoute returns non-string primitives as they are
      ['json boolean', 'true', true],
      ['invalid json object', '{"cmd":', '{"cmd":'],
      ['invalid json string', '"hello', '"hello'],
    ])('should normalize a %s pattern', (_label, pattern, expected) => {
      expect(server.callGetRouteFromPattern(pattern)).toBe(expected);
    });
  });

  // D0: delegates to transformPatternToRoute
  describe('normalizePattern', () => {
    it.each([
      ['string', 'x', 'x'],
      ['number', 5, '5'],
      ['object', { b: 2, a: 1 }, '{"a":1,"b":2}'],
    ])('should normalize a %s pattern', (_label, pattern, expected) => {
      expect(server.callNormalizePattern(pattern)).toBe(expected);
    });
  });

  // D1: isString(pattern)
  // D2: JSON.stringify succeeds vs throws
  describe('getPatternAsString', () => {
    it('should return a string pattern unchanged', () => {
      expect(server.callGetPatternAsString('user.created')).toBe(
        'user.created',
      );
    });

    it('should serialize an object pattern', () => {
      expect(server.callGetPatternAsString({ a: 1 })).toBe('{"a":1}');
    });

    it('should return UNSERIALIZABLE_PATTERN for a circular object', () => {
      const circular: any = {};
      circular.self = circular;
      expect(server.callGetPatternAsString(circular)).toBe(
        UNSERIALIZABLE_PATTERN,
      );
    });
  });

  // D1: isNumber(id)
  // D2: isString(id)
  // D3: id.length <= 256
  describe('assertValidPacketId', () => {
    it.each([
      ['number', 1],
      ['string at the boundary', 'a'.repeat(256)],
    ])('should accept a %s id', (_label, id) => {
      expect(() => server.callAssertValidPacketId(id)).not.toThrow();
    });

    it.each([
      ['string over the boundary', 'a'.repeat(257)],
      ['object', { id: 1 }],
      ['null', null],
      ['boolean', true],
    ])('should reject a %s id', (_label, id) => {
      expect(() => server.callAssertValidPacketId(id)).toThrow(
        InvalidPacketIdException,
      );
    });
  });
});
