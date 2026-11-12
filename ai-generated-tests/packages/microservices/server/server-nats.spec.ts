import { of } from 'rxjs';
import { NO_MESSAGE_HANDLER } from '../../../../packages/microservices/constants.js';
import { NatsContext } from '../../../../packages/microservices/ctx-host/nats.context.js';
import { NatsRequestJSONDeserializer } from '../../../../packages/microservices/deserializers/nats-request-json.deserializer.js';
import { InvalidPacketIdException } from '../../../../packages/microservices/errors/invalid-packet-id.exception.js';
import { NatsRecordBuilder } from '../../../../packages/microservices/record-builders/index.js';
import { NatsRecordSerializer } from '../../../../packages/microservices/serializers/nats-record.serializer.js';
import { ServerNats } from '../../../../packages/microservices/server/server-nats.js';

type NatsMsg = any;

const createStatusClient = (statuses: any[]) => ({
  status: () => ({
    async *[Symbol.asyncIterator]() {
      for (const status of statuses) {
        yield status;
      }
    },
  }),
  close: vi.fn().mockResolvedValue(undefined),
});

const createNatsMsg = (
  payload: any,
  overrides: Record<string, any> = {},
): NatsMsg => {
  const data = JSON.stringify(payload);
  return {
    data,
    subject: payload?.pattern ?? 'test',
    reply: 'inbox',
    sid: 1,
    respond: vi.fn(),
    json: () => JSON.parse(data),
    ...overrides,
  };
};

