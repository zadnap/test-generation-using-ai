import { EventEmitter } from 'events';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CONNECTION_FAILED_MESSAGE,
  CONSUMER_CANCELLED_RMQ_MESSAGE,
  DISCONNECTED_RMQ_MESSAGE,
  NO_EVENT_HANDLER,
  NO_MESSAGE_HANDLER,
  RMQ_DEFAULT_QUEUE_OPTIONS,
  RMQ_DEFAULT_URL,
  RMQ_NO_EVENT_HANDLER,
  RMQ_NO_MESSAGE_HANDLER,
  UNBLOCKED_RMQ_MESSAGE,
} from '../../../../packages/microservices/constants.js';
import { RmqContext } from '../../../../packages/microservices/ctx-host/rmq.context.js';
import { RmqRecord } from '../../../../packages/microservices/record-builders/rmq.record-builder.js';
import { RmqRecordSerializer } from '../../../../packages/microservices/serializers/rmq-record.serializer.js';
import { IncomingRequestDeserializer } from '../../../../packages/microservices/deserializers/incoming-request.deserializer.js';
import { ServerRMQ } from '../../../../packages/microservices/server/server-rmq.js';

const asAny = (value: unknown) => value as any;
const flush = () => new Promise<void>(resolve => setImmediate(resolve));

/** The subset of the amqp-connection-manager manager that ServerRMQ touches. */
const createManagerFake = (overrides: Record<string, any> = {}) => {
  const manager = new EventEmitter() as any;
  manager.close = vi.fn().mockResolvedValue(undefined);
  manager.createChannel = vi.fn();
  return Object.assign(manager, overrides);
};

/** The subset of an amqplib channel that ServerRMQ touches. */
const createChannelFake = (overrides: Record<string, any> = {}) => {
  const channel: any = {
    assertQueue: vi.fn().mockResolvedValue({ queue: 'generated' }),
    assertExchange: vi.fn().mockResolvedValue(undefined),
    bindQueue: vi.fn().mockResolvedValue(undefined),
    prefetch: vi.fn().mockResolvedValue(undefined),
    consume: vi.fn().mockResolvedValue(undefined),
    sendToQueue: vi.fn().mockResolvedValue(undefined),
    nack: vi.fn(),
    close: vi.fn().mockResolvedValue(undefined),
  };
  channel.on = vi.fn();
  return Object.assign(channel, overrides);
};

const createServer = (options: any = {}) => {
  const server = new ServerRMQ(options);
  const logger = asAny(server).logger;
  vi.spyOn(logger, 'error').mockImplementation(() => {});
  vi.spyOn(logger, 'log').mockImplementation(() => {});
  vi.spyOn(logger, 'warn').mockImplementation(() => {});
  return server;
};

const captureStatus = (server: ServerRMQ) => {
  const statuses: string[] = [];
  const subscription = server.status.subscribe(status =>
    statuses.push(status as string),
  );
  return { statuses, stop: () => subscription.unsubscribe() };
};

/** Wires a fake connection manager and a no-op channel setup for `start()`. */
const startServer = async (options: any = {}, callback = vi.fn()) => {
  const server = createServer(options);
  const manager = createManagerFake();
  const channel = createChannelFake();
  manager.createChannel.mockReturnValue(channel);
  vi.spyOn(server, 'createClient').mockResolvedValue(manager);
  const setup = vi.spyOn(server, 'setupChannel').mockResolvedValue(undefined);

  await server.start(callback);

  return { server, manager, channel, callback, setup };
};

afterEach(() => {
  vi.restoreAllMocks();
});

/**
 * Constructor decisions:
 * D1 `urls` option present? -> custom or RMQ_DEFAULT_URL
 * D2 `queue` option present? -> custom or RMQ_DEFAULT_QUEUE ('')
 * D3 `noAck` option present? -> custom or RMQ_DEFAULT_NOACK (true)
 * D4 `queueOptions` option present? -> custom or RMQ_DEFAULT_QUEUE_OPTIONS
 * D5 `serializer` option present? D6 `deserializer` option present?
 */
describe('ServerRMQ.constructor', () => {
  it('applies the defaults (D1 F, D2 F, D3 F, D4 F, D5 F, D6 F)', () => {
    const server = new ServerRMQ({});

    expect(asAny(server).urls).toEqual([RMQ_DEFAULT_URL]);
    expect(asAny(server).queue).toBe('');
    expect(asAny(server).noAck).toBe(true);
    expect(asAny(server).queueOptions).toEqual(RMQ_DEFAULT_QUEUE_OPTIONS);
    expect(asAny(server).serializer).toBeInstanceOf(RmqRecordSerializer);
    expect(asAny(server).deserializer).toBeInstanceOf(
      IncomingRequestDeserializer,
    );
    // Transport.RMQ is the 6th member of a numeric enum.
    expect(asAny(server).transportId).toBe(5);
  });

  it('keeps the custom values (D1 T, D2 T, D3 T, D4 T, D5 T, D6 T)', () => {
    const serializer = { serialize: vi.fn() };
    const deserializer = { deserialize: vi.fn() };
    const queueOptions = { durable: false };
    const server = new ServerRMQ({
      urls: ['amqp://a', 'amqp://b'],
      queue: 'workers',
      noAck: false,
      queueOptions,
      serializer,
      deserializer,
    } as any);

    expect(asAny(server).urls).toEqual(['amqp://a', 'amqp://b']);
    expect(asAny(server).queue).toBe('workers');
    expect(asAny(server).noAck).toBe(false);
    expect(asAny(server).queueOptions).toBe(queueOptions);
    expect(asAny(server).serializer).toBe(serializer);
    expect(asAny(server).deserializer).toBe(deserializer);
  });
});

