import { EventEmitter } from 'events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CONNECTION_FAILED_MESSAGE,
  MQTT_DEFAULT_URL,
  MQTT_MAX_TOPIC_LENGTH,
  NO_MESSAGE_HANDLER,
} from '../../../../packages/microservices/constants.js';
import { MqttContext } from '../../../../packages/microservices/ctx-host/mqtt.context.js';
import { InvalidPacketIdException } from '../../../../packages/microservices/errors/invalid-packet-id.exception.js';
import { MaxMqttTopicLengthExceededException } from '../../../../packages/microservices/errors/max-mqtt-topic-length-exceeded.exception.js';
import { MqttRecord } from '../../../../packages/microservices/record-builders/mqtt.record-builder.js';
import { MqttRecordSerializer } from '../../../../packages/microservices/serializers/mqtt-record.serializer.js';
import { IncomingRequestDeserializer } from '../../../../packages/microservices/deserializers/incoming-request.deserializer.js';
import { ServerMqtt } from '../../../../packages/microservices/server/server-mqtt.js';

const asAny = (value: unknown) => value as any;
const flush = () => new Promise<void>(resolve => setImmediate(resolve));

/** The subset of the mqtt.js client that ServerMqtt touches. */
const createFakeClient = (overrides: Record<string, any> = {}) => {
  const emitter = new EventEmitter() as any;
  emitter.subscribe = vi.fn();
  emitter.publish = vi.fn();
  emitter.endAsync = vi.fn().mockResolvedValue(undefined);
  return Object.assign(emitter, overrides);
};

const createServer = (options: any = {}) => {
  const server = new ServerMqtt(options);
  const logger = asAny(server).logger;
  vi.spyOn(logger, 'error').mockImplementation(() => {});
  vi.spyOn(logger, 'log').mockImplementation(() => {});
  vi.spyOn(logger, 'warn').mockImplementation(() => {});
  return server;
};

const captureStatus = (server: ServerMqtt) => {
  const statuses: string[] = [];
  const subscription = server.status.subscribe(status =>
    statuses.push(status as string),
  );
  return { statuses, stop: () => subscription.unsubscribe() };
};

/**
 * Constructor decisions:
 * D1 `url` option present? -> value or MQTT_DEFAULT_URL (getOptionsProp default)
 * D2 `serializer` option present? (D3 `deserializer` option present?)
 */
describe('ServerMqtt.constructor', () => {
  it('applies the defaults (D1 F, D2 F, D3 F)', () => {
    const server = new ServerMqtt({});

    expect(asAny(server).url).toBe(MQTT_DEFAULT_URL);
    expect(asAny(server).serializer).toBeInstanceOf(MqttRecordSerializer);
    expect(asAny(server).deserializer).toBeInstanceOf(
      IncomingRequestDeserializer,
    );
    // Transport.MQTT is a numeric enum (0-based), so the id is 3.
    expect(asAny(server).transportId).toBe(3);
  });

  it('keeps the custom values (D1 T, D2 T, D3 T)', () => {
    const serializer = { serialize: vi.fn() };
    const deserializer = { deserialize: vi.fn() };
    const server = new ServerMqtt({
      url: 'mqtt://broker:9000',
      serializer,
      deserializer,
    } as any);

    expect(asAny(server).url).toBe('mqtt://broker:9000');
    expect(asAny(server).serializer).toBe(serializer);
    expect(asAny(server).deserializer).toBe(deserializer);
  });
});

/**
 * `listen` decisions:
 * D1 `createMqttClient()` / `start()` resolve? -> start runs, else the error is
 * passed to the callback (the try/catch).
 */