describe('ServerNats', () => {
  let server: ServerNats;
  let untypedServer: any;
  const flush = () => new Promise<void>(resolve => setImmediate(resolve));

  beforeEach(() => {
    vi.restoreAllMocks();
    server = new ServerNats({});
    untypedServer = server as any;
    untypedServer.messageHandlers = new Map();
  });

  // D1: options.serializer/deserializer present in constructor initialization
  describe('constructor', () => {
    it('should use the default NATS serializer, deserializer and transport id', () => {
      expect(untypedServer.serializer).toBeInstanceOf(NatsRecordSerializer);
      expect(untypedServer.deserializer).toBeInstanceOf(
        NatsRequestJSONDeserializer,
      );
      expect(server.transportId).toBe(2);
    });

    it('should keep custom serializer and deserializer options', () => {
      const serializer = { serialize: vi.fn() };
      const deserializer = { deserialize: vi.fn() };
      const custom = new ServerNats({ serializer, deserializer } as any);

      expect((custom as any).serializer).toBe(serializer);
      expect((custom as any).deserializer).toBe(deserializer);
    });
  });

  // D1: createNatsClient rejects (catch)
  // D2: start throws synchronously (catch)
  // D3: handleStatusUpdates rejects (caught logging)
  describe('listen', () => {
    it('should create the client, report connected and start', async () => {
      const client = createStatusClient([]);
      vi.spyOn(server, 'createNatsClient').mockResolvedValue(client as any);
      const startSpy = vi
        .spyOn(server, 'start')
        .mockImplementation((callback: any) => callback());
      const statuses: string[] = [];
      server.status.subscribe(status => statuses.push(status));
      const callback = vi.fn();

      await server.listen(callback);
      await flush();

      expect(untypedServer.natsClient).toBe(client);
      expect(statuses).toContain('connected');
      expect(startSpy).toHaveBeenCalledWith(callback);
      expect(callback).toHaveBeenCalled();
    });

    it('should pass a client creation error to the callback', async () => {
      const error = new Error('nats unavailable');
      vi.spyOn(server, 'createNatsClient').mockRejectedValue(error);
      const callback = vi.fn();

      await server.listen(callback);

      expect(callback).toHaveBeenCalledExactlyOnceWith(error);
    });

    it('should pass a synchronous start error to the callback', async () => {
      vi.spyOn(server, 'createNatsClient').mockResolvedValue(
        createStatusClient([]) as any,
      );
      const error = new Error('start failed');
      vi.spyOn(server, 'start').mockImplementation(() => {
        throw error;
      });
      const callback = vi.fn();

      await server.listen(callback);

      expect(callback).toHaveBeenCalledExactlyOnceWith(error);
    });

    it('should log a failing status iterator instead of rejecting', async () => {
      const error = new Error('status failed');
      const logErrorSpy = vi
        .spyOn(untypedServer.logger, 'error')
        .mockImplementation(() => {});
      const client = {
        status: () => ({
          [Symbol.asyncIterator]: () => ({ next: () => Promise.reject(error) }),
        }),
      };
      vi.spyOn(server, 'createNatsClient').mockResolvedValue(client as any);
      vi.spyOn(server, 'start').mockImplementation(() => {});

      await server.listen(() => {});
      await vi.waitFor(() => expect(logErrorSpy).toHaveBeenCalledWith(error));
    });
  });

  describe('start', () => {
    // D0: bind events, then call back
    it('should bind events and call the callback', () => {
      const client = createStatusClient([]);
      untypedServer.natsClient = client;
      const bindSpy = vi.spyOn(server, 'bindEvents');
      const callback = vi.fn();

      server.start(callback);

      expect(bindSpy).toHaveBeenCalledWith(client);
      expect(callback).toHaveBeenCalledOnce();
    });
  });

  // D1: handler.extras?.queue ?? defaultQueue (own queue, extras, default)
  describe('bindEvents', () => {
    it('should subscribe to every pattern and record the subscription', () => {
      const client = { subscribe: vi.fn() };
      const handler: any = vi.fn();
      server.addHandler('orders.get', handler);

      server.bindEvents(client);

      expect(client.subscribe).toHaveBeenCalledWith('orders.get', {
        queue: undefined,
        callback: expect.any(Function),
      });
      expect(untypedServer.subscriptions).toHaveLength(1);
    });

    it('should fall back to the default queue', () => {
      untypedServer.options = { queue: 'default-queue' };
      const client = { subscribe: vi.fn() };
      server.addHandler('orders.get', vi.fn(), false, {});

      server.bindEvents(client);

      expect(client.subscribe.mock.calls[0][1].queue).toBe('default-queue');
    });

    it('should prefer a per-pattern queue', () => {
      untypedServer.options = { queue: 'default-queue' };
      const client = { subscribe: vi.fn() };
      server.addHandler('orders.get', vi.fn(), false, { queue: 'own-queue' });

      server.bindEvents(client);

      expect(client.subscribe.mock.calls[0][1].queue).toBe('own-queue');
    });

    it('should do nothing when no handler is registered', () => {
      const client = { subscribe: vi.fn() };

      server.bindEvents(client);

      expect(client.subscribe).not.toHaveBeenCalled();
      expect(untypedServer.subscriptions).toEqual([]);
    });
  });

  // D1: gracePeriod present vs default
  describe('waitForGracePeriod', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.clearAllTimers();
      vi.useRealTimers();
    });

    it('should use the default grace period', async () => {
      let resolved = false;
      const promise = untypedServer
        .waitForGracePeriod()
        .then(() => (resolved = true));

      await vi.advanceTimersByTimeAsync(9_999);
      expect(resolved).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      await promise;

      expect(resolved).toBe(true);
    });

    it('should use the configured grace period', async () => {
      untypedServer.options = { gracePeriod: 5 };
      let resolved = false;
      const promise = untypedServer
        .waitForGracePeriod()
        .then(() => (resolved = true));

      await vi.advanceTimersByTimeAsync(4);
      expect(resolved).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      await promise;

      expect(resolved).toBe(true);
    });
  });

  // D1: natsClient falsy
  // D2: gracefulShutdown truthy
  describe('close', () => {
    it('should resolve when the client was never created', async () => {
      await expect(server.close()).resolves.toBeUndefined();
      expect(untypedServer.natsClient).toBeFalsy();
    });

    it('should close the client and remove status listeners without graceful shutdown', async () => {
      const client = createStatusClient([]);
      untypedServer.natsClient = client;
      const listener = vi.fn();
      server.on('disconnect', listener);

      await server.close();

      expect(client.close).toHaveBeenCalledOnce();
      expect(untypedServer.natsClient).toBeNull();
      expect(untypedServer.statusEventEmitter.listenerCount('disconnect')).toBe(
        0,
      );
    });

    it('should unsubscribe and wait for the grace period on graceful shutdown', async () => {
      const client = createStatusClient([]);
      untypedServer.natsClient = client;
      untypedServer.options = { gracefulShutdown: true };
      const subscriptions = [
        { unsubscribe: vi.fn() },
        { unsubscribe: vi.fn() },
      ];
      untypedServer.subscriptions = subscriptions;
      const waitSpy = vi
        .spyOn(untypedServer, 'waitForGracePeriod')
        .mockResolvedValue(undefined);

      await server.close();

      expect(subscriptions[0].unsubscribe).toHaveBeenCalledOnce();
      expect(subscriptions[1].unsubscribe).toHaveBeenCalledOnce();
      expect(waitSpy).toHaveBeenCalledOnce();
      expect(client.close).toHaveBeenCalledOnce();
    });
  });

  // D1: this.options truthy when building the connect options
  describe('createNatsClient', () => {
    it('should connect with the default server and the given options', async () => {
      const connect = vi.fn().mockResolvedValue({ connected: true });
      vi.spyOn(untypedServer, 'loadPackage').mockResolvedValue({ connect });
      untypedServer.options = { queue: 'q' };

      const client = await server.createNatsClient();

      expect(client).toEqual({ connected: true });
      expect(connect).toHaveBeenCalledWith({
        servers: 'nats://localhost:4222',
        queue: 'q',
      });
    });

    it('should let the options override the default server', async () => {
      const connect = vi.fn().mockResolvedValue({});
      vi.spyOn(untypedServer, 'loadPackage').mockResolvedValue({ connect });
      untypedServer.options = { servers: ['nats://example.test:4222'] };

      await server.createNatsClient();

      expect(connect.mock.calls[0][0].servers).toEqual([
        'nats://example.test:4222',
      ]);
    });

    it('should fall back to an empty options object', async () => {
      const connect = vi.fn().mockResolvedValue({});
      vi.spyOn(untypedServer, 'loadPackage').mockResolvedValue({ connect });
      untypedServer.options = undefined;

      await server.createNatsClient();

      expect(connect).toHaveBeenCalledExactlyOnceWith({
        servers: 'nats://localhost:4222',
      });
    });
  });

  // D1: error argument truthy
  // D2: handleMessage rejection is caught
  describe('getMessageHandler', () => {
    it('should log the subscription error and skip handleMessage', async () => {
      const errorSpy = vi
        .spyOn(untypedServer.logger, 'error')
        .mockImplementation(() => {});
      const handleMessageSpy = vi.spyOn(server, 'handleMessage');
      const handler: any = server.getMessageHandler('test');
      const error = { message: 'subscription error' };

      await handler(error, createNatsMsg({}));

      expect(errorSpy).toHaveBeenCalledWith(error);
      expect(handleMessageSpy).not.toHaveBeenCalled();
    });

    it('should handle the message when there is no error', async () => {
      const message = createNatsMsg({ pattern: 'test', data: 'x' });
      const handleMessageSpy = vi
        .spyOn(server, 'handleMessage')
        .mockResolvedValue(undefined);
      const handler: any = server.getMessageHandler('test');

      await handler(undefined, message);

      expect(handleMessageSpy).toHaveBeenCalledWith('test', message);
    });

    it('should route handleMessage rejections to handleError', async () => {
      const error = new Error('unexpected');
      vi.spyOn(server, 'handleMessage').mockRejectedValue(error);
      const handleErrorSpy = vi
        .spyOn(untypedServer, 'handleError')
        .mockImplementation(() => {});
      const handler: any = server.getMessageHandler('test');

      await handler(undefined, createNatsMsg({}));

      expect(handleErrorSpy).toHaveBeenCalledWith(error);
    });
  });

  // D1: packet.id undefined
  // D2: handler lookup miss
  // D3: handler.isEventHandler && isAnsweredByMessageHandler
  // D4: channel !== callerSubject && isAnsweredByOwnMessageHandler
  describe('handleMessage', () => {
    let publishSpy: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      publishSpy = vi.fn();
      vi.spyOn(server, 'getPublisher').mockReturnValue(publishSpy as any);
    });

    it('should dispatch a packet without an id as an event', async () => {
      const handleEventSpy = vi
        .spyOn(server, 'handleEvent')
        .mockResolvedValue(undefined);
      const message = createNatsMsg({ pattern: 'test', data: 'x' });

      await server.handleMessage('test', message);

      expect(handleEventSpy).toHaveBeenCalledWith(
        'test',
        { pattern: 'test', data: 'x' },
        expect.any(NatsContext),
      );
    });

    it('should publish NO_MESSAGE_HANDLER when no handler matches', async () => {
      await server.handleMessage(
        'test',
        createNatsMsg({ id: '3', pattern: 'test' }),
      );

      expect(publishSpy).toHaveBeenCalledWith({
        id: '3',
        status: 'error',
        err: NO_MESSAGE_HANDLER,
      });
    });

    it('should reply with a plain handler value', async () => {
      server.addHandler('test', async () => 'answer');

      await server.handleMessage(
        'test',
        createNatsMsg({ id: '3', pattern: 'test', data: 'x' }),
      );
      await flush();

      expect(publishSpy).toHaveBeenCalledExactlyOnceWith({
        response: 'answer',
        isDisposed: true,
      });
    });

    it('should reply with every value of an observable result', async () => {
      server.addHandler('test', async () => of('first', 'second'));

      await server.handleMessage(
        'test',
        createNatsMsg({ id: 1, pattern: 'test', data: 'x' }),
      );
      await flush();

      expect(publishSpy.mock.calls).toEqual([
        [{ response: 'first' }],
        [{ response: 'second', isDisposed: true }],
      ]);
    });

    it('should reject an invalid packet id', async () => {
      const handler = vi.fn();
      server.addHandler('test', handler);

      const error = await server
        .handleMessage(
          'test',
          createNatsMsg({ id: 'a'.repeat(257), pattern: 'test' }),
        )
        .catch(err => err);

      expect(error).toBeInstanceOf(InvalidPacketIdException);
      expect(handler).not.toHaveBeenCalled();
    });

    it('should reply with an error packet when the handler rejects', async () => {
      server.addHandler('test', async () => {
        throw new Error('handler failed');
      });

      await expect(
        server.handleMessage(
          'test',
          createNatsMsg({ id: 2, pattern: 'test', data: 'x' }),
        ),
      ).rejects.toThrow('handler failed');
      await flush();

      expect(publishSpy).toHaveBeenCalledExactlyOnceWith({
        err: { status: 'error', message: 'Internal server error' },
        isDisposed: true,
      });
    });

    it('should let an event handler answer when a message handler shares its subject', async () => {
      const eventHandler = Object.assign(
        vi.fn(async () => 'event'),
        { isEventHandler: true },
      );
      const messageHandler = vi.fn(async () => 'message');
      server.addHandler('orders.*', eventHandler, true);
      server.addHandler('orders.get', messageHandler);
      const handleEventSpy = vi
        .spyOn(server, 'handleEvent')
        .mockResolvedValue(undefined);

      await server.handleMessage(
        'orders.*',
        createNatsMsg({ id: 3, pattern: 'orders.get', data: 'x' }),
      );

      expect(handleEventSpy).toHaveBeenCalledOnce();
      expect(publishSpy).not.toHaveBeenCalled();
    });

    it('should let the message handler of the subject answer the request alone', async () => {
      const wildcardHandler = vi.fn(async () => 'wildcard');
      const messageHandler = vi.fn(async () => 'message');
      server.addHandler('orders.*', wildcardHandler);
      server.addHandler('orders.get', messageHandler);

      await server.handleMessage(
        'orders.*',
        createNatsMsg({ id: 4, pattern: 'orders.get', data: 'x' }),
      );
      await flush();

      expect(wildcardHandler).not.toHaveBeenCalled();
      expect(publishSpy).not.toHaveBeenCalled();
    });

    it('should still reply with an event handler that shares a queue group', async () => {
      untypedServer.options = { queue: 'orders' };
      server.addHandler(
        'orders.*',
        Object.assign(
          vi.fn(async () => 'event'),
          { isEventHandler: true },
        ),
        true,
        { queue: 'orders' },
      );
      server.addHandler(
        'orders.get',
        vi.fn(async () => 'message'),
        false,
        { queue: 'orders' },
      );
      const warnSpy = vi
        .spyOn(untypedServer.logger, 'warn')
        .mockImplementation(() => {});

      await server.handleMessage(
        'orders.*',
        createNatsMsg({ id: 5, pattern: 'orders.list', data: 'x' }),
      );
      await flush();

      expect(warnSpy).toHaveBeenCalledOnce();
      expect(publishSpy).toHaveBeenCalledWith({
        response: 'event',
        isDisposed: true,
      });
    });

    it('should expose the subject, headers and metadata on the NatsContext', async () => {
      const handler = vi.fn(async () => null);
      server.addHandler('test', handler);
      const headers = {
        keys: () => ['traceId'],
        values: () => ['trace-1'],
      };

      await server.handleMessage(
        'test',
        createNatsMsg({ id: 6, pattern: 'test', data: 'x' }, { headers }),
      );
      await flush();

      const context: NatsContext = handler.mock.calls[0][1];
      expect(context.getSubject()).toBe('test');
      expect(context.getHeaders()).toBe(headers);
      expect(context.getMetadata()).toEqual({ traceId: 'trace-1' });
    });
  });

  // D1: eventQueue undefined
  // D2: some(): handler.isEventHandler
  // D3: some(): queue comparison
  // D4: matchNatsSubject
  describe('isAnsweredByMessageHandler', () => {
    const eventHandler = () => Object.assign(vi.fn(), { isEventHandler: true });

    it('should be false when no message handler matches the subject', () => {
      untypedServer.messageHandlers.set('users.*', vi.fn());

      expect(
        untypedServer.isAnsweredByMessageHandler('orders.get', eventHandler()),
      ).toBe(false);
    });

    it('should be false when only event handlers match', () => {
      untypedServer.messageHandlers.set('orders.*', eventHandler());

      expect(
        untypedServer.isAnsweredByMessageHandler('orders.get', eventHandler()),
      ).toBe(false);
    });

    it('should be false when both handlers share the same queue group', () => {
      untypedServer.options = { queue: 'orders' };
      untypedServer.messageHandlers.set('orders.*', vi.fn());

      expect(
        untypedServer.isAnsweredByMessageHandler('orders.get', eventHandler()),
      ).toBe(false);
    });

    it('should be true without a queue group', () => {
      untypedServer.messageHandlers.set('orders.*', vi.fn());

      expect(
        untypedServer.isAnsweredByMessageHandler('orders.get', eventHandler()),
      ).toBe(true);
    });

    it('should be true when the event handler has its own queue group', () => {
      untypedServer.options = { queue: 'orders' };
      untypedServer.messageHandlers.set('orders.*', vi.fn());

      const event = eventHandler();
      event.extras = { queue: 'audit' };

      expect(
        untypedServer.isAnsweredByMessageHandler('orders.get', event),
      ).toBe(true);
    });
  });

  // D1: handler exists for the subject
  // D2: handler.isEventHandler
  // D3: wildcard queue undefined or different
  describe('isAnsweredByOwnMessageHandler', () => {
    it('should be false when the subject has no handler', () => {
      expect(
        untypedServer.isAnsweredByOwnMessageHandler('orders.get', vi.fn()),
      ).toBe(false);
    });

    it('should be false when the subject handler is an event handler', () => {
      untypedServer.messageHandlers.set(
        'orders.get',
        Object.assign(vi.fn(), { isEventHandler: true }),
      );

      expect(
        untypedServer.isAnsweredByOwnMessageHandler('orders.get', vi.fn()),
      ).toBe(false);
    });

    it('should be true when the wildcard handler has no queue group', () => {
      untypedServer.messageHandlers.set('orders.get', vi.fn());

      expect(
        untypedServer.isAnsweredByOwnMessageHandler('orders.get', vi.fn()),
      ).toBe(true);
    });

    it('should be false when both handlers share a queue group', () => {
      untypedServer.options = { queue: 'orders' };
      const wildcard = Object.assign(vi.fn(), { extras: { queue: 'orders' } });
      untypedServer.messageHandlers.set(
        'orders.get',
        Object.assign(vi.fn(), { extras: { queue: 'orders' } }),
      );

      expect(
        untypedServer.isAnsweredByOwnMessageHandler('orders.get', wildcard),
      ).toBe(false);
    });

    it('should be true when the handlers have different queue groups', () => {
      untypedServer.options = { queue: 'orders' };
      const wildcard = Object.assign(vi.fn(), { extras: { queue: 'audit' } });
      untypedServer.messageHandlers.set(
        'orders.get',
        Object.assign(vi.fn(), { extras: { queue: 'orders' } }),
      );

      expect(
        untypedServer.isAnsweredByOwnMessageHandler('orders.get', wildcard),
      ).toBe(true);
    });
  });

  // D1: pattern token ">" early return
  // D2: token "*" or literal equality
  // D3: token count equality
  describe('matchNatsSubject', () => {
    it.each([
      ['orders.get', 'orders.get', true],
      ['orders.get', 'orders.list', false],
      ['orders.*', 'orders.get', true],
      ['*.get', 'orders.get', true],
      ['orders.*', 'orders', false],
      ['orders.*', 'orders.get.one', false],
      ['orders.>', 'orders.get.one', true],
      ['orders.>', 'orders', false],
      ['>', 'orders', true],
    ])('should match "%s" against "%s" as %s', (pattern, subject, expected) => {
      expect(untypedServer.matchNatsSubject(pattern, subject)).toBe(expected);
    });
  });

  // D1: natsMsg.reply truthy
  describe('getPublisher', () => {
    it('should respond with the serialized packet when a reply subject exists', () => {
      const message = createNatsMsg({ pattern: 'test' }, { reply: 'inbox' });
      const publisher: any = server.getPublisher(
        message,
        '3',
        new NatsContext(['test', undefined]),
      );
      const response: any = { response: 'x', isDisposed: true };

      publisher(response);

      expect(response.id).toBe('3');
      expect(message.respond).toHaveBeenCalledWith(
        JSON.stringify({ response: 'x', isDisposed: true, id: '3' }),
        { headers: undefined },
      );
    });

    it('should respond with a record data and headers', () => {
      const message = createNatsMsg({ pattern: 'test' }, { reply: 'inbox' });
      const publisher: any = server.getPublisher(
        message,
        '4',
        new NatsContext(['test', undefined]),
      );
      const headers = { key: 'value' };
      const record = new NatsRecordBuilder({ value: 'x' })
        .setHeaders(headers)
        .build();

      publisher({ response: record, isDisposed: true });

      expect(message.respond).toHaveBeenCalledWith(
        JSON.stringify({ response: { value: 'x' }, isDisposed: true, id: '4' }),
        { headers },
      );
    });

    it('should return a noop when no reply subject exists', () => {
      const message = createNatsMsg({ pattern: 'test' }, { reply: undefined });
      const publisher: any = server.getPublisher(
        message,
        '5',
        new NatsContext(['test', undefined]),
      );

      expect(publisher({ response: 'x' })).toBeUndefined();
      expect(message.respond).not.toHaveBeenCalled();
    });
  });

  // D1: switch status.type cases
  // D2: ping debug flag
  // D3: default status "data" in status and isObject(data)
  // D4: iterator completion with the current client
  describe('handleStatusUpdates', () => {
    let statuses: string[];
    let logSpy: ReturnType<typeof vi.spyOn>;
    let errorSpy: ReturnType<typeof vi.spyOn>;
    let debugSpy: ReturnType<typeof vi.spyOn>;

    const runStatuses = async (statusList: any[], currentClient = true) => {
      const client = createStatusClient(statusList);
      untypedServer.natsClient = currentClient ? client : {};
      await server.handleStatusUpdates(client as any);
      return client;
    };

    beforeEach(() => {
      statuses = [];
      server.status.subscribe(status => statuses.push(status));
      logSpy = vi
        .spyOn(untypedServer.logger, 'log')
        .mockImplementation(() => {});
      errorSpy = vi
        .spyOn(untypedServer.logger, 'error')
        .mockImplementation(() => {});
      debugSpy = vi
        .spyOn(untypedServer.logger, 'debug' as any)
        .mockImplementation(() => {});
    });

    it('should log an error status', async () => {
      await runStatuses([{ type: 'error', error: 'oops' }]);

      expect(errorSpy).toHaveBeenCalledWith(
        'NatsError: type: "error", error: "oops".',
      );
    });

    it('should report disconnect, log it and emit the disconnect event', async () => {
      const listener = vi.fn();
      server.on('disconnect', listener);

      await runStatuses([{ type: 'disconnect', server: 'nats://s1' }]);

      expect(statuses).toContain('disconnected');
      expect(errorSpy).toHaveBeenCalledWith('NatsError: type: "disconnect".');
      expect(listener).toHaveBeenCalledWith('nats://s1');
    });

    it.each([
      [true, true],
      [false, false],
    ])('should debug a ping when debug is %s', async (debug, expected) => {
      untypedServer.options = { debug };

      await runStatuses([{ type: 'ping', pendingPings: 2 }]);

      expect(debugSpy).toHaveBeenCalledTimes(expected ? 1 : 0);
    });

    it('should report reconnecting', async () => {
      await runStatuses([{ type: 'reconnecting' }]);

      expect(statuses).toContain('reconnecting');
    });

    it('should report reconnect and emit the reconnect event', async () => {
      const listener = vi.fn();
      server.on('reconnect', listener);

      await runStatuses([
        { type: 'disconnect', server: 's1' },
        { type: 'reconnect', server: 's2' },
      ]);

      expect(logSpy).toHaveBeenCalledWith('NatsStatus: type: "reconnect".');
      expect(statuses).toContain('connected');
      expect(listener).toHaveBeenCalledWith('s2');
    });

    it('should log an update and emit the update event', async () => {
      const listener = vi.fn();
      server.on('update', listener);

      await runStatuses([{ type: 'update', added: ['a'], deleted: ['b'] }]);

      expect(logSpy).toHaveBeenCalledWith(
        'NatsStatus: type: "update", added: "a", deleted: "b".',
      );
      expect(listener).toHaveBeenCalledWith({ added: ['a'], deleted: ['b'] });
    });

    it.each([
      [
        'object data',
        { type: 'other', data: { a: 1 } },
        'NatsStatus: type: "other", data: "{"a":1}".',
      ],
      [
        'string data',
        { type: 'other', data: 'text' },
        'NatsStatus: type: "other", data: "text".',
      ],
      ['no data', { type: 'other' }, 'NatsStatus: type: "other", data: "".'],
    ])(
      'should log an unknown status with %s',
      async (_label, status, expected) => {
        await runStatuses([status]);

        expect(logSpy).toHaveBeenCalledWith(expected);
      },
    );

    it('should log a throwing listener and keep handling statuses', async () => {
      const error = new Error('listener failed');
      const reconnectListener = vi.fn();
      server.on('disconnect', () => {
        throw error;
      });
      server.on('reconnect', reconnectListener);

      await runStatuses([
        { type: 'disconnect', server: 's1' },
        { type: 'reconnect', server: 's2' },
      ]);

      expect(errorSpy).toHaveBeenCalledWith(error);
      expect(reconnectListener).toHaveBeenCalledWith('s2');
    });

    it('should report disconnected and log when the current client iterator completes', async () => {
      await runStatuses([{ type: 'reconnecting' }]);

      expect(statuses).toContain('disconnected');
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('will not be reopened'),
      );
    });

    it('should not report the completion of a replaced client', async () => {
      await runStatuses([{ type: 'reconnecting' }], false);

      expect(statuses).not.toContain('disconnected');
      expect(errorSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('will not be reopened'),
      );
    });
  });

  // D1: natsClient falsy
  describe('unwrap', () => {
    it('should throw before the client is initialized', () => {
      expect(() => server.unwrap()).toThrow(/Not initialized/);
    });

    it('should return the underlying client', () => {
      const client = createStatusClient([]);
      untypedServer.natsClient = client;

      expect(server.unwrap()).toBe(client);
    });
  });

  describe('on', () => {
    // D0: registers on the status event emitter
    it('should register a status event listener', () => {
      const listener = vi.fn();
      server.on('disconnect', listener);

      untypedServer.statusEventEmitter.emit('disconnect', 's1');

      expect(listener).toHaveBeenCalledWith('s1');
      expect(untypedServer.statusEventEmitter.listenerCount('disconnect')).toBe(
        1,
      );
    });
  });

  // D1: options.serializer present
  describe('initializeSerializer', () => {
    it('should fall back to NatsRecordSerializer', () => {
      const instance = new ServerNats({});
      (instance as any).initializeSerializer(undefined);

      expect((instance as any).serializer).toBeInstanceOf(NatsRecordSerializer);
    });

    it('should keep a custom serializer', () => {
      const serializer = { serialize: vi.fn() };
      const instance = new ServerNats({ serializer } as any);

      expect((instance as any).serializer).toBe(serializer);
    });
  });

  // D1: options.deserializer present
  describe('initializeDeserializer', () => {
    it('should fall back to NatsRequestJSONDeserializer', () => {
      const instance = new ServerNats({});
      (instance as any).initializeDeserializer(undefined);

      expect((instance as any).deserializer).toBeInstanceOf(
        NatsRequestJSONDeserializer,
      );
    });

    it('should keep a custom deserializer', () => {
      const deserializer = { deserialize: vi.fn() };
      const instance = new ServerNats({ deserializer } as any);

      expect((instance as any).deserializer).toBe(deserializer);
    });
  });
});