/**
 * `listen` decisions:
 * D1 `start()` resolves? -> nothing else happens, else the error is handed to
 * the callback (the try/catch).
 */
describe('ServerRMQ.listen', () => {
  it('starts with the callback (D1 T)', async () => {
    const server = createServer();
    const start = vi.spyOn(server, 'start').mockResolvedValue(undefined);
    const callback = vi.fn();

    await server.listen(callback);

    expect(start).toHaveBeenCalledWith(callback);
    expect(callback).not.toHaveBeenCalled();
  });

  it('passes a failure of start() to the callback (D1 F)', async () => {
    const server = createServer();
    const error = new Error('no broker');
    vi.spyOn(server, 'start').mockRejectedValue(error);
    const callback = vi.fn();

    await server.listen(callback);

    expect(callback).toHaveBeenCalledWith(error);
  });
});

/**
 * `start` decisions:
 * D1 a channel already exists? (connect handler) -> ignore the event
 * D2 `listenCallback` still pending? (channel "error") -> log and close
 * D3 `error.err` present? (connectFailed) -> log it too
 * D4 `maxConnectionAttempts === -1`? D5 `isReconnecting`? -> ignore the failure
 * D6 `++connectionAttempts === maxConnectionAttempts`? -> close + settle
 * D7 `error.err` present? -> use it, else a generic Error
 * Infeasible: none - the listeners are reached through the fake manager.
 */