describe('ServerMqtt.listen', () => {
  it('creates the client and starts the server (D1 T)', async () => {
    const server = createServer();
    const fake = createFakeClient();
    const create = vi
      .spyOn(server, 'createMqttClient')
      .mockResolvedValue(fake as any);
    const start = vi.spyOn(server, 'start').mockImplementation(() => {});
    const callback = vi.fn();

    await server.listen(callback);

    expect(create).toHaveBeenCalledTimes(1);
    expect(start).toHaveBeenCalledWith(callback);
    expect(asAny(server).mqttClient).toBe(fake);
  });

  it('passes a connection error to the callback (D1 F)', async () => {
    const server = createServer();
    const error = new Error('no broker');
    vi.spyOn(server, 'createMqttClient').mockRejectedValue(error);
    const start = vi.spyOn(server, 'start');
    const callback = vi.fn();

    await server.listen(callback);

    expect(callback).toHaveBeenCalledWith(error);
    expect(start).not.toHaveBeenCalled();
  });

  it('passes a synchronous start() failure to the callback (D1 F)', async () => {
    const server = createServer();
    const error = new Error('start failed');
    vi.spyOn(server, 'createMqttClient').mockResolvedValue(
      createFakeClient() as any,
    );
    vi.spyOn(server, 'start').mockImplementation(() => {
      throw error;
    });
    const callback = vi.fn();

    await server.listen(callback);

    expect(callback).toHaveBeenCalledWith(error);
  });

  it('re-arms the attempt state on every listen()', async () => {
    const server = createServer();
    asAny(server).connectionAttempts = 5;
    asAny(server).hasConnected = true;
    vi.spyOn(server, 'createMqttClient').mockResolvedValue(
      createFakeClient() as any,
    );
    vi.spyOn(server, 'start').mockImplementation(() => {});

    await server.listen(vi.fn());

    expect(asAny(server).connectionAttempts).toBe(0);
    expect(asAny(server).hasConnected).toBe(false);
  });
});

/**
 * `start` decisions:
 * D1 `err` undefined in settleListenCallback? -> cb() / cb(err)
 * D2 the callback was already settled (`listenCallback` undefined)?
 * D3 pendingEventListeners non-empty? (forEach over 0 and >0 entries)
 */
