import { EventEmitter } from 'events';
import { of } from 'rxjs';
import { NO_MESSAGE_HANDLER } from '../../../../packages/microservices/constants.js';
import { RedisContext } from '../../../../packages/microservices/ctx-host/redis.context.js';
import { IncomingRequestDeserializer } from '../../../../packages/microservices/deserializers/incoming-request.deserializer.js';
import { InvalidPacketIdException } from '../../../../packages/microservices/errors/invalid-packet-id.exception.js';
import { ServerRedis } from '../../../../packages/microservices/server/server-redis.js';
import { IdentitySerializer } from '../../../../packages/microservices/serializers/identity.serializer.js';

const createFakeClient = () => {
  const client: any = new EventEmitter();
  client.connect = vi.fn().mockResolvedValue(undefined);
  client.quit = vi.fn().mockResolvedValue(undefined);
  client.disconnect = vi.fn();
  client.subscribe = vi.fn().mockResolvedValue(undefined);
  client.psubscribe = vi.fn().mockResolvedValue(undefined);
  client.publish = vi.fn().mockResolvedValue(1);
  return client;
};

describe('ServerRedis', () => {
  let server: ServerRedis;
  let untypedServer: any;
  const flush = () => new Promise<void>(resolve => setImmediate(resolve));

  beforeEach(() => {
    vi.restoreAllMocks();
    server = new ServerRedis({});
    untypedServer = server as any;
    untypedServer.messageHandlers = new Map();
  });

  // D1: options.serializer/deserializer present in constructor initialization
  describe('constructor', () => {
    it('should fall back to the default serializer and deserializer', () => {
      expect(untypedServer.serializer).toBeInstanceOf(IdentitySerializer);
      expect(untypedServer.deserializer).toBeInstanceOf(
        IncomingRequestDeserializer,
      );
      expect(server.transportId).toBe(1);
    });

    it('should keep custom serializer and deserializer options', () => {
      const serializer = { serialize: vi.fn() };
      const deserializer = { deserialize: vi.fn() };
      const custom = new ServerRedis({ serializer, deserializer } as any);

      expect((custom as any).serializer).toBe(serializer);
      expect((custom as any).deserializer).toBe(deserializer);
    });
  });

  // D1: createRedisClient rejects (catch)
  // D2: start throws synchronously (catch)
  // D3: client index selects "sub" vs "pub"
  describe('listen', () => {
    it('should create both clients, register listeners and start', async () => {
      const sub = createFakeClient();
      const pub = createFakeClient();
      vi.spyOn(server, 'createRedisClient')
        .mockResolvedValueOnce(sub)
        .mockResolvedValueOnce(pub);
      const callback = vi.fn();
      untypedServer.isManuallyClosed = true;

      await server.listen(callback);
      await vi.waitFor(() => expect(callback).toHaveBeenCalled());

      expect(untypedServer.subClient).toBe(sub);
      expect(untypedServer.pubClient).toBe(pub);
      expect(untypedServer.isManuallyClosed).toBe(false);
      for (const client of [sub, pub]) {
        const events = client.eventNames();
        expect(events).toEqual(
          expect.arrayContaining(['error', 'reconnecting', 'ready', 'end']),
        );
      }
      expect(callback).toHaveBeenCalledWith();
    });

    it('should forward pending listeners to both clients with their type', async () => {
      const sub = createFakeClient();
      const pub = createFakeClient();
      vi.spyOn(server, 'createRedisClient')
        .mockResolvedValueOnce(sub)
        .mockResolvedValueOnce(pub);
      const readySpy = vi.fn();
      server.on('ready', readySpy);

      await server.listen(() => {});
      await vi.waitFor(() => expect(untypedServer.pubClient).toBe(pub));

      sub.emit('ready');
      pub.emit('ready');

      expect(readySpy.mock.calls[0][0]).toBe('sub');
      expect(readySpy.mock.calls[1][0]).toBe('pub');
      expect(untypedServer.pendingEventListeners).toEqual([]);
    });

    it('should pass a client creation error to the callback', async () => {
      const error = new Error('redis unavailable');
      vi.spyOn(server, 'createRedisClient').mockRejectedValue(error);
      const callback = vi.fn();

      await server.listen(callback);

      expect(callback).toHaveBeenCalledExactlyOnceWith(error);
    });

    it('should pass a synchronous start error to the callback', async () => {
      const sub = createFakeClient();
      const pub = createFakeClient();
      vi.spyOn(server, 'createRedisClient')
        .mockResolvedValueOnce(sub)
        .mockResolvedValueOnce(pub);
      const error = new Error('start failed');
      vi.spyOn(server, 'start').mockImplementation(() => {
        throw error;
      });
      const callback = vi.fn();

      await server.listen(callback);

      expect(callback).toHaveBeenCalledExactlyOnceWith(error);
    });
  });

  // D1: connect resolves vs rejects
  // D2: bindEvents resolves vs rejects
  // D3: callback optional
  describe('start', () => {
    it('should connect both clients, bind events and call back without arguments', async () => {
      const sub = createFakeClient();
      const pub = createFakeClient();
      untypedServer.subClient = sub;
      untypedServer.pubClient = pub;
      const bindSpy = vi
        .spyOn(server, 'bindEvents')
        .mockResolvedValue(undefined);
      const callback = vi.fn();

      server.start(callback);
      await vi.waitFor(() => expect(callback).toHaveBeenCalled());

      expect(sub.connect).toHaveBeenCalledOnce();
      expect(pub.connect).toHaveBeenCalledOnce();
      expect(bindSpy).toHaveBeenCalledWith(sub, pub);
      expect(callback).toHaveBeenCalledWith();
    });

    it('should pass a connection rejection to the callback', async () => {
      const sub = createFakeClient();
      const pub = createFakeClient();
      const error = new Error('connect failed');
      sub.connect.mockRejectedValue(error);
      untypedServer.subClient = sub;
      untypedServer.pubClient = pub;
      const callback = vi.fn();

      server.start(callback);
      await vi.waitFor(() => expect(callback).toHaveBeenCalled());

      expect(callback).toHaveBeenCalledExactlyOnceWith(error);
    });

    it('should pass a bindEvents rejection to the callback', async () => {
      const sub = createFakeClient();
      const pub = createFakeClient();
      const error = new Error('subscribe failed');
      untypedServer.subClient = sub;
      untypedServer.pubClient = pub;
      vi.spyOn(server, 'bindEvents').mockRejectedValue(error);
      const callback = vi.fn();

      server.start(callback);
      await vi.waitFor(() => expect(callback).toHaveBeenCalled());

      expect(callback).toHaveBeenCalledExactlyOnceWith(error);
    });

    it('should tolerate a missing callback', async () => {
      const sub = createFakeClient();
      const pub = createFakeClient();
      untypedServer.subClient = sub;
      untypedServer.pubClient = pub;
      vi.spyOn(server, 'bindEvents').mockResolvedValue(undefined);

      expect(() => server.start()).not.toThrow();
      await flush();
    });
  });

  // D1: options.wildcards
  // D2: handler.isEventHandler
  describe('bindEvents', () => {
    it('should bind "message" and subscribe to request patterns when wildcards are off', async () => {
      const sub = createFakeClient();
      server.addHandler('request', vi.fn());
      server.addHandler('event', vi.fn(), true);

      await server.bindEvents(sub, null);

      expect(sub.eventNames()).toContain('message');
      expect(sub.subscribe).toHaveBeenCalledWith('request');
      expect(sub.subscribe).toHaveBeenCalledWith('event');
    });

    it('should bind "pmessage" and psubscribe to every pattern when wildcards are on', async () => {
      untypedServer.options = { wildcards: true };
      const sub = createFakeClient();
      server.addHandler('users.*', vi.fn());

      await server.bindEvents(sub, null);

      expect(sub.eventNames()).toContain('pmessage');
      expect(sub.psubscribe).toHaveBeenCalledWith('users.*');
      expect(sub.subscribe).not.toHaveBeenCalled();
    });

    it('should propagate a rejected subscription', async () => {
      const sub = createFakeClient();
      const error = new Error('NOPERM');
      sub.subscribe.mockRejectedValue(error);
      server.addHandler('request', vi.fn());

      await expect(server.bindEvents(sub, null)).rejects.toBe(error);
    });
  });

  // D1: pubClient truthy
  // D2: subClient truthy
  // D3: quit rejects
  describe('close', () => {
    it('should resolve and clear pending listeners without clients', async () => {
      untypedServer.pendingEventListeners = [
        { event: 'ready', callback: vi.fn() },
      ];

      await expect(server.close()).resolves.toBeUndefined();

      expect(untypedServer.isManuallyClosed).toBe(true);
      expect(untypedServer.pendingEventListeners).toEqual([]);
    });

    it('should quit both clients', async () => {
      const sub = createFakeClient();
      const pub = createFakeClient();
      untypedServer.subClient = sub;
      untypedServer.pubClient = pub;

      await server.close();

      expect(pub.quit).toHaveBeenCalledOnce();
      expect(sub.quit).toHaveBeenCalledOnce();
    });

    it('should disconnect a failing client and still close the other one', async () => {
      const sub = createFakeClient();
      const pub = createFakeClient();
      pub.quit.mockRejectedValue(new Error('offline queue disabled'));
      untypedServer.subClient = sub;
      untypedServer.pubClient = pub;

      await expect(server.close()).resolves.toBeUndefined();

      expect(pub.disconnect).toHaveBeenCalledOnce();
      expect(sub.quit).toHaveBeenCalledOnce();
    });
  });

  // D1: clientInfoTag truthy
  describe('createRedisClient', () => {
    it('should create a lazy client with the default host and port', async () => {
      const client: any = await server.createRedisClient();

      expect(client.options.lazyConnect).toBe(true);
      expect(client.options.port).toBe(6379);
      expect(client.options.host).toBe('localhost');
      expect(client.options.clientInfoTag).toBeUndefined();
      expect(typeof client.options.retryStrategy).toBe('function');
      client.disconnect();
    });

    it('should pass the clientInfoTag option', async () => {
      const tagged = new ServerRedis({ clientInfoTag: 'my-app' });
      const client: any = await tagged.createRedisClient();

      expect(client.options.clientInfoTag).toBe('my-app');
      client.disconnect();
    });
  });

  // D1: options.wildcards
  // D2: handleMessage rejection is caught
  describe('getMessageHandler', () => {
    it('should pass the channel as the pattern without wildcards', async () => {
      const handleMessageSpy = vi
        .spyOn(server, 'handleMessage')
        .mockResolvedValue(undefined);
      const handler: any = server.getMessageHandler({});
      const pub = {};

      await handler('channel', 'buffer');

      expect(handleMessageSpy).toHaveBeenCalledWith(
        'channel',
        'buffer',
        pub,
        'channel',
      );
    });

    it('should pass the concrete pattern with wildcards', async () => {
      untypedServer.options = { wildcards: true };
      const handleMessageSpy = vi
        .spyOn(server, 'handleMessage')
        .mockResolvedValue(undefined);
      const handler: any = server.getMessageHandler({});

      await handler('users.*', 'users.created', 'buffer');

      expect(handleMessageSpy).toHaveBeenCalledWith(
        'users.*',
        'buffer',
        {},
        'users.created',
      );
    });

    it.each([false, true])(
      'should route handleMessage rejections to handleError (wildcards: %s)',
      async wildcards => {
        untypedServer.options = { wildcards };
        const error = new Error('unexpected');
        vi.spyOn(server, 'handleMessage').mockRejectedValue(error);
        const handleErrorSpy = vi
          .spyOn(untypedServer, 'handleError')
          .mockImplementation(() => {});
        const handler: any = server.getMessageHandler({});

        await (wildcards ? handler('a.*', 'a.b', 'b') : handler('a', 'b'));

        expect(handleErrorSpy).toHaveBeenCalledWith(error);
      },
    );
  });

  // D1: options.wildcards && isOwnReply
  // D2: packet.id undefined
  // D3: handler lookup miss
  // D4: handler.isEventHandler && isAnsweredByMessageHandler
  // D5: channel !== pattern && isAnsweredByMessageHandler
  describe('handleMessage', () => {
    let publishSpy: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      publishSpy = vi.fn();
      vi.spyOn(server, 'getPublisher').mockReturnValue(publishSpy);
    });

    it('should dispatch a packet without an id as an event', async () => {
      const handleEventSpy = vi
        .spyOn(server, 'handleEvent')
        .mockResolvedValue(undefined);
      const packet = { pattern: 'test', data: 'x' };

      await server.handleMessage('test', JSON.stringify(packet), null, 'test');

      expect(handleEventSpy).toHaveBeenCalledWith(
        'test',
        packet,
        expect.any(RedisContext),
      );
    });

    it('should publish NO_MESSAGE_HANDLER when no handler matches', async () => {
      await server.handleMessage(
        'test',
        JSON.stringify({ id: '3', pattern: 'test', data: 'x' }),
        null,
        'test',
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
        JSON.stringify({ id: '3', pattern: 'test', data: 'x' }),
        null,
        'test',
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
        JSON.stringify({ id: 1, pattern: 'test', data: 'x' }),
        null,
        'test',
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
          JSON.stringify({ id: 'a'.repeat(257), pattern: 'test', data: 'x' }),
          null,
          'test',
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
          JSON.stringify({ id: 2, pattern: 'test', data: 'x' }),
          null,
          'test',
        ),
      ).rejects.toThrow('handler failed');
      await flush();

      expect(publishSpy).toHaveBeenCalledExactlyOnceWith({
        err: { status: 'error', message: 'Internal server error' },
        isDisposed: true,
      });
    });

    it('should publish an event reply to the concrete channel with wildcards', async () => {
      untypedServer.options = { wildcards: true };
      server.addHandler(
        'users.*',
        vi.fn(async () => 'event'),
      );

      await server.handleMessage(
        'users.*',
        JSON.stringify({ id: 3, pattern: 'users.created', data: 'x' }),
        {},
        'users.created',
      );
      await flush();

      expect(server.getPublisher).toHaveBeenCalledWith(
        {},
        'users.created',
        3,
        expect.any(RedisContext),
      );
      expect(publishSpy).toHaveBeenCalledWith({
        response: 'event',
        isDisposed: true,
      });
    });

    it('should skip its own reply message', async () => {
      untypedServer.options = { wildcards: true };
      const handler = vi.fn();
      server.addHandler('users.*', handler);

      await server.handleMessage(
        'users.*',
        JSON.stringify({ id: 4, response: 'x', isDisposed: true }),
        {},
        'users.created.reply',
      );

      expect(handler).not.toHaveBeenCalled();
      expect(publishSpy).not.toHaveBeenCalled();
    });

    it('should dispatch an event to the wildcard message handler instead of replying twice', async () => {
      untypedServer.options = { wildcards: true };
      const eventHandler = Object.assign(
        vi.fn(async () => 'event'),
        { isEventHandler: true },
      );
      const messageHandler = vi.fn(async () => 'message');
      server.addHandler('users.*', eventHandler, true);
      server.addHandler('users.get', messageHandler);
      const handleEventSpy = vi
        .spyOn(server, 'handleEvent')
        .mockResolvedValue(undefined);

      await server.handleMessage(
        'users.*',
        JSON.stringify({ id: 5, pattern: 'users.get', data: 'x' }),
        {},
        'users.get',
      );

      expect(handleEventSpy).toHaveBeenCalledOnce();
      expect(publishSpy).not.toHaveBeenCalled();
    });

    it('should let the handler of the channel itself answer the request alone', async () => {
      untypedServer.options = { wildcards: true };
      const wildcardHandler = vi.fn(async () => 'wildcard');
      server.addHandler('users.*', wildcardHandler);
      server.addHandler(
        'users.get',
        vi.fn(async () => 'message'),
      );

      await server.handleMessage(
        'users.*',
        JSON.stringify({ id: 6, pattern: 'users.get', data: 'x' }),
        {},
        'users.get',
      );
      await flush();

      expect(wildcardHandler).not.toHaveBeenCalled();
      expect(publishSpy).not.toHaveBeenCalled();
    });

    it('should warn once when an event handler replies on a channel without a message handler', async () => {
      untypedServer.options = { wildcards: true };
      const warnSpy = vi
        .spyOn(untypedServer.logger, 'warn')
        .mockImplementation(() => {});
      server.addHandler(
        'users.*',
        vi.fn(async () => 'event'),
        true,
      );

      await server.handleMessage(
        'users.*',
        JSON.stringify({ id: 7, pattern: 'users.list', data: 'x' }),
        {},
        'users.list',
      );
      await flush();

      expect(warnSpy).toHaveBeenCalledOnce();
      expect(publishSpy).toHaveBeenCalledWith({
        response: 'event',
        isDisposed: true,
      });
    });

    it('should expose the metadata on the RedisContext', async () => {
      const handler = vi.fn(async () => null);
      server.addHandler('test', handler);
      const metadata = { traceId: 'trace-1' };

      await server.handleMessage(
        'test',
        JSON.stringify({ id: 8, pattern: 'test', data: 'x', metadata }),
        null,
        'test',
      );
      await flush();

      const context: RedisContext = handler.mock.calls[0][1];
      expect(context.getChannel()).toBe('test');
      expect(context.getMetadata()).toEqual(metadata);
    });
  });

  // D1: options.wildcards
  // D2: some() callback: handler.isEventHandler
  // D3: some() callback: getRequestPattern(pattern) === channel
  describe('isAnsweredByMessageHandler', () => {
    it('should be false when wildcards are disabled', () => {
      expect(untypedServer.isAnsweredByMessageHandler('users.get')).toBe(false);
    });

    it('should be false when the only handler on the channel is an event handler', () => {
      untypedServer.options = { wildcards: true };
      server.addHandler('users.get', vi.fn(), true);

      expect(untypedServer.isAnsweredByMessageHandler('users.get')).toBe(false);
    });

    it('should be false when no message handler targets the channel', () => {
      untypedServer.options = { wildcards: true };
      server.addHandler('users.*', vi.fn());

      expect(untypedServer.isAnsweredByMessageHandler('users.get')).toBe(false);
    });

    it('should be true when a message handler targets the channel', () => {
      untypedServer.options = { wildcards: true };
      server.addHandler('users.get', vi.fn());

      expect(untypedServer.isAnsweredByMessageHandler('users.get')).toBe(true);
    });
  });

  // D1: channel ends with ".reply"
  // D2: subscription does not end with ".reply"
  // D3: message.id is defined
  // D4: message.pattern is undefined
  describe('isOwnReply', () => {
    it.each([
      [
        'subscription matches the reply channel',
        'users.*',
        'users.created',
        { id: 1 },
        false,
      ],
      [
        'subscription targets reply channels',
        '*.reply',
        'users.created.reply',
        { id: 1 },
        false,
      ],
      [
        'message has no id',
        'users.*',
        'users.created.reply',
        { response: 1 },
        false,
      ],
      [
        'message has a pattern',
        'users.*',
        'users.created.reply',
        { id: 1, pattern: 'p' },
        false,
      ],
      [
        'a plain reply',
        'users.*',
        'users.created.reply',
        { id: 1, response: 1 },
        true,
      ],
    ])(
      'should evaluate %s',
      (_label, subscription, channel, message, expected) => {
        expect(untypedServer.isOwnReply(subscription, channel, message)).toBe(
          expected,
        );
      },
    );
  });

  // D1: pub.publish called with the reply pattern
  describe('getPublisher', () => {
    it('should assign the id and publish the serialized reply', () => {
      const pub = { publish: vi.fn() };
      const publisher = server.getPublisher(
        pub,
        'users.created',
        '3',
        new RedisContext(['users.created']),
      );
      const response: any = { response: 'x', isDisposed: true };

      publisher(response);

      expect(response.id).toBe('3');
      expect(pub.publish).toHaveBeenCalledWith(
        'users.created.reply',
        JSON.stringify({ response: 'x', isDisposed: true, id: '3' }),
      );
    });
  });

  // D1: JSON.parse succeeds vs throws
  describe('parseMessage', () => {
    it('should parse valid json', () => {
      expect(server.parseMessage('{"a":1}')).toEqual({ a: 1 });
    });

    it('should return the input when parsing fails', () => {
      expect(server.parseMessage('not json')).toBe('not json');
    });
  });

  describe('getRequestPattern', () => {
    // D0: identity
    it('should return the pattern unchanged', () => {
      expect(server.getRequestPattern('users.get')).toBe('users.get');
    });
  });

  describe('getReplyPattern', () => {
    // D0: append suffix
    it('should append the reply suffix', () => {
      expect(server.getReplyPattern('users.get')).toBe('users.get.reply');
    });
  });

  describe('registerErrorListener', () => {
    // D0: logs the error
    it('should log client errors', () => {
      const errorSpy = vi
        .spyOn(untypedServer.logger, 'error')
        .mockImplementation(() => {});
      const client = createFakeClient();
      server.registerErrorListener(client);
      const error = new Error('client error');

      client.emit('error', error);

      expect(errorSpy).toHaveBeenCalledWith(error);
    });
  });

  // D1: isManuallyClosed
  // D2: wasInitialConnectionSuccessful
  describe('registerReconnectListener', () => {
    it('should ignore reconnects after a manual close', () => {
      const statuses: string[] = [];
      server.status.subscribe(status => statuses.push(status));
      untypedServer.isManuallyClosed = true;
      const client = createFakeClient();
      server.registerReconnectListener(client);

      client.emit('reconnecting');

      expect(statuses).toEqual([]);
    });

    it('should report reconnecting without a log before the first connection', () => {
      const statuses: string[] = [];
      server.status.subscribe(status => statuses.push(status));
      const logSpy = vi
        .spyOn(untypedServer.logger, 'log')
        .mockImplementation(() => {});
      const client = createFakeClient();
      server.registerReconnectListener(client);

      client.emit('reconnecting');

      expect(statuses).toEqual(['reconnecting']);
      expect(logSpy).not.toHaveBeenCalled();
    });

    it('should log reconnecting after a successful initial connection', () => {
      const statuses: string[] = [];
      server.status.subscribe(status => statuses.push(status));
      const logSpy = vi
        .spyOn(untypedServer.logger, 'log')
        .mockImplementation(() => {});
      untypedServer.wasInitialConnectionSuccessful = true;
      const client = createFakeClient();
      server.registerReconnectListener(client);

      client.emit('reconnecting');

      expect(statuses).toEqual(['reconnecting']);
      expect(logSpy).toHaveBeenCalledWith('Reconnecting to Redis...');
    });
  });

  // D1: wasInitialConnectionSuccessful on first ready
  describe('registerReadyListener', () => {
    it('should report connected and remember the first successful connection', () => {
      const statuses: string[] = [];
      server.status.subscribe(status => statuses.push(status));
      const logSpy = vi
        .spyOn(untypedServer.logger, 'log')
        .mockImplementation(() => {});
      const client = createFakeClient();
      server.registerReadyListener(client);

      client.emit('ready');
      client.emit('ready');

      expect(statuses).toEqual(['connected']);
      expect(logSpy).toHaveBeenCalledTimes(2);
      expect(untypedServer.wasInitialConnectionSuccessful).toBe(true);
    });
  });

  // D1: isManuallyClosed
  // D2: client is one of the current clients
  describe('registerEndListener', () => {
    it('should ignore "end" after a manual close', () => {
      const statuses: string[] = [];
      server.status.subscribe(status => statuses.push(status));
      untypedServer.isManuallyClosed = true;
      const client = createFakeClient();
      server.registerEndListener(client);

      client.emit('end');

      expect(statuses).toEqual([]);
    });

    it('should ignore the "end" of a replaced client', () => {
      const statuses: string[] = [];
      server.status.subscribe(status => statuses.push(status));
      const current = createFakeClient();
      untypedServer.subClient = current;
      untypedServer.pubClient = createFakeClient();
      const replaced = createFakeClient();
      server.registerEndListener(replaced);

      replaced.emit('end');

      expect(statuses).toEqual([]);
    });

    it('should report disconnected and log for a current client', () => {
      const statuses: string[] = [];
      server.status.subscribe(status => statuses.push(status));
      const errorSpy = vi
        .spyOn(untypedServer.logger, 'error')
        .mockImplementation(() => {});
      const client = createFakeClient();
      untypedServer.subClient = client;
      untypedServer.pubClient = createFakeClient();
      server.registerEndListener(client);

      client.emit('end');

      expect(statuses).toEqual(['disconnected']);
      expect(errorSpy).toHaveBeenCalledWith(
        'Disconnected from Redis. No further reconnection attempts will be made.',
      );
    });
  });

  describe('getClientOptions', () => {
    // D0: spreads options and builds a retryStrategy delegate
    it('should include the server options and a retryStrategy', () => {
      untypedServer.options = {
        host: 'redis.local',
        retryAttempts: 3,
        retryDelay: 10,
      };
      const createSpy = vi.spyOn(server, 'createRetryStrategy');

      const options: any = server.getClientOptions();

      expect(options.host).toBe('redis.local');
      expect(options.retryStrategy(1)).toBe(10);
      expect(createSpy).toHaveBeenCalledWith(1);
    });

    it('should fall back to an empty options object', () => {
      untypedServer.options = undefined;

      const options: any = server.getClientOptions();

      expect(typeof options.retryStrategy).toBe('function');
      expect(options.host).toBeUndefined();
    });
  });

  // D1: isManuallyClosed
  // D2: retryAttempts falsy
  // D3: times > retryAttempts
  // D4: retryDelay default
  describe('createRetryStrategy', () => {
    it('should return undefined after a manual close', () => {
      untypedServer.isManuallyClosed = true;
      expect(server.createRetryStrategy(1)).toBeUndefined();
    });

    it('should log and return undefined when retryAttempts is missing', () => {
      const errorSpy = vi
        .spyOn(untypedServer.logger, 'error')
        .mockImplementation(() => {});
      untypedServer.options = {};

      expect(server.createRetryStrategy(1)).toBeUndefined();
      expect(errorSpy).toHaveBeenCalledWith(
        'Redis connection closed and retry attempts not specified',
      );
    });

    it('should log and return undefined when attempts are exhausted', () => {
      const errorSpy = vi
        .spyOn(untypedServer.logger, 'error')
        .mockImplementation(() => {});
      untypedServer.options = { retryAttempts: 3 };

      expect(server.createRetryStrategy(4)).toBeUndefined();
      expect(errorSpy).toHaveBeenCalledWith('Retry time exhausted');
    });

    it('should return the delay at the attempt limit', () => {
      untypedServer.options = { retryAttempts: 3, retryDelay: 25 };
      expect(server.createRetryStrategy(3)).toBe(25);
    });

    it('should default the delay to 5000ms', () => {
      untypedServer.options = { retryAttempts: 3 };
      expect(server.createRetryStrategy(1)).toBe(5000);
    });
  });

  // D1: pubClient and subClient present
  describe('unwrap', () => {
    it('should throw before the clients are initialized', () => {
      expect(() => server.unwrap()).toThrow(/Not initialized/);
    });

    it('should return [pubClient, subClient]', () => {
      const pub = createFakeClient();
      const sub = createFakeClient();
      untypedServer.pubClient = pub;
      untypedServer.subClient = sub;

      expect(server.unwrap()).toEqual([pub, sub]);
    });
  });

  // D1: both clients present
  describe('on', () => {
    it('should queue the listener before the clients exist', () => {
      const callback = vi.fn();
      server.on('ready', callback);

      expect(untypedServer.pendingEventListeners).toEqual([
        { event: 'ready', callback },
      ]);
    });

    it('should register wrappers on both clients when they exist', () => {
      const pub = createFakeClient();
      const sub = createFakeClient();
      untypedServer.pubClient = pub;
      untypedServer.subClient = sub;
      const callback = vi.fn();

      server.on('ready', callback);
      sub.emit('ready');
      pub.emit('ready');

      expect(callback.mock.calls[0][0]).toBe('sub');
      expect(callback.mock.calls[1][0]).toBe('pub');
    });
  });
});