describe('ServerRMQ.start', () => {
  it('creates the channel on the first connect and not again (D1 T/F)', async () => {
    const { server, manager, channel } = await startServer();
    const status = captureStatus(server);

    manager.emit('connect');
    manager.emit('connect');

    expect(manager.createChannel).toHaveBeenCalledTimes(1);
    expect(manager.createChannel).toHaveBeenCalledWith({
      json: false,
      setup: expect.any(Function),
    });
    expect(asAny(server).channel).toBe(channel);
    expect(status.statuses).toContain('connected');
    status.stop();
  });

  it('passes a setup wrapper that settles the listen callback once (D2 T/F)', async () => {
    const { manager, callback, setup } = await startServer();
    manager.emit('connect');
    const { setup: setupChannelFn } = manager.createChannel.mock.calls[0][0];
    const channel = createChannelFake();

    setupChannelFn(channel);

    expect(setup).toHaveBeenCalledWith(channel, expect.any(Function));
    const settle = setup.mock.calls[0][1];
    settle();
    settle('ignored');

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith();
  });

  it('logs, closes and fails listen on a channel error (D2 T)', async () => {
    const { server, manager, channel, callback } = await startServer();
    const error = new Error('setup failed');
    const close = vi.spyOn(server, 'close').mockResolvedValue(undefined);
    manager.emit('connect');
    const errorHandler = channel.on.mock.calls.find(
      ([event]: [string]) => event === 'error',
    )[1];

    errorHandler(error);
    await flush();

    expect(asAny(server).logger.error).toHaveBeenCalledWith(error);
    expect(close).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(error);
  });

  it('only logs a channel error once the callback settled (D2 F)', async () => {
    const { server, manager, channel, callback, setup } = await startServer();
    const error = new Error('late error');
    const close = vi.spyOn(server, 'close').mockResolvedValue(undefined);
    manager.emit('connect');
    const { setup: setupChannelFn } = manager.createChannel.mock.calls[0][0];
    setupChannelFn(createChannelFake());
    const errorHandler = channel.on.mock.calls.find(
      ([event]: [string]) => event === 'error',
    )[1];
    setup.mock.calls[0][1]();

    errorHandler(error);
    await flush();

    expect(asAny(server).logger.error).toHaveBeenCalledWith(error);
    expect(close).not.toHaveBeenCalled();
    // Settled by the test itself, not again by the error handler.
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith();
  });

  it('ignores connectFailed with infinite attempts (D4 T)', async () => {
    const { server, manager, callback } = await startServer();
    const close = vi.spyOn(server, 'close').mockResolvedValue(undefined);

    manager.emit('connectFailed', {});
    await flush();

    expect(asAny(server).logger.error).toHaveBeenCalledWith(
      CONNECTION_FAILED_MESSAGE,
    );
    expect(asAny(server).connectionAttempts).toBe(0);
    expect(close).not.toHaveBeenCalled();
    expect(callback).not.toHaveBeenCalled();
  });

  it('ignores connectFailed while reconnecting and logs the cause (D3 T, D5 T)', async () => {
    const { server, manager, callback } = await startServer({
      maxConnectionAttempts: 1,
    });
    const error = new Error('refused');
    const close = vi.spyOn(server, 'close').mockResolvedValue(undefined);
    manager.emit('connect');

    manager.emit('connectFailed', { err: error });
    await flush();

    expect(asAny(server).logger.error).toHaveBeenCalledWith(error);
    expect(close).not.toHaveBeenCalled();
    expect(callback).not.toHaveBeenCalled();
  });

  it('counts connectFailed attempts up to maxConnectionAttempts (D3 F, D6 T)', async () => {
    const { server, manager, callback } = await startServer({
      maxConnectionAttempts: 2,
    });
    const error = new Error('refused');
    const close = vi.spyOn(server, 'close').mockResolvedValue(undefined);

    manager.emit('connectFailed', { err: error });
    await flush();

    expect(asAny(server).connectionAttempts).toBe(1);
    expect(close).not.toHaveBeenCalled();

    manager.emit('connectFailed', { err: error });
    await flush();

    expect(asAny(server).connectionAttempts).toBe(2);
    expect(close).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(error);
  });

  it('fails with a generic error when connectFailed has no err (D7 F)', async () => {
    const { manager, callback } = await startServer({
      maxConnectionAttempts: 1,
    });

    manager.emit('connectFailed', {});
    await flush();

    expect(callback).toHaveBeenCalledTimes(1);
    const failure = callback.mock.calls[0][0];
    expect(failure).toBeInstanceOf(Error);
    expect(failure.message).toBe(CONNECTION_FAILED_MESSAGE);
  });

  it('resets the attempts and the channel and forwards queued listeners', async () => {
    const server = createServer();
    const manager = createManagerFake();
    manager.createChannel.mockReturnValue(createChannelFake());
    vi.spyOn(server, 'createClient').mockResolvedValue(manager);
    vi.spyOn(server, 'setupChannel').mockResolvedValue(undefined);
    asAny(server).connectionAttempts = 7;
    asAny(server).channel = createChannelFake();
    const listener = vi.fn();
    server.on('unblocked', listener);

    await server.start();

    expect(asAny(server).connectionAttempts).toBe(0);
    expect(asAny(server).channel).toBeNull();
    expect(asAny(server).pendingEventListeners).toEqual([]);
    manager.emit('unblocked');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('reports disconnect, blocked and unblocked (D3 F on all listeners)', async () => {
    const { server, manager } = await startServer();
    const status = captureStatus(server);

    manager.emit('disconnect', new Error('lost'));
    manager.emit('blocked', { reason: 'memory' });
    manager.emit('unblocked');

    expect(status.statuses).toEqual(['disconnected', 'blocked', 'unblocked']);
    expect(asAny(server).logger.error).toHaveBeenCalledWith(
      DISCONNECTED_RMQ_MESSAGE,
    );
    expect(asAny(server).logger.log).toHaveBeenCalledWith(
      UNBLOCKED_RMQ_MESSAGE,
    );
    status.stop();
  });
});

/**
 * `close` decisions:
 * D1 a channel exists? (optional call) D2 a server exists? (optional call)
 * D3 more than one rejection? -> the first is thrown, the rest logged.
 * The `finally` resetting the pending listeners has no alternative branch.
 */
describe('ServerRMQ.close', () => {
  it('closes the channel before the connection (D1 T, D2 T)', async () => {
    const server = createServer();
    const order: string[] = [];
    asAny(server).channel = {
      close: vi.fn(async () => {
        order.push('channel');
      }),
    };
    asAny(server).server = {
      close: vi.fn(async () => {
        order.push('server');
      }),
    };

    await server.close();

    expect(order).toEqual(['channel', 'server']);
  });

  it('accepts a missing channel and connection (D1 F, D2 F)', async () => {
    const server = createServer();

    await expect(server.close()).resolves.toBeUndefined();
  });

  it('throws the first failure and logs the others (D3 T)', async () => {
    const server = createServer();
    const channelError = new Error('channel close failed');
    const serverError = new Error('server close failed');
    asAny(server).channel = { close: vi.fn().mockRejectedValue(channelError) };
    asAny(server).server = { close: vi.fn().mockRejectedValue(serverError) };

    await expect(server.close()).rejects.toBe(channelError);
    expect(asAny(server).logger.error).toHaveBeenCalledWith(serverError);
    expect(asAny(server).pendingEventListeners).toEqual([]);
  });

  it('throws a connection failure alone (D3 F)', async () => {
    const server = createServer();
    const serverError = new Error('server close failed');
    asAny(server).channel = { close: vi.fn().mockResolvedValue(undefined) };
    asAny(server).server = { close: vi.fn().mockRejectedValue(serverError) };

    await expect(server.close()).rejects.toBe(serverError);
    expect(asAny(server).logger.error).not.toHaveBeenCalled();
  });

  it('drops the pending listeners even when close fails', async () => {
    const server = createServer();
    const failure = new Error('failed');
    asAny(server).channel = { close: vi.fn().mockRejectedValue(failure) };
    server.on('unblocked', vi.fn());

    await expect(server.close()).rejects.toBe(failure);

    expect(asAny(server).pendingEventListeners).toEqual([]);
  });
});

/**
 * `createClient` decisions:
 * D1 `socketOptions` option present? -> its fields are forwarded (undefined
 * otherwise); the package loads themselves are stubbed through `loadPackage`.
 */
describe('ServerRMQ.createClient', () => {
  it('loads amqplib and amqp-connection-manager and maps the socket options (D1 T)', async () => {
    const socketOptions = {
      connectionOptions: { noDelay: true },
      heartbeatIntervalInSeconds: 5,
      reconnectTimeInSeconds: 2,
    };
    const server = createServer({ urls: ['amqp://a'], socketOptions });
    const connect = vi.fn().mockReturnValue('manager');
    const load = vi
      .spyOn(asAny(server), 'loadPackage')
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({ connect });

    const client = await server.createClient();

    expect(client).toBe('manager');
    expect(load).toHaveBeenNthCalledWith(
      1,
      'amqplib',
      'ServerRMQ',
      expect.any(Function),
    );
    expect(load).toHaveBeenNthCalledWith(
      2,
      'amqp-connection-manager',
      'ServerRMQ',
      expect.any(Function),
    );
    expect(connect).toHaveBeenCalledWith(['amqp://a'], socketOptions);
  });

  it('uses the default url without socket options (D1 F)', async () => {
    const server = createServer();
    const connect = vi.fn().mockReturnValue('manager');
    vi.spyOn(asAny(server), 'loadPackage')
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({ connect });

    await server.createClient();

    expect(connect).toHaveBeenCalledWith([RMQ_DEFAULT_URL], {
      connectionOptions: undefined,
      heartbeatIntervalInSeconds: undefined,
      reconnectTimeInSeconds: undefined,
    });
  });
});

/**
 * `setupChannel` decisions:
 * D1 `queue === RMQ_DEFAULT_QUEUE`? D2 `!noAssert`? -> assertQueue and use the
 *    queue name returned by the broker
 * D3 `exchange || wildcards`? -> assertExchange (D8: exchange falls back to
 *    options.queue, D9: exchangeType falls back to 'topic')
 * D4 `routingKey || exchangeType === 'fanout'`? -> bindQueue
 * D5 `exchangeType === 'fanout'`? -> '' as the binding key
 * D6 `wildcards`? -> bind every handler key and initialize wildcards
 * D7 `getOptionsProp(noAck, ...)` falls back to RMQ_DEFAULT_NOACK; the
 *    consumerTag default is not a branch.
 * Infeasible: the queue branch with a non-string queue name - `queue` is typed
 * as a string; only the runtime value matters, which is covered by ''/named.
 */
describe('ServerRMQ.setupChannel', () => {
  it('asserts a named queue and consumes the queue returned by the broker (D1 F, D2 T)', async () => {
    const server = createServer({ queue: 'workers' });
    const channel = createChannelFake();
    const callback = vi.fn();

    await server.setupChannel(channel, callback);

    expect(channel.assertQueue).toHaveBeenCalledWith(
      'workers',
      RMQ_DEFAULT_QUEUE_OPTIONS,
    );
    expect(channel.assertExchange).not.toHaveBeenCalled();
    expect(channel.prefetch).toHaveBeenCalledWith(0, false);
    expect(channel.consume).toHaveBeenCalledWith(
      'generated',
      expect.any(Function),
      { noAck: true, consumerTag: undefined },
    );
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('asserts the default queue even for noAssert (D1 T, D2 T)', async () => {
    const server = createServer({ noAck: true, noAssert: true });
    const channel = createChannelFake();

    await server.setupChannel(channel, vi.fn());

    expect(channel.assertQueue).toHaveBeenCalledWith(
      '',
      RMQ_DEFAULT_QUEUE_OPTIONS,
    );
  });

  it('skips assertQueue for a named queue with noAssert (D1 F, D2 F)', async () => {
    const server = createServer({ queue: 'workers', noAssert: true });
    const channel = createChannelFake();

    await server.setupChannel(channel, vi.fn());

    expect(channel.assertQueue).not.toHaveBeenCalled();
    expect(channel.consume.mock.calls[0][0]).toBe('workers');
  });

  it('takes noAssert from queueOptions (D2 F via queueOptions)', async () => {
    const server = createServer({
      queue: 'workers',
      queueOptions: { noAssert: true },
    });
    const channel = createChannelFake();

    await server.setupChannel(channel, vi.fn());

    expect(channel.assertQueue).not.toHaveBeenCalled();
  });

  it('declares the exchange and binds the routing key (D3 T, D4 T, D5 F)', async () => {
    const server = createServer({
      queue: 'workers',
      exchange: 'orders',
      routingKey: 'created',
    });
    const channel = createChannelFake();

    await server.setupChannel(channel, vi.fn());

    expect(channel.assertExchange).toHaveBeenCalledWith('orders', 'topic', {
      durable: true,
      arguments: {},
    });
    expect(channel.bindQueue).toHaveBeenCalledWith(
      'generated',
      'orders',
      'created',
    );
  });

  it('binds fanout exchanges with an empty key (D4 T via fanout, D5 T)', async () => {
    const server = createServer({
      queue: 'workers',
      exchange: 'orders',
      exchangeType: 'fanout',
    });
    const channel = createChannelFake();

    await server.setupChannel(channel, vi.fn());

    expect(channel.bindQueue).toHaveBeenCalledWith('generated', 'orders', '');
  });

  it('does not bind without a routing key or fanout (D4 F)', async () => {
    const server = createServer({ queue: 'workers', exchange: 'orders' });
    const channel = createChannelFake();

    await server.setupChannel(channel, vi.fn());

    expect(channel.assertExchange).toHaveBeenCalled();
    expect(channel.bindQueue).not.toHaveBeenCalled();
  });

  it('forwards the exchange arguments (D3 T, D9 T)', async () => {
    const server = createServer({
      queue: 'workers',
      exchange: 'orders',
      exchangeType: 'direct',
      exchangeArguments: { 'x-delayed-type': 'direct' },
    });
    const channel = createChannelFake();

    await server.setupChannel(channel, vi.fn());

    expect(channel.assertExchange).toHaveBeenCalledWith('orders', 'direct', {
      durable: true,
      arguments: { 'x-delayed-type': 'direct' },
    });
  });

  it('uses the queue name as the exchange for wildcards and binds every handler (D3 T, D6 T, D8 T, D9 F)', async () => {
    const server = createServer({ queue: 'workers', wildcards: true });
    server.addHandler('a.#', vi.fn());
    server.addHandler('b.plain', vi.fn());
    const channel = createChannelFake();

    await server.setupChannel(channel, vi.fn());

    expect(channel.assertExchange).toHaveBeenCalledWith('workers', 'topic', {
      durable: true,
      arguments: {},
    });
    expect(channel.bindQueue).toHaveBeenCalledWith(
      'generated',
      'workers',
      'a.#',
    );
    expect(channel.bindQueue).toHaveBeenCalledWith(
      'generated',
      'workers',
      'b.plain',
    );
    expect(Array.from(asAny(server).wildcardHandlers.keys())).toEqual(['a.#']);
  });

  it('does not touch exchanges without an exchange or wildcards (D3 F)', async () => {
    const server = createServer({ queue: 'workers' });
    const channel = createChannelFake();

    await server.setupChannel(channel, vi.fn());

    expect(channel.assertExchange).not.toHaveBeenCalled();
    expect(channel.bindQueue).not.toHaveBeenCalled();
  });

  it('passes the prefetch and consume options (D7 T)', async () => {
    const server = createServer({
      queue: 'workers',
      noAck: false,
      prefetchCount: 5,
      isGlobalPrefetchCount: true,
      consumerTag: 'tag',
    });
    const channel = createChannelFake();

    await server.setupChannel(channel, vi.fn());

    expect(channel.prefetch).toHaveBeenCalledWith(5, true);
    expect(channel.consume).toHaveBeenCalledWith(
      'generated',
      expect.any(Function),
      { noAck: false, consumerTag: 'tag' },
    );
  });

  it('routes consumed messages to handleMessage and failures to handleError', async () => {
    const server = createServer({ queue: 'workers' });
    const channel = createChannelFake();
    const handleMessage = vi
      .spyOn(server, 'handleMessage')
      .mockRejectedValue(new Error('consumer failed'));
    const handleError = vi
      .spyOn(asAny(server), 'handleError')
      .mockImplementation(() => {});

    await server.setupChannel(channel, vi.fn());
    const consumeCallback = channel.consume.mock.calls[0][1];
    const message = { content: Buffer.from('{}'), properties: {} };
    consumeCallback(message);
    await flush();

    expect(handleMessage).toHaveBeenCalledWith(message, channel);
    expect(handleError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'consumer failed' }),
    );
  });
});

/**
 * `handleMessage` decisions:
 * D1 `isNil(message)`? -> log and set the channel up again
 * D2 `packet.id` undefined? -> event path
 * D3 a handler exists? -> request path, else reply with NO_MESSAGE_HANDLER
 * D4 `!noAck`? -> nack (and warn) the unsupported message
 * The try/catch on deserialize does not exist here: a rejecting deserializer
 * propagates to the consumer callback (covered by setupChannel's handleError).
 */
describe('ServerRMQ.handleMessage', () => {
  const createMessage = (body: unknown) => ({
    content: Buffer.from(JSON.stringify(body)),
    properties: { replyTo: 'reply-queue', correlationId: 'correlation-id' },
  });

  it('re-consumes when the broker cancels the consumer (D1 T)', async () => {
    const server = createServer();
    const channel = createChannelFake();
    const setup = vi.spyOn(server, 'setupChannel').mockResolvedValue(undefined);

    await server.handleMessage(null as any, channel);

    expect(asAny(server).logger.error).toHaveBeenCalledWith(
      CONSUMER_CANCELLED_RMQ_MESSAGE,
    );
    expect(setup).toHaveBeenCalledWith(channel, expect.any(Function));
  });

  it('dispatches an event packet without an id (D1 F, D2 T)', async () => {
    const server = createServer();
    const channel = createChannelFake();
    const handleEvent = vi.spyOn(server, 'handleEvent').mockResolvedValue(null);
    const message = createMessage({ pattern: 'events', data: { a: 1 } });

    await server.handleMessage(message, channel);

    expect(handleEvent).toHaveBeenCalledWith(
      'events',
      { pattern: 'events', data: { a: 1 } },
      expect.any(RmqContext),
    );
    const context = handleEvent.mock.calls[0][2];
    expect(context.getMessage()).toBe(message);
    expect(context.getChannelRef()).toBe(channel);
  });

  it('nacks and answers an unsupported request when noAck is false (D2 F, D3 F, D4 T)', async () => {
    const server = createServer({ noAck: false });
    const channel = createChannelFake();
    asAny(server).channel = channel;
    const sendMessage = vi.spyOn(server, 'sendMessage').mockResolvedValue(null);
    const message = createMessage({ pattern: 'missing', id: '42' });

    await server.handleMessage(message, channel);

    expect(channel.nack).toHaveBeenCalledWith(message, false, false);
    expect(asAny(server).logger.warn).toHaveBeenCalledWith(
      RMQ_NO_MESSAGE_HANDLER`${'missing'}`,
    );
    expect(sendMessage).toHaveBeenCalledWith(
      { id: '42', err: NO_MESSAGE_HANDLER, status: 'error' },
      'reply-queue',
      'correlation-id',
      expect.any(RmqContext),
    );
  });

  it('still answers an unsupported request when noAck is true (D4 F)', async () => {
    const server = createServer({ noAck: true });
    const channel = createChannelFake();
    asAny(server).channel = channel;
    const sendMessage = vi.spyOn(server, 'sendMessage').mockResolvedValue(null);

    await server.handleMessage(
      createMessage({ pattern: 'missing', id: 1 }),
      channel,
    );

    expect(channel.nack).not.toHaveBeenCalled();
    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1, err: NO_MESSAGE_HANDLER }),
      'reply-queue',
      'correlation-id',
      expect.any(RmqContext),
    );
  });

  it('runs the handler and replies through sendMessage (D3 T)', async () => {
    const server = createServer();
    const channel = createChannelFake();
    const sendMessage = vi.spyOn(server, 'sendMessage').mockResolvedValue(null);
    server.addHandler('sum', async (data: any) => data.a + data.b);

    await server.handleMessage(
      createMessage({ pattern: 'sum', data: { a: 1, b: 2 }, id: '1' }),
      channel,
    );
    await flush();

    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(sendMessage).toHaveBeenCalledWith(
      { response: 3, isDisposed: true },
      'reply-queue',
      'correlation-id',
      expect.any(RmqContext),
    );
  });

  it('answers a rejected handler with an error, then rethrows', async () => {
    const server = createServer();
    const channel = createChannelFake();
    const sendMessage = vi.spyOn(server, 'sendMessage').mockResolvedValue(null);
    server.addHandler('sum', async () => {
      throw new Error('boom');
    });

    await expect(
      server.handleMessage(
        createMessage({ pattern: 'sum', data: {}, id: '1' }),
        channel,
      ),
    ).rejects.toThrow('boom');
    await flush();

    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        err: expect.objectContaining({ status: 'error' }),
      }),
      'reply-queue',
      'correlation-id',
      expect.any(RmqContext),
    );
  });

  it('treats non-JSON content as the payload and dispatches an event', async () => {
    const server = createServer();
    const channel = createChannelFake();
    const handleEvent = vi.spyOn(server, 'handleEvent').mockResolvedValue(null);
    const message = {
      content: Buffer.from('not-json'),
      properties: { channel: 'raw' },
    };

    await server.handleMessage(message, channel);

    expect(handleEvent).toHaveBeenCalledWith(
      'raw',
      { pattern: 'raw', data: 'not-json' },
      expect.any(RmqContext),
    );
  });
});