describe('ServerMqtt.start', () => {
  let server: ServerMqtt;
  let fake: any;

  beforeEach(() => {
    server = createServer();
    fake = createFakeClient();
    asAny(server).mqttClient = fake;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('registers every listener, subscribes the handlers and settles once on connect (D1 T, D3 F)', async () => {
    const callback = vi.fn();
    const handler = vi.fn();
    server.addHandler('orders/#', handler, true);

    server.start(callback);

    const events = fake
      .listeners('error')
      .concat(fake.listeners('reconnect'))
      .concat(fake.listeners('disconnect'))
      .concat(fake.listeners('close'))
      .concat(fake.listeners('connect'));
    expect(events.length).toBeGreaterThanOrEqual(5);
    expect(fake.listeners('message')).toHaveLength(1);
    expect(fake.subscribe).toHaveBeenCalledWith('orders/#', undefined);
    expect(callback).not.toHaveBeenCalled();

    fake.emit('connect');
    fake.emit('connect');

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith();
  });

  it('attaches and clears the listeners queued before start (D3 T)', () => {
    const callback = vi.fn();
    const queued = vi.fn();
    server.on('disconnect', queued);

    server.start(callback);

    expect(asAny(server).pendingEventListeners).toEqual([]);
    fake.emit('disconnect');
    expect(queued).toHaveBeenCalledTimes(1);
  });

  it('settles the callback with the connection error and never calls it again (D1 F, D2 T)', async () => {
    const error = new Error('second failure');
    const limitedServer = createServer({ maxConnectionAttempts: 2 });
    const limitedClient = createFakeClient();
    asAny(limitedServer).mqttClient = limitedClient;
    vi.spyOn(limitedServer, 'close').mockResolvedValue(undefined);
    const callback = vi.fn();

    limitedServer.start(callback);
    limitedClient.emit('error', new Error('first failure'));
    expect(callback).not.toHaveBeenCalled();

    limitedClient.emit('error', error);
    expect(callback).toHaveBeenCalledExactlyOnceWith(error);

    // A later error finds the callback already settled (D2 T).
    limitedClient.emit('error', new Error('third failure'));
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('wraps a missing error in CONNECTION_FAILED_MESSAGE (D1 F)', () => {
    const limitedServer = createServer({ maxConnectionAttempts: 1 });
    const limitedClient = createFakeClient();
    asAny(limitedServer).mqttClient = limitedClient;
    vi.spyOn(limitedServer, 'close').mockResolvedValue(undefined);
    const callback = vi.fn();

    limitedServer.start(callback);
    limitedClient.emit('error', undefined);

    expect(callback).toHaveBeenCalledWith(new Error(CONNECTION_FAILED_MESSAGE));
  });
});

/**
 * `bindEvents` decisions:
 * D1 handlers non-empty? (forEach over 0 and >0 entries)
 * D2 `extras.qos !== undefined`? -> per-handler qos merged over the global
 * D3 `isEventHandler`? -> the raw pattern is subscribed, else the request one.
 */
describe('ServerMqtt.bindEvents', () => {
  it('only binds the message handler when nothing is registered (D1 F)', () => {
    const server = createServer();
    const fake = createFakeClient();

    server.bindEvents(fake);

    expect(fake.listeners('message')).toHaveLength(1);
    expect(fake.subscribe).not.toHaveBeenCalled();
  });

  it.each([
    [
      'no global options, no qos, request handler (D2 F, D3 F)',
      undefined,
      {},
      'orders',
      false,
      undefined,
    ],
    [
      'per-handler qos 0 (D2 T)',
      undefined,
      { qos: 0 },
      'orders',
      false,
      { qos: 0 },
    ],
    [
      'per-handler qos over global options (D2 T)',
      { qos: 1, nl: true },
      { qos: 2 },
      'orders',
      false,
      { qos: 2, nl: true },
    ],
    [
      'global options only (D2 F)',
      { qos: 1 },
      {},
      'orders/created',
      true,
      { qos: 1 },
    ],
    [
      'an event handler keeps its raw pattern (D3 T)',
      { qos: 1 },
      { qos: 0 },
      'orders/created',
      true,
      { qos: 0 },
    ],
  ])(
    'subscribes the pattern for %s',
    (_label, subscribeOptions, extras, pattern, isEvent, expected) => {
      const server = createServer(
        subscribeOptions === undefined ? {} : { subscribeOptions },
      );
      const fake = createFakeClient();
      // `addHandler` resets `extras`, so the handler is registered directly.
      const handler = Object.assign(vi.fn(), {
        extras,
        isEventHandler: isEvent,
      });
      asAny(server).messageHandlers.set(pattern, handler);

      server.bindEvents(fake);

      expect(fake.subscribe).toHaveBeenCalledWith(pattern, expected);
    },
  );
});

/**
 * `close` decisions:
 * D1 `mqttClient` set? (optional chain) -> `endAsync()` awaited, else skipped
 * D2 `endAsync()` rejects? -> the state is already reset and the error escapes.
 */
describe('ServerMqtt.close', () => {
  it('ends the client and resets the queued listeners (D1 T, D2 F)', async () => {
    const server = createServer();
    const fake = createFakeClient();
    asAny(server).mqttClient = fake;
    asAny(server).pendingEventListeners = [
      { event: 'close', callback: vi.fn() },
    ];

    await server.close();

    expect(fake.endAsync).toHaveBeenCalledTimes(1);
    expect(asAny(server).mqttClient).toBeNull();
    expect(asAny(server).pendingEventListeners).toEqual([]);
  });

  it('waits for the connection to be closed before resolving (D1 T)', async () => {
    const server = createServer();
    let finish: Function = () => {};
    const fake = createFakeClient({
      endAsync: vi.fn(() => new Promise<void>(resolve => (finish = resolve))),
    });
    asAny(server).mqttClient = fake;
    let closed = false;

    const closing = server.close().then(() => {
      closed = true;
    });
    await flush();
    expect(closed).toBe(false);

    finish();
    await closing;
    expect(closed).toBe(true);
  });

  it('resets the state even when ending the client fails (D1 F, D2 T)', async () => {
    const server = createServer();
    const fake = createFakeClient({
      endAsync: vi.fn().mockRejectedValue(new Error('end failed')),
    });
    asAny(server).mqttClient = fake;

    await expect(server.close()).rejects.toThrow('end failed');

    expect(asAny(server).mqttClient).toBeNull();
  });
});

// `createMqttClient` has no decision; the option spread is exercised twice.
describe('ServerMqtt.createMqttClient', () => {
  it('connects with reconnectOnConnackError enabled by default', async () => {
    const server = createServer();
    const connect = vi.fn().mockReturnValue('mqtt-client');
    vi.spyOn(asAny(server), 'loadPackage').mockResolvedValue({ connect });

    const client = await server.createMqttClient();

    expect(client).toBe('mqtt-client');
    expect(connect).toHaveBeenCalledWith(MQTT_DEFAULT_URL, {
      reconnectOnConnackError: true,
    });
  });

  it('lets the options override the defaults', async () => {
    const server = createServer({
      url: 'mqtt://broker:9000',
      reconnectOnConnackError: false,
    });
    const connect = vi.fn().mockReturnValue('mqtt-client');
    vi.spyOn(asAny(server), 'loadPackage').mockResolvedValue({ connect });

    await server.createMqttClient();

    expect(connect).toHaveBeenCalledWith('mqtt://broker:9000', {
      reconnectOnConnackError: false,
      url: 'mqtt://broker:9000',
    });
  });
});

/**
 * `getMessageHandler` decisions:
 * D1 `handleMessage` rejects? -> routed to handleError instead of escaping.
 */
describe('ServerMqtt.getMessageHandler', () => {
  it('delegates to handleMessage with the client (D1 F)', async () => {
    const server = createServer();
    const fake = createFakeClient();
    const handle = vi
      .spyOn(server, 'handleMessage')
      .mockResolvedValue(undefined);
    const handler = server.getMessageHandler(fake);

    await handler('orders', Buffer.from('{}'), { qos: 1 });

    expect(handle).toHaveBeenCalledWith('orders', expect.any(Buffer), fake, {
      qos: 1,
    });
  });

  it('routes a rejection to handleError (D1 T)', async () => {
    const server = createServer();
    const error = new Error('unexpected');
    vi.spyOn(server, 'handleMessage').mockRejectedValue(error);
    const handleError = vi
      .spyOn(asAny(server), 'handleError')
      .mockImplementation(() => {});

    await server.getMessageHandler(createFakeClient())(
      'orders',
      Buffer.from('{}'),
    );

    expect(handleError).toHaveBeenCalledWith(error);
  });
});

/**
 * `handleMessage` decisions:
 * D1 `isOwnReply`? -> dropped (false -> continue)
 * D2 `packet.id` undefined? -> handleEvent, else the request pipeline
 * D3 a handler exists for the topic? -> publish NO_MESSAGE_HANDLER otherwise
 * D4 `assertValidPacketId` throws for a nested / too long id
 * (Event handler replies go through the base `warnIfEventHandlerReplies`.)
 */
describe('ServerMqtt.handleMessage', () => {
  const publish = () => ({ publish: vi.fn() });

  it('drops the own reply of the server (D1 T)', async () => {
    const server = createServer();
    server.addHandler('orders/#', vi.fn(), true);
    const client = publish();

    await server.handleMessage(
      'orders/1/reply',
      Buffer.from(
        JSON.stringify({ id: '1', response: 'ok', isDisposed: true }),
      ),
      client,
    );
    await flush();

    expect(client.publish).not.toHaveBeenCalled();
  });

  it('dispatches an event without an id (D1 F, D2 T)', async () => {
    const server = createServer();
    const handler = vi.fn().mockResolvedValue(undefined);
    server.addHandler('orders.created', handler, true);

    await server.handleMessage(
      'orders.created',
      Buffer.from(JSON.stringify({ pattern: 'orders.created', data: 'order' })),
      publish(),
      { qos: 1 },
    );

    expect(handler).toHaveBeenCalledWith('order', expect.any(MqttContext));
    expect(handler.mock.calls[0][1].getTopic()).toBe('orders.created');
    expect(handler.mock.calls[0][1].getPacket()).toEqual({ qos: 1 });
  });

  it('replies with NO_MESSAGE_HANDLER when no handler matches (D2 F, D3 F)', async () => {
    const server = createServer();
    const client = publish();

    await server.handleMessage(
      'unknown',
      Buffer.from(JSON.stringify({ id: '1', pattern: 'unknown', data: 'x' })),
      client,
    );
    await flush();

    expect(client.publish).toHaveBeenCalledWith(
      'unknown/reply',
      JSON.stringify({
        id: '1',
        status: 'error',
        err: NO_MESSAGE_HANDLER,
      }),
      {},
    );
  });

  it('runs the handler and replies on the reply topic (D2 F, D3 T)', async () => {
    const server = createServer();
    const handler = vi.fn().mockResolvedValue('done');
    server.addHandler('orders/1', handler);
    const client = publish();

    await server.handleMessage(
      'orders/1',
      Buffer.from(JSON.stringify({ id: '1', pattern: 'orders/1', data: 'x' })),
      client,
    );
    await flush();

    expect(handler).toHaveBeenCalledWith('x', expect.any(MqttContext));
    expect(client.publish).toHaveBeenCalledWith(
      'orders/1/reply',
      JSON.stringify({ response: 'done', isDisposed: true, id: '1' }),
      {},
    );
  });

  it('exposes MQTT 5 user properties on the context', async () => {
    const server = createServer();
    const handler = vi.fn().mockResolvedValue(undefined);
    server.addHandler('orders/1', handler, true);

    await server.handleMessage(
      'orders/1',
      Buffer.from(JSON.stringify({ pattern: 'orders/1', data: 'x' })),
      publish(),
      { properties: { userProperties: { 'x-request-id': 'trace-1' } } },
    );

    const context: MqttContext = handler.mock.calls[0][1];
    expect(context.getMetadata()).toEqual({ 'x-request-id': 'trace-1' });
  });

  it('rejects an id that is neither a number nor a short string (D4 T)', async () => {
    const server = createServer();
    const handler = vi.fn();
    server.addHandler('orders/1', handler);

    await expect(
      server.handleMessage(
        'orders/1',
        Buffer.from(
          JSON.stringify({
            id: [[['nested']]],
            pattern: 'orders/1',
            data: 'x',
          }),
        ),
        publish(),
      ),
    ).rejects.toBeInstanceOf(InvalidPacketIdException);
    expect(handler).not.toHaveBeenCalled();
  });
});

/**
 * `isOwnReply` decisions (all four atoms):
 * D1 `topic.endsWith('/reply')`?
 * D2 `!isUndefined(packet.id)`?
 * D3 `isUndefined(packet.pattern)`?
 * D4 no handler filter that ends in "/reply" and matches the topic?
 */
describe('ServerMqtt.isOwnReply', () => {
  const replyTopic = 'orders/1/reply';

  it.each([
    ['a reply with an id and no pattern', replyTopic, { id: '1' }, [], true],
    ['a topic that is not a reply', 'orders/1', { id: '1' }, [], false],
    ['a packet without an id', replyTopic, {}, [], false],
    [
      'a packet that carries a pattern',
      replyTopic,
      { id: '1', pattern: 'orders/1' },
      [],
      false,
    ],
    [
      'a matching reply filter',
      replyTopic,
      { id: '1' },
      [['orders/+/reply', false]],
      false,
    ],
    [
      'a shared reply filter',
      replyTopic,
      { id: '1' },
      [['$share/group/orders/+/reply', false]],
      false,
    ],
    ['a catch-all filter', replyTopic, { id: '1' }, [['orders/#', true]], true],
    ['an unrelated filter', replyTopic, { id: '1' }, [['users/#', true]], true],
  ])('classifies %s (D1..D4)', (_label, topic, packet, handlers, expected) => {
    const server = createServer();
    for (const [pattern, isEvent] of handlers as Array<[string, boolean]>) {
      server.addHandler(pattern, vi.fn(), isEvent);
    }

    expect(asAny(server).isOwnReply(topic, packet)).toBe(expected);
  });
});

/**
 * `getPublisher` decisions:
 * D1 the reply topic fits? (assertTopicLength throws otherwise)
 * D2 `response.response instanceof MqttRecord`? -> its options, else {}
 */
describe('ServerMqtt.getPublisher', () => {
  const context = new MqttContext(['orders/1', {}]);

  it('publishes the response with the id and empty options (D1 F, D2 F)', () => {
    const server = createServer();
    const client = { publish: vi.fn() };
    const publisher = server.getPublisher(client, context, '1');

    publisher({ response: 'ok', isDisposed: true });

    expect(client.publish).toHaveBeenCalledWith(
      'orders/1/reply',
      JSON.stringify({ response: 'ok', isDisposed: true, id: '1' }),
      {},
    );
  });

  it('publishes the data of a MqttRecord with its options (D2 T)', () => {
    const server = createServer();
    const client = { publish: vi.fn() };
    const publisher = server.getPublisher(client, context, '1');

    publisher({ response: new MqttRecord('ok', { qos: 1, retain: true }) });

    expect(client.publish).toHaveBeenCalledWith(
      'orders/1/reply',
      JSON.stringify({ response: 'ok', id: '1' }),
      { qos: 1, retain: true },
    );
  });

  it('refuses a reply topic that would exceed the maximum length (D1 T)', () => {
    const server = createServer();
    const longest = 'a'.repeat(MQTT_MAX_TOPIC_LENGTH - '/reply'.length);

    expect(() =>
      server.getPublisher({ publish: vi.fn() }, context, '1'),
    ).not.toThrow();
    expect(() =>
      server.getPublisher(
        { publish: vi.fn() },
        new MqttContext([`${longest}a`, {}]),
        '1',
      ),
    ).toThrow(MaxMqttTopicLengthExceededException);
  });
});

/**
 * `parseMessage` decisions:
 * D1 `JSON.parse` succeeds? -> parsed value, else the raw content.
 */
describe('ServerMqtt.parseMessage', () => {
  it('parses JSON (D1 T)', () => {
    const server = createServer();

    expect(server.parseMessage('{"a":1}')).toEqual({ a: 1 });
  });

  it('returns the raw content when it is not JSON (D1 F)', () => {
    const server = createServer();

    expect(server.parseMessage('not json')).toBe('not json');
  });
});

/**
 * `matchMqttPattern` decisions:
 * D1 `topic.startsWith('$')` AND the pattern starts with a wildcard?
 * D2 a topic segment is missing AND the pattern is not "#"?
 * D3 the pattern segment is "#"? -> matches only at the end
 * D4 the pattern segment is not "+" AND differs from the topic segment?
 * D5 same number of segments?
 */
describe('ServerMqtt.matchMqttPattern', () => {
  const server = createServer();

  it.each([
    ['#', '$SYS/broker', false],
    ['+', '$SYS', false],
    ['$SYS/#', '$SYS/broker', true],
    ['orders/1', 'orders/1', true],
    ['orders/+', 'orders/1', true],
    ['orders/#', 'orders/1/status', true],
    ['orders/#', 'orders', true],
    ['sport/+', 'sport', false],
    ['orders/#/status', 'orders/1/status', false],
    ['orders/+', 'users/1', false],
    ['orders/+', 'orders/1/status', false],
    ['orders', 'orders/1', false],
    ['sport/', 'sport/', true],
  ])('matches %s against %s -> %s', (pattern, topic, expected) => {
    expect(server.matchMqttPattern(pattern, topic)).toBe(expected);
  });
});

/**
 * `getHandlerByPattern` decisions:
 * D1 the topic starts with "{"? -> decoded as a route
 * D2 the exact route is registered? D3 a wildcard filter matches?
 */
describe('ServerMqtt.getHandlerByPattern', () => {
  it('returns the exact handler (D1 F, D2 T)', () => {
    const server = createServer();
    const handler = vi.fn();
    server.addHandler('orders/1', handler);

    expect(server.getHandlerByPattern('orders/1')).toBe(handler);
  });

  it('decodes an object pattern topic (D1 T, D2 T)', () => {
    const server = createServer();
    const handler = vi.fn();
    server.addHandler({ cmd: 'sum', role: 'math' }, handler);

    expect(server.getHandlerByPattern('{"cmd":"sum","role":"math"}')).toBe(
      handler,
    );
  });

  it('falls back to the wildcard filters (D2 F, D3 T)', () => {
    const server = createServer();
    const handler = vi.fn();
    server.addHandler('orders/+/status', handler, true);

    expect(server.getHandlerByPattern('orders/1/status')).toBe(handler);
  });

  it('returns null when nothing matches (D2 F, D3 F)', () => {
    const server = createServer();
    server.addHandler('orders/1', vi.fn());

    expect(server.getHandlerByPattern('users/1')).toBeNull();
  });

  it('does not decode a quoted topic as JSON (D1 F)', () => {
    const server = createServer();
    server.addHandler('admin/reset', vi.fn());

    expect(server.getHandlerByPattern('"admin/reset"')).toBeNull();
  });
});

/**
 * `removeHandlerKeySharedPrefix` decisions:
 * D1 `handlerKey` truthy AND startsWith('$share/')? -> prefix removed.
 */
describe('ServerMqtt.removeHandlerKeySharedPrefix', () => {
  it.each([
    ['$share/group/orders/#', 'orders/#'],
    ['$shared/group/orders/#', '$shared/group/orders/#'],
    ['orders/#', 'orders/#'],
    ['', ''],
  ])('normalizes %s to %s (D1)', (key, expected) => {
    const server = createServer();

    expect(server.removeHandlerKeySharedPrefix(key)).toBe(expected);
  });
});

// No decisions in the two pattern helpers.
describe('ServerMqtt.getRequestPattern', () => {
  it('returns the pattern untouched', () => {
    expect(createServer().getRequestPattern('orders')).toBe('orders');
  });
});

describe('ServerMqtt.getReplyPattern', () => {
  it('appends "/reply"', () => {
    expect(createServer().getReplyPattern('orders')).toBe('orders/reply');
  });
});

/**
 * `assertTopicLength` decisions:
 * D1 `byteLength > MQTT_MAX_TOPIC_LENGTH`? -> exception.
 */
describe('ServerMqtt.assertTopicLength', () => {
  it('accepts the maximum (D1 F)', () => {
    const server = createServer();

    expect(() =>
      asAny(server).assertTopicLength('a'.repeat(MQTT_MAX_TOPIC_LENGTH)),
    ).not.toThrow();
  });

  it('counts bytes (D1 T)', () => {
    const server = createServer();

    expect(() =>
      asAny(server).assertTopicLength(
        'é'.repeat(Math.ceil(MQTT_MAX_TOPIC_LENGTH / 2) + 1),
      ),
    ).toThrow(MaxMqttTopicLengthExceededException);
  });
});

/**
 * `registerErrorListener` decisions:
 * D1 `maxConnectionAttempts === -1`? D2 `hasConnected`? -> just log
 * D3 `++connectionAttempts === maxConnectionAttempts`? -> close + callback
 * D4 the callback is provided? D5 `err` provided? (fallback error)
 */
describe('ServerMqtt.registerErrorListener', () => {
  it('only logs when no limit is configured (D1 T)', () => {
    const server = createServer();
    const fake = createFakeClient();
    const close = vi.spyOn(server, 'close').mockResolvedValue(undefined);
    const callback = vi.fn();

    server.registerErrorListener(fake, callback);
    fake.emit('error', new Error('boom'));

    expect(close).not.toHaveBeenCalled();
    expect(callback).not.toHaveBeenCalled();
    expect(asAny(server).logger.error).toHaveBeenCalled();
  });

  it('only logs once connected (D1 F, D2 T)', () => {
    const server = createServer({ maxConnectionAttempts: 1 });
    asAny(server).hasConnected = true;
    const fake = createFakeClient();
    const close = vi.spyOn(server, 'close').mockResolvedValue(undefined);
    const callback = vi.fn();

    server.registerErrorListener(fake, callback);
    fake.emit('error', new Error('boom'));

    expect(close).not.toHaveBeenCalled();
    expect(callback).not.toHaveBeenCalled();
  });

  it('closes and reports only when the attempt limit is reached (D3 T)', () => {
    const server = createServer({ maxConnectionAttempts: 2 });
    const fake = createFakeClient();
    const close = vi.spyOn(server, 'close').mockResolvedValue(undefined);
    const callback = vi.fn();

    server.registerErrorListener(fake, callback);
    fake.emit('error', new Error('first')); // D3 F: 1 !== 2
    expect(close).not.toHaveBeenCalled();

    fake.emit('error', new Error('second')); // D3 T
    expect(close).toHaveBeenCalledOnce();
    expect(callback).toHaveBeenCalledWith(expect.any(Error));
  });

  it('tolerates a missing callback (D4 F) and a missing error (D5 F)', () => {
    const server = createServer({ maxConnectionAttempts: 1 });
    const fake = createFakeClient();
    vi.spyOn(server, 'close').mockResolvedValue(undefined);

    server.registerErrorListener(fake, undefined);
    expect(() => fake.emit('error', undefined)).not.toThrow();
    expect(asAny(server).logger.error).toHaveBeenCalled();
  });
});

// No decisions: the reconnect handler always sets the RECONNECTING status.
describe('ServerMqtt.registerReconnectListener', () => {
  it('emits RECONNECTING', () => {
    const server = createServer();
    const fake = createFakeClient();
    const status = captureStatus(server);

    server.registerReconnectListener(fake);
    fake.emit('reconnect');

    expect(status.statuses).toEqual(['reconnecting']);
    status.stop();
  });
});

// No decisions: the disconnect handler always sets DISCONNECTED.
describe('ServerMqtt.registerDisconnectListener', () => {
  it('emits DISCONNECTED', () => {
    const server = createServer();
    const fake = createFakeClient();
    const status = captureStatus(server);

    server.registerDisconnectListener(fake);
    fake.emit('disconnect');

    expect(status.statuses).toEqual(['disconnected']);
    status.stop();
  });
});

// No decisions: the close handler always sets CLOSED.
describe('ServerMqtt.registerCloseListener', () => {
  it('emits CLOSED', () => {
    const server = createServer();
    const fake = createFakeClient();
    const status = captureStatus(server);

    server.registerCloseListener(fake);
    fake.emit('close');

    expect(status.statuses).toEqual(['closed']);
    status.stop();
  });
});

// No decisions: the connect handler sets the flag and CONNECTED.
describe('ServerMqtt.registerConnectListener', () => {
  it('records the connection and emits CONNECTED', () => {
    const server = createServer();
    const fake = createFakeClient();
    const status = captureStatus(server);

    server.registerConnectListener(fake);
    fake.emit('connect');

    expect(asAny(server).hasConnected).toBe(true);
    expect(status.statuses).toEqual(['connected']);
    status.stop();
  });
});

/**
 * `unwrap` decisions:
 * D1 `!this.mqttClient`? -> throws before listen().
 */
describe('ServerMqtt.unwrap', () => {
  it('throws before listen() (D1 T)', () => {
    expect(() => createServer().unwrap()).toThrow(/listen/);
  });

  it('returns the client (D1 F)', () => {
    const server = createServer();
    const fake = createFakeClient();
    asAny(server).mqttClient = fake;

    expect(server.unwrap()).toBe(fake);
  });
});

/**
 * `on` decisions:
 * D1 `this.mqttClient` set? -> forwarded to it, else queued.
 */
describe('ServerMqtt.on', () => {
  it('queues the listener before listen() (D1 F)', () => {
    const server = createServer();
    const callback = vi.fn();

    server.on('close', callback);

    expect(asAny(server).pendingEventListeners).toEqual([
      { event: 'close', callback },
    ]);
  });

  it('forwards the listener to the client (D1 T)', () => {
    const server = createServer();
    const fake = createFakeClient();
    asAny(server).mqttClient = fake;
    const callback = vi.fn();

    server.on('close', callback);
    fake.emit('close');

    expect(callback).toHaveBeenCalledTimes(1);
    expect(asAny(server).pendingEventListeners).toEqual([]);
  });
});

/**
 * `initializeSerializer` decisions:
 * D1 `options?.serializer` provided?
 */
describe('ServerMqtt.initializeSerializer', () => {
  it('keeps a provided serializer (D1 T)', () => {
    const server = createServer();
    const serializer = { serialize: vi.fn() };

    asAny(server).initializeSerializer({ serializer });

    expect(asAny(server).serializer).toBe(serializer);
  });

  it.each([{}, undefined])('falls back to the default (D1 F)', options => {
    const server = createServer();

    asAny(server).initializeSerializer(options);

    expect(asAny(server).serializer).toBeInstanceOf(MqttRecordSerializer);
  });
});