/**
 * `handleEvent` decisions:
 * D1 a handler exists? D2 `!noAck`? -> nack and warn, otherwise fall through
 * to the base event handling (which logs the missing handler).
 */
describe('ServerRMQ.handleEvent', () => {
  const createContext = (channel: any, pattern = 'events') => {
    const message = { content: Buffer.from('{}'), properties: {} };
    return new RmqContext([message, channel, pattern]);
  };

  it('nacks an unsupported event when noAck is false (D1 T, D2 T)', async () => {
    const server = createServer({ noAck: false });
    const channel = createChannelFake();
    asAny(server).channel = channel;
    const context = createContext(channel);

    await server.handleEvent('events', { data: {} } as any, context);

    expect(channel.nack).toHaveBeenCalledWith(
      context.getMessage(),
      false,
      false,
    );
    expect(asAny(server).logger.warn).toHaveBeenCalledWith(
      RMQ_NO_EVENT_HANDLER`${'events'}`,
    );
  });

  it('logs an unsupported event when noAck is true (D1 T, D2 F)', async () => {
    const server = createServer({ noAck: true });
    const channel = createChannelFake();
    asAny(server).channel = channel;

    await server.handleEvent(
      'events',
      { data: {} } as any,
      createContext(channel),
    );

    expect(channel.nack).not.toHaveBeenCalled();
    expect(asAny(server).logger.error).toHaveBeenCalledWith(
      NO_EVENT_HANDLER`${'events'}`,
    );
  });

  it('runs the matching event handler (D1 F)', async () => {
    const server = createServer();
    const channel = createChannelFake();
    const handler = vi.fn().mockResolvedValue(undefined);
    server.addHandler('events', handler, true);
    const context = createContext(channel);

    await server.handleEvent('events', { data: { a: 1 } } as any, context);

    expect(handler).toHaveBeenCalledWith({ a: 1 }, context);
  });
});

/**
 * `sendMessage` decisions:
 * D1 `replyTo` too long? D2 `correlationId` too long? -> drop and log
 * D3 the value is a string? (only strings are measured)
 * D4 the serializer produced options? -> merged into the publish options.
 */
describe('ServerRMQ.sendMessage', () => {
  const createContext = () => new RmqContext([{}, {}, 'pattern']);

  it('serializes the message and sends it to the reply queue (D1 F, D2 F, D4 F)', async () => {
    const server = createServer();
    const channel = createChannelFake();
    asAny(server).channel = channel;

    await server.sendMessage(
      { response: 'ok' },
      'reply-queue',
      'cid',
      createContext(),
    );

    expect(channel.sendToQueue).toHaveBeenCalledWith(
      'reply-queue',
      Buffer.from(JSON.stringify({ response: 'ok' })),
      { correlationId: 'cid' },
    );
  });

  it('merges the options of an RmqRecord reply (D4 T)', async () => {
    const server = createServer();
    const channel = createChannelFake();
    asAny(server).channel = channel;

    await server.sendMessage(
      { response: new RmqRecord('ok', { persistent: true }) } as any,
      'reply-queue',
      'cid',
      createContext(),
    );

    expect(channel.sendToQueue).toHaveBeenCalledWith(
      'reply-queue',
      Buffer.from(JSON.stringify({ response: 'ok' })),
      { persistent: true, correlationId: 'cid' },
    );
  });

  it.each([
    ['replyTo', 'a'.repeat(256), 'cid'],
    ['correlationId', 'reply-queue', 'b'.repeat(256)],
  ])(
    'drops a reply whose %s exceeds 255 bytes (D1 T or D2 T)',
    async (_label, replyTo, correlationId) => {
      const server = createServer();
      const channel = createChannelFake();
      asAny(server).channel = channel;

      await expect(
        server.sendMessage(
          { response: 'ok' },
          replyTo,
          correlationId,
          createContext(),
        ),
      ).resolves.toBeUndefined();

      expect(channel.sendToQueue).not.toHaveBeenCalled();
      expect(asAny(server).logger.error).toHaveBeenCalledWith(
        expect.stringContaining('longer than 255 bytes'),
      );
    },
  );

  it('sends a 255-byte value (D1 F boundary)', async () => {
    const server = createServer();
    const channel = createChannelFake();
    asAny(server).channel = channel;
    const value = 'a'.repeat(255);

    await server.sendMessage({ response: 'ok' }, value, 'cid', createContext());

    expect(channel.sendToQueue).toHaveBeenCalled();
  });

  it('does not measure non-string values (D3 F)', async () => {
    const server = createServer();
    const channel = createChannelFake();
    asAny(server).channel = channel;

    await server.sendMessage(
      { response: 'ok' },
      42,
      undefined as any,
      createContext(),
    );

    expect(channel.sendToQueue).toHaveBeenCalledWith(42, expect.any(Buffer), {
      correlationId: undefined,
    });
  });
});

/**
 * `on` decisions:
 * D1 the connection exists already? -> forward, else queue until start().
 */
describe('ServerRMQ.on', () => {
  it('queues listeners before start() (D1 F)', () => {
    const server = createServer();
    const callback = vi.fn();

    server.on('unblocked', callback);

    expect(asAny(server).pendingEventListeners).toEqual([
      { event: 'unblocked', callback },
    ]);
  });

  it('forwards listeners once the connection exists (D1 T)', () => {
    const server = createServer();
    const manager = createManagerFake();
    asAny(server).server = manager;
    const callback = vi.fn();

    server.on('unblocked', callback);

    expect(manager.listenerCount('unblocked')).toBe(1);
    manager.emit('unblocked');
    expect(callback).toHaveBeenCalledTimes(1);
  });
});

/**
 * `unwrap` decisions:
 * D1 `!this.server`? -> throw before start().
 */
describe('ServerRMQ.unwrap', () => {
  it('throws before start() (D1 T)', () => {
    expect(() => createServer().unwrap()).toThrow(/listen/);
  });

  it('returns the connection manager (D1 F)', () => {
    const server = createServer();
    const manager = createManagerFake();
    asAny(server).server = manager;

    expect(server.unwrap()).toBe(manager);
  });
});

/**
 * `getHandlerByPattern` decisions:
 * D1 `wildcards` disabled? -> delegate to the base lookup
 * D2 an exact handler exists? -> return it
 * D3 the wildcard handler map is empty? -> null
 * D4 a wildcard pattern matches? -> return its handler, else null.
 */
describe('ServerRMQ.getHandlerByPattern', () => {
  it('delegates to the exact lookup without wildcards (D1 F)', () => {
    const server = createServer();
    const handler = vi.fn();
    server.addHandler('plain', handler);

    expect(server.getHandlerByPattern('plain')).toBe(handler);
    expect(server.getHandlerByPattern('missing')).toBeNull();
  });

  it('finds an exact handler first with wildcards enabled (D1 T, D2 T)', () => {
    const server = createServer({ wildcards: true });
    const handler = vi.fn();
    server.addHandler('plain', handler);

    expect(server.getHandlerByPattern('plain')).toBe(handler);
  });

  it('returns null when the wildcard map is empty (D2 F, D3 T)', () => {
    const server = createServer({ wildcards: true });

    expect(server.getHandlerByPattern('missing')).toBeNull();
  });

  it('matches a wildcard handler (D3 F, D4 T)', () => {
    const server = createServer({ wildcards: true });
    const handler = vi.fn();
    asAny(server).wildcardHandlers.set('a.#', handler);

    expect(server.getHandlerByPattern('a.b.c')).toBe(handler);
  });

  it('returns null when no wildcard matches (D4 F)', () => {
    const server = createServer({ wildcards: true });
    asAny(server).wildcardHandlers.set('a.*', vi.fn());

    expect(server.getHandlerByPattern('b.c')).toBeNull();
  });
});

/**
 * `initializeWildcardHandlersIfExist` decisions:
 * D1 the wildcard map is already filled? -> return
 * D2 the handler pattern is a string?
 * D3/4 it contains '#' or '*'.
 */
describe('ServerRMQ.initializeWildcardHandlersIfExist', () => {
  it('keeps an already initialized map (D1 T)', () => {
    const server = createServer({ wildcards: true });
    const handler = vi.fn();
    asAny(server).wildcardHandlers.set('a.#', handler);
    server.addHandler('b.#', vi.fn());

    asAny(server).initializeWildcardHandlersIfExist();

    expect(Array.from(asAny(server).wildcardHandlers.keys())).toEqual(['a.#']);
  });

  it('collects only string patterns with a wildcard (D1 F, D2, D3, D4)', () => {
    const server = createServer({ wildcards: true });
    const all = vi.fn();
    const single = vi.fn();
    const plain = vi.fn();
    const nonString = vi.fn();
    asAny(server).messageHandlers.set('a.#', all);
    asAny(server).messageHandlers.set('b.*', single);
    asAny(server).messageHandlers.set('c.plain', plain);
    asAny(server).messageHandlers.set(123, nonString);

    asAny(server).initializeWildcardHandlersIfExist();

    expect(Array.from(asAny(server).wildcardHandlers.keys())).toEqual([
      'a.#',
      'b.*',
    ]);
    expect(asAny(server).wildcardHandlers.get('a.#')).toBe(all);
    expect(asAny(server).wildcardHandlers.get('b.*')).toBe(single);
  });
});

/**
 * `matchRmqPattern` decisions:
 * D1 the pattern is empty? D2 the routing key is empty? -> no segments
 * D3 the pattern segment is '#'? (the "zero or more" branch)
 * D4 the pattern segment is '*' or equal to the routing key segment?
 * D5 another column of the row is true? (early false)
 * D6 the last column matches after all segments?
 * The dynamic-programming boundaries (zero segments, trailing '#') are covered
 * by the table; every row is reachable through getHandlerByPattern.
 */
describe('ServerRMQ.matchRmqPattern', () => {
  it.each([
    ['#', '', true],
    ['#', 'a.b', true],
    ['', '', true],
    ['', 'a', false],
    ['a.b', 'a.b', true],
    ['a.b', 'a.c', false],
    ['a.*', 'a.b', true],
    ['a.*', 'a', false],
    ['a.*', 'a.b.c', false],
    ['*', 'a', true],
    ['a.#', 'a.b.c', true],
    ['a.#', 'a', true],
    ['a.#.c', 'a.c', true],
    ['a.#.c', 'a.b.c', true],
    ['a.#.c', 'a.d', false],
    ['#.b', 'a.b', true],
    ['a.*.c', 'a.b.c', true],
    ['a.*.c', 'a.b.d', false],
    ['a.b', 'c.d', false],
  ])('%s matches %s -> %s (D1-D6)', (pattern, routingKey, expected) => {
    const server = createServer();

    expect(asAny(server).matchRmqPattern(pattern, routingKey)).toBe(expected);
  });
});

/**
 * `parseMessageContent` decisions:
 * D1 `JSON.parse` succeeds? -> the parsed value, else the raw string.
 */
describe('ServerRMQ.parseMessageContent', () => {
  it('parses JSON content (D1 T)', () => {
    const server = createServer();

    expect(
      asAny(server).parseMessageContent(Buffer.from('{"pattern":"a"}')),
    ).toEqual({ pattern: 'a' });
  });

  it('returns the raw string for invalid JSON (D1 F)', () => {
    const server = createServer();

    expect(asAny(server).parseMessageContent(Buffer.from('not-json'))).toBe(
      'not-json',
    );
  });
});
