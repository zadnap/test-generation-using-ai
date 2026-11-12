import { EventEmitter } from 'events';
import { ReplaySubject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ClientRMQ } from '../../../../packages/microservices/client/client-rmq.js';
import {
  RMQ_DEFAULT_NO_ASSERT,
  RMQ_DEFAULT_NOACK,
  RMQ_DEFAULT_PERSISTENT,
  RMQ_DEFAULT_PREFETCH_COUNT,
  RMQ_DEFAULT_QUEUE,
  RMQ_DEFAULT_QUEUE_OPTIONS,
  RMQ_DEFAULT_URL,
} from '../../../../packages/microservices/constants.js';
import { RmqRecord } from '../../../../packages/microservices/record-builders/rmq.record-builder.js';
import { RmqRecordSerializer } from '../../../../packages/microservices/serializers/rmq-record.serializer.js';
import { IncomingResponseDeserializer } from '../../../../packages/microservices/deserializers/incoming-response.deserializer.js';

// `connect()` loads both packages through `loadPackage()` (`import()`); the
// factories keep the real packages (and their sockets / retry timers) out.
const { amqpConnect } = vi.hoisted(() => ({ amqpConnect: vi.fn() }));
vi.mock('amqplib', () => ({ connect: vi.fn() }));
vi.mock('amqp-connection-manager', () => ({ connect: amqpConnect }));

const REPLY_QUEUE = 'amq.rabbitmq.reply-to';

const asAny = (value: unknown) => value as any;
const flush = () => new Promise<void>(resolve => setImmediate(resolve));

const createManagerFake = (overrides: Record<string, any> = {}) => {
  const manager = new EventEmitter() as any;
  manager.close = vi.fn().mockResolvedValue(undefined);
  manager.createChannel = vi.fn();
  return Object.assign(manager, overrides);
};

const createClient = (options: any = {}) => {
  const client = new ClientRMQ(options);
  const logger = asAny(client).logger;
  vi.spyOn(logger, 'error').mockImplementation(() => {});
  vi.spyOn(logger, 'log').mockImplementation(() => {});
  vi.spyOn(logger, 'warn').mockImplementation(() => {});
  return client;
};

const captureStatus = (client: ClientRMQ) => {
  const statuses: string[] = [];
  const subscription = client.status.subscribe(status =>
    statuses.push(status as string),
  );
  return { statuses, stop: () => subscription.unsubscribe() };
};

/** Connects with a fake manager and a channel setup that resolves at once. */
const connectWith = async (
  client: ClientRMQ,
  manager = createManagerFake(),
) => {
  const createStub = vi
    .spyOn(client, 'createClient')
    .mockReturnValue(manager as any);
  vi.spyOn(client, 'createChannel').mockResolvedValue(undefined);
  const attempt = client.connect();
  await flush();
  manager.emit('connect');
  await attempt;
  createStub.mockRestore();
  return manager;
};

/**
 * Constructor decisions:
 * D1 `queue` option present? -> RMQ_DEFAULT_QUEUE
 * D2 `queueOptions` option present? -> RMQ_DEFAULT_QUEUE_OPTIONS
 * D3 `replyQueue` option present? -> 'amq.rabbitmq.reply-to'
 * D4 `noAssert` option present? D5 `queueOptions.noAssert` present?
 *    -> RMQ_DEFAULT_NO_ASSERT
 * D6 `serializer` present? D7 `deserializer` present?
 */
describe('ClientRMQ.constructor', () => {
  it('applies every default (D1..D7 F)', () => {
    const client = new ClientRMQ({});

    expect(asAny(client).queue).toBe(RMQ_DEFAULT_QUEUE);
    expect(asAny(client).queueOptions).toBe(RMQ_DEFAULT_QUEUE_OPTIONS);
    expect(asAny(client).replyQueue).toBe(REPLY_QUEUE);
    expect(asAny(client).noAssert).toBe(RMQ_DEFAULT_NO_ASSERT);
    expect(asAny(client).serializer).toBeInstanceOf(RmqRecordSerializer);
    expect(asAny(client).deserializer).toBeInstanceOf(
      IncomingResponseDeserializer,
    );
  });

  it('keeps every custom option (D1..D7 T)', () => {
    const serializer = { serialize: vi.fn() };
    const deserializer = { deserialize: vi.fn() };
    const client = new ClientRMQ({
      queue: 'workers',
      queueOptions: { durable: true },
      replyQueue: 'replies',
      noAssert: true,
      serializer,
      deserializer,
    } as any);

    expect(asAny(client).queue).toBe('workers');
    expect(asAny(client).queueOptions).toEqual({ durable: true });
    expect(asAny(client).replyQueue).toBe('replies');
    expect(asAny(client).noAssert).toBe(true);
    expect(asAny(client).serializer).toBe(serializer);
    expect(asAny(client).deserializer).toBe(deserializer);
  });

  it('reads noAssert from queueOptions when the option is absent (D4 F, D5 T)', () => {
    const client = new ClientRMQ({
      queueOptions: { noAssert: true },
    } as any);

    expect(asAny(client).noAssert).toBe(true);
  });

  it('keeps an explicit noAssert false (D4 T)', () => {
    const client = new ClientRMQ({ noAssert: false } as any);

    expect(asAny(client).noAssert).toBe(false);
  });
});

/**
 * `close` decisions:
 * D1 `channel` set? D2 `client` set? (optional chains) -> close() awaited
 * D3 any close rejected? -> the first rejection is rethrown
 * D4 more than one rejection? -> the others are logged
 * The state is reset in `finally` in every case.
 */
describe('ClientRMQ.close', () => {
  it('closes the channel and the connection and resets the state (D1 T, D2 T, D3 F)', async () => {
    const client = createClient();
    const channel = { close: vi.fn().mockResolvedValue(undefined) };
    const manager = { close: vi.fn().mockResolvedValue(undefined) };
    asAny(client).channel = channel;
    asAny(client).client = manager;
    asAny(client).isInitialConnect = false;
    asAny(client).pendingEventListeners.push({ event: 'x', callback: vi.fn() });

    await client.close();

    expect(channel.close).toHaveBeenCalledTimes(1);
    expect(manager.close).toHaveBeenCalledTimes(1);
    expect(channel.close.mock.invocationCallOrder[0]).toBeLessThan(
      manager.close.mock.invocationCallOrder[0],
    );
    expect(asAny(client).channel).toBeNull();
    expect(asAny(client).client).toBeNull();
    expect(asAny(client).isInitialConnect).toBe(true);
    expect(asAny(client).pendingEventListeners).toEqual([]);
  });

  it('tolerates a channel and a connection that were never created (D1 F, D2 F, D3 F)', async () => {
    const client = createClient();

    await expect(client.close()).resolves.toBeUndefined();
  });

  it('still closes the connection and rethrows when the channel close fails (D1 T, D2 T, D3 T)', async () => {
    const client = createClient();
    const error = new Error('channel close failed');
    const channel = { close: vi.fn().mockRejectedValue(error) };
    const manager = { close: vi.fn().mockResolvedValue(undefined) };
    asAny(client).channel = channel;
    asAny(client).client = manager;

    await expect(client.close()).rejects.toBe(error);

    expect(manager.close).toHaveBeenCalledTimes(1);
    expect(asAny(client).channel).toBeNull();
    expect(asAny(client).client).toBeNull();
    expect(asAny(client).isInitialConnect).toBe(true);
  });

  it('fails every pending request and logs the second failure (D3 T, D4 T)', async () => {
    const client = createClient();
    const channelError = new Error('channel close failed');
    const connectionError = new Error('connection close failed');
    asAny(client).channel = { close: vi.fn().mockRejectedValue(channelError) };
    asAny(client).client = {
      close: vi.fn().mockRejectedValue(connectionError),
    };
    const callback = vi.fn();
    asAny(client).routingMap.set('id', callback);

    await expect(client.close()).rejects.toBe(channelError);

    expect(asAny(client).logger.error).toHaveBeenCalledWith(connectionError);
    expect(callback).toHaveBeenCalledWith({
      err: expect.objectContaining({ message: 'Connection closed' }),
    });
  });
});

/**
 * `handleClose` decisions:
 * D1 routingMap non-empty? D2 a callback throws? (logged, others still run)
 * D3 `responseEmitter` set? (optional chain, listeners dropped when present)
 */
describe('ClientRMQ.handleClose', () => {
  it('does nothing when nothing is pending and no emitter exists (D1 F, D3 F)', () => {
    const client = createClient();

    expect(() => client.handleClose()).not.toThrow();
  });

  it('fails the pending requests and drops the response listeners (D1 T, D2 F, D3 T)', () => {
    const client = createClient();
    const callback = vi.fn();
    const emitter = new EventEmitter();
    emitter.on('id', vi.fn());
    asAny(client).responseEmitter = emitter;
    asAny(client).routingMap.set('id', callback);

    client.handleClose();

    expect(callback).toHaveBeenCalledWith({
      err: expect.objectContaining({ message: 'Connection closed' }),
    });
    expect(asAny(client).routingMap.size).toBe(0);
    expect(emitter.eventNames()).toEqual([]);
  });

  it('logs a throwing callback and keeps going (D2 T)', () => {
    const client = createClient();
    const throwing = vi.fn(() => {
      throw new Error('callback failed');
    });
    const other = vi.fn();
    asAny(client).responseEmitter = new EventEmitter();
    asAny(client).routingMap.set('a', throwing);
    asAny(client).routingMap.set('b', other);

    client.handleClose();

    expect(asAny(client).logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'callback failed' }),
    );
    expect(other).toHaveBeenCalledTimes(1);
  });
});

/**
 * `connect` decisions:
 * D1 `this.client` already set? -> cached `connectionPromise` returned.
 * D2 package not loaded yet?
 * D3 after the load: a concurrent connect() already created the client?
 * D4 `close()` ran while the packages loaded? -> throws 'Connection closed'.
 * D5 pendingEventListeners non-empty? (forEach over 0 and >0 entries)
 * D6 the attempt rejects? -> discardPartialConnection() then rethrow.
 * The `EmptyError` catch of `convertConnectionToPromise` cannot be reached from
 * `connect()`: `connection$` is a ReplaySubject that is never completed.
 */
describe('ClientRMQ.connect', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates the client, registers the listeners and resolves on connect (D1 F, D5 F)', async () => {
    const client = createClient();
    const manager = createManagerFake();
    const createStub = vi
      .spyOn(client, 'createClient')
      .mockReturnValue(manager as any);
    const createChannel = vi
      .spyOn(client, 'createChannel')
      .mockResolvedValue(undefined);

    const attempt = client.connect();
    await flush();
    manager.emit('connect');
    await expect(attempt).resolves.toBeUndefined();

    expect(createStub).toHaveBeenCalledTimes(1);
    expect(createChannel).toHaveBeenCalledTimes(1);
    expect(manager.listenerCount('error')).toBe(1);
    expect(manager.listenerCount('disconnect')).toBe(1);
    expect(manager.listenerCount('blocked')).toBe(1);
    expect(manager.listenerCount('unblocked')).toBe(1);
    expect(asAny(client).client).toBe(manager);
    expect(asAny(client).responseEmitter).toBeInstanceOf(EventEmitter);
  });

  it('attaches the listeners queued before connect (D5 T)', async () => {
    const client = createClient();
    const queued = vi.fn();
    client.on('blocked', queued as any);

    const manager = await connectWith(client);
    manager.emit('blocked', { reason: 'memory alarm' });

    expect(queued).toHaveBeenCalledTimes(1);
  });

  it('returns the cached promise without creating another client (D1 T)', async () => {
    const client = createClient();
    const manager = createManagerFake();
    const createStub = vi
      .spyOn(client, 'createClient')
      .mockReturnValue(manager as any);
    vi.spyOn(client, 'createChannel').mockResolvedValue(undefined);

    const attempt = client.connect();
    await flush();
    manager.emit('connect');
    await attempt;
    const cached = asAny(client).connectionPromise;

    await expect(client.connect()).resolves.toBeUndefined();
    expect(createStub).toHaveBeenCalledTimes(1);
    expect(asAny(client).connectionPromise).toBe(cached);
  });

  it('rejects when close() runs while the packages are loading (D2 T, D4 T)', async () => {
    // A fresh module instance keeps the module-level package cache empty.
    vi.resetModules();
    const { ClientRMQ: FreshClientRMQ } =
      await import('../../../../packages/microservices/client/client-rmq.js');
    const client = new FreshClientRMQ({});

    const attempt = client.connect();
    await client.close();

    await expect(attempt).rejects.toThrow('Connection closed');
  });

  it('returns the connection of a concurrent connect() (D3 T)', async () => {
    vi.resetModules();
    const { ClientRMQ: FreshClientRMQ } =
      await import('../../../../packages/microservices/client/client-rmq.js');
    const client = new FreshClientRMQ({});
    const manager = createManagerFake();
    const createStub = vi
      .spyOn(client, 'createClient')
      .mockReturnValue(manager as any);
    vi.spyOn(client, 'createChannel').mockResolvedValue(undefined);

    const first = client.connect();
    const second = client.connect();
    await flush();
    manager.emit('connect');

    await expect(first).resolves.toBeUndefined();
    await expect(second).resolves.toBeUndefined();
    expect(createStub).toHaveBeenCalledTimes(1);
  });

  it('discards the partial connection when the attempt fails (D6 T)', async () => {
    const client = createClient();
    const error = new Error('broker unavailable');
    const manager = createManagerFake();
    vi.spyOn(client, 'createClient').mockReturnValue(manager as any);
    vi.spyOn(client, 'createChannel').mockResolvedValue(undefined);
    vi.spyOn(client, 'convertConnectionToPromise').mockRejectedValueOnce(error);

    await expect(client.connect()).rejects.toBe(error);

    expect(asAny(client).client).toBeNull();
    expect(asAny(client).channel).toBeNull();
    expect(asAny(client).connectionPromise).toBeNull();
    expect(manager.close).toHaveBeenCalledTimes(1);
  });
});

/**
 * `discardPartialConnection` decisions:
 * D1 `this.client === client`? -> the state is reset, else a newer attempt owns
 * it and is left alone. Every `.close()` rejection is swallowed.
 */
describe('ClientRMQ.discardPartialConnection', () => {
  it('resets the state of the failed attempt and closes it (D1 T)', async () => {
    const client = createClient();
    const manager = createManagerFake();
    const channel = { close: vi.fn().mockResolvedValue(undefined) };
    asAny(client).client = manager;
    asAny(client).channel = channel;

    await asAny(client).discardPartialConnection(manager);

    expect(channel.close).toHaveBeenCalledTimes(1);
    expect(manager.close).toHaveBeenCalledTimes(1);
    expect(asAny(client).client).toBeNull();
    expect(asAny(client).channel).toBeNull();
    expect(asAny(client).connectionPromise).toBeNull();
    expect(asAny(client).isInitialConnect).toBe(true);
  });

  it('leaves a newer attempt alone but still closes the stale manager (D1 F)', async () => {
    const client = createClient();
    const stale = createManagerFake();
    const current = createManagerFake();
    asAny(client).client = current;
    asAny(client).isInitialConnect = false;

    await asAny(client).discardPartialConnection(stale);

    expect(asAny(client).client).toBe(current);
    expect(asAny(client).isInitialConnect).toBe(false);
    expect(stale.close).toHaveBeenCalledTimes(1);
  });

  it('swallows the close failures', async () => {
    const client = createClient();
    const manager = createManagerFake({
      close: vi.fn().mockRejectedValue(new Error('close failed')),
    });
    asAny(client).client = manager;
    asAny(client).channel = {
      close: vi.fn().mockRejectedValue(new Error('channel close failed')),
    };

    await expect(
      asAny(client).discardPartialConnection(manager),
    ).resolves.toBeUndefined();
  });
});

/**
 * `createChannel` decisions:
 * D1 the channel wrapper emits 'error'? -> logged and the promise rejects.
 */
describe('ClientRMQ.createChannel', () => {
  it('creates the channel with json:false and the setup callback (D1 F)', async () => {
    const client = createClient();
    const wrapper = new EventEmitter();
    const channel = {};
    const createChannel = vi.fn(({ setup }) => {
      void setup(channel);
      return wrapper;
    });
    asAny(client).client = { createChannel };
    const setup = vi
      .spyOn(client, 'setupChannel')
      .mockImplementation(async (_channel, resolve) => resolve());

    await expect(client.createChannel()).resolves.toBeUndefined();

    expect(createChannel).toHaveBeenCalledWith({
      json: false,
      setup: expect.any(Function),
    });
    expect(setup).toHaveBeenCalledWith(channel, expect.any(Function));
    expect(asAny(client).channel).toBe(wrapper);
  });

  it('logs and rejects when the wrapper reports an error (D1 T)', async () => {
    const client = createClient();
    const error = new Error('PRECONDITION_FAILED');
    const wrapper = new EventEmitter();
    asAny(client).client = {
      createChannel: vi.fn(({ setup }) => {
        void setup({});
        return wrapper;
      }),
    };
    vi.spyOn(client, 'setupChannel').mockImplementation(() => {});

    const attempt = client.createChannel();
    wrapper.emit('error', error);

    await expect(attempt).rejects.toBe(error);
    expect(asAny(client).logger.error).toHaveBeenCalledWith(error);
  });
});

/**
 * `createClient` decisions:
 * D1 `socketOptions` present? -> passed as the second argument
 * D2 `urls` present? -> otherwise `[RMQ_DEFAULT_URL]`
 * D3 `rmqPackage ??= loadPackageSync(...)`: the assign outcome (first call in a
 *    process) would call `connect()` of the real amqp-connection-manager, which
 *    starts real sockets and retry timers. INFEASIBLE here; the cached-package
 *    outcome is used.
 */
describe('ClientRMQ.createClient', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('passes the default url when none is configured (D1 F, D2 F, D3 F)', async () => {
    const client = createClient();
    await connectWith(client);
    amqpConnect.mockClear();
    amqpConnect.mockReturnValue(createManagerFake());

    asAny(client).createClient();

    expect(amqpConnect).toHaveBeenCalledWith([RMQ_DEFAULT_URL], undefined);
  });

  it('passes the configured urls and socket options (D1 T, D2 T, D3 F)', async () => {
    const socketOptions = { heartbeatIntervalInSeconds: 5 };
    const client = createClient({
      urls: ['amqp://a:5672', 'amqp://b:5672'],
      socketOptions,
    });
    await connectWith(client);
    amqpConnect.mockClear();
    amqpConnect.mockReturnValue(createManagerFake());

    asAny(client).createClient();

    expect(amqpConnect).toHaveBeenCalledWith(
      ['amqp://a:5672', 'amqp://b:5672'],
      socketOptions,
    );
  });
});

/**
 * `mergeDisconnectEvent` decisions:
 * D1 `urls` option present? -> the default [] is used for the connectFailed scan
 * D2 `urls.indexOf(error.url) >= urls.length - 1`? -> rethrow or retry
 * Both the 'disconnect' and the 'connectFailed' error channels are merged with
 * the source stream and completed by `first()`.
 */
describe('ClientRMQ.mergeDisconnectEvent', () => {
  it('passes the source value through when nothing fails (D2 F)', async () => {
    const client = createClient();
    const manager = createManagerFake();
    const values: any[] = [];

    const subscription = client
      .mergeDisconnectEvent(manager, new ReplaySubject(1))
      .subscribe(value => values.push(value));

    expect(values).toEqual([]);
    subscription.unsubscribe();
  });

  it('throws the disconnect payload (D2 F)', async () => {
    const client = createClient();
    const manager = createManagerFake();
    const error = { err: new Error('connection lost') };
    const result = new Promise(resolve =>
      client
        .mergeDisconnectEvent(manager, new ReplaySubject(1))
        .subscribe({ error: err => resolve(err) }),
    );

    manager.emit('disconnect', error);

    await expect(result).resolves.toBe(error);
  });

  it('retries a connectFailed for an earlier url and throws for the last one (D2 T after D2 F)', async () => {
    const client = createClient({ urls: ['amqp://a', 'amqp://b'] });
    const manager = createManagerFake();
    const errors: unknown[] = [];
    client
      .mergeDisconnectEvent(manager, new ReplaySubject(1))
      .subscribe({ error: err => errors.push(err) });
    // Let the retryWhen subscription settle before the events are emitted.
    await flush();

    const first = { url: 'amqp://a' };
    manager.emit('connectFailed', first);
    await flush();
    expect(errors).toEqual([]);

    const second = { url: 'amqp://b' };
    manager.emit('connectFailed', second);
    await flush();

    expect(errors).toEqual([second]);
  });

  it('throws at once when no url list is configured (D1 F)', async () => {
    const client = createClient();
    const manager = createManagerFake();
    const errors: unknown[] = [];
    client
      .mergeDisconnectEvent(manager, new ReplaySubject(1))
      .subscribe({ error: err => errors.push(err) });
    await flush();

    const failure = { url: 'amqp://a' };
    manager.emit('connectFailed', failure);
    await flush();

    expect(errors).toEqual([failure]);
  });
});

/**
 * `convertConnectionToPromise` decisions:
 * D1 the first value arrives? -> resolved
 * D2 the error is an EmptyError? -> resolved with undefined, else rethrown
 */
describe('ClientRMQ.convertConnectionToPromise', () => {
  it('resolves with the first connection value (D1 T, D2 F)', async () => {
    const client = createClient();
    asAny(client).connection$ = new ReplaySubject(1);
    const attempt = client.convertConnectionToPromise();
    asAny(client).connection$.next('connected');

    await expect(attempt).resolves.toBe('connected');
  });

  it('resolves undefined when the stream completes empty (D2 T)', async () => {
    const client = createClient();
    asAny(client).connection$ = new ReplaySubject(1);
    const attempt = client.convertConnectionToPromise();
    asAny(client).connection$.complete();

    await expect(attempt).resolves.toBeUndefined();
  });

  it('rethrows any other error (D2 F)', async () => {
    const client = createClient();
    const error = new Error('connection lost');
    asAny(client).connection$ = new ReplaySubject(1);
    const attempt = client.convertConnectionToPromise();
    asAny(client).connection$.error(error);

    await expect(attempt).rejects.toBe(error);
  });
});

/**
 * `setupChannel` decisions:
 * D1 `prefetchCount` truthy? (else RMQ_DEFAULT_PREFETCH_COUNT)
 * D2 `isGlobalPrefetchCount` truthy? (else the default false)
 * D3 `!wildcards && exchangeType !== 'fanout'`? (both atoms)
 * D4 `!noAssert`? -> assertQueue
 * D5 `exchange && routingKey`? (both atoms)
 * D6 the fanout/routingKey ternary inside the queue branch is unreachable,
 *    because a fanout exchange takes the else branch (infeasible path).
 * D7 `exchange` option present? (else the queue name)
 * D8 `exchangeType` option present? (else 'topic')
 */
describe('ClientRMQ.setupChannel', () => {
  const createChannelFake = (queue = 'workers') => ({
    assertQueue: vi.fn().mockResolvedValue({ queue }),
    assertExchange: vi.fn().mockResolvedValue({}),
    bindQueue: vi.fn().mockResolvedValue(undefined),
    prefetch: vi.fn().mockResolvedValue(undefined),
    consume: vi.fn().mockResolvedValue(undefined),
  });

  const setup = async (options: any = {}, queueOptions: any = {}) => {
    const client = createClient({
      queue: 'workers',
      queueOptions,
      ...options,
    });
    // Avoid the constructor's queueOptions replacement when a test passes none.
    asAny(client).queueOptions = queueOptions;
    const channel = createChannelFake();
    vi.spyOn(client, 'consumeChannel').mockResolvedValue(undefined);
    const resolve = vi.fn();

    await client.setupChannel(channel, resolve);

    return { client, channel, resolve };
  };

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('asserts the queue and binds it when configured (D3 T, D4 T, D5 T)', async () => {
    const { channel, resolve } = await setup({
      exchange: 'orders',
      routingKey: 'created',
    });

    expect(channel.assertQueue).toHaveBeenCalledWith('workers', {});
    expect(channel.bindQueue).toHaveBeenCalledWith(
      'workers',
      'orders',
      'created',
    );
    expect(channel.assertExchange).not.toHaveBeenCalled();
    expect(channel.prefetch).toHaveBeenCalledWith(
      RMQ_DEFAULT_PREFETCH_COUNT,
      false,
    );
    expect(resolve).toHaveBeenCalled();
  });

  it('skips the queue declaration for noAssert (D4 F, D5 T)', async () => {
    const { channel } = await setup({
      noAssert: true,
      exchange: 'orders',
      routingKey: 'created',
    });

    expect(channel.assertQueue).not.toHaveBeenCalled();
    expect(channel.bindQueue).toHaveBeenCalledWith(
      'workers',
      'orders',
      'created',
    );
  });

  it('does not bind without both exchange and routing key (D5 F)', async () => {
    const withExchange = await setup({ exchange: 'orders' });
    const withRoutingKey = await setup({ routingKey: 'created' });

    expect(withExchange.channel.bindQueue).not.toHaveBeenCalled();
    expect(withRoutingKey.channel.bindQueue).not.toHaveBeenCalled();
  });

  it('declares the exchange for wildcards (D3 F: wildcards)', async () => {
    const { channel } = await setup({
      wildcards: true,
      exchange: 'orders',
      exchangeType: 'direct',
    });

    expect(channel.assertQueue).not.toHaveBeenCalled();
    expect(channel.assertExchange).toHaveBeenCalledWith('orders', 'direct', {
      durable: true,
      arguments: {},
    });
  });

  it('declares the exchange for fanout and uses the queue name as the exchange (D3 F: fanout, D7 F)', async () => {
    const { channel } = await setup({ exchangeType: 'fanout' });

    expect(channel.assertExchange).toHaveBeenCalledWith('workers', 'fanout', {
      durable: true,
      arguments: {},
    });
  });

  it('falls back to the topic exchange type for wildcards (D8 F)', async () => {
    const { channel } = await setup({ wildcards: true });

    expect(channel.assertExchange).toHaveBeenCalledWith('workers', 'topic', {
      durable: true,
      arguments: {},
    });
  });

  it('passes the prefetch options (D1 T, D2 T)', async () => {
    const { channel } = await setup({
      prefetchCount: 10,
      isGlobalPrefetchCount: true,
    });

    expect(channel.prefetch).toHaveBeenCalledWith(10, true);
  });

  it('falls back to the defaults for a zero prefetch count (D1 F, D2 F)', async () => {
    const { channel } = await setup({
      prefetchCount: 0,
      isGlobalPrefetchCount: false,
    });

    expect(channel.prefetch).toHaveBeenCalledWith(0, false);
  });
});

/**
 * `consumeChannel` decisions:
 * D1 `noAck` option present? (else RMQ_DEFAULT_NOACK)
 * D2 a listener waits for the correlation id? -> only then is it emitted.
 */
describe('ClientRMQ.consumeChannel', () => {
  let client: ClientRMQ;
  let onMessage: Function;
  let consume: ReturnType<typeof vi.fn>;
  let emitter: EventEmitter;

  beforeEach(async () => {
    client = createClient();
    emitter = new EventEmitter();
    asAny(client).responseEmitter = emitter;
    consume = vi.fn((_queue, callback) => (onMessage = callback));
    await client.consumeChannel({ consume } as any);
  });

  it('consumes the reply queue with the default noAck (D1 F)', () => {
    expect(consume).toHaveBeenCalledWith(REPLY_QUEUE, expect.any(Function), {
      noAck: RMQ_DEFAULT_NOACK,
    });
  });

  it('forwards a message a pending request waits for (D2 T)', () => {
    const message = { properties: { correlationId: 'id' }, content: 'x' };
    const listener = vi.fn();
    emitter.on('id', listener);

    onMessage(message);

    expect(listener).toHaveBeenCalledWith(message);
  });

  it('ignores a message nobody waits for (D2 F)', () => {
    const emit = vi.spyOn(emitter, 'emit');

    onMessage({ properties: { correlationId: 'unknown' }, content: 'x' });

    expect(emit).not.toHaveBeenCalled();
  });

  it('reads the configured noAck (D1 T)', async () => {
    const configured = createClient({ noAck: false });
    const consumeWithNoAck = vi.fn();
    await configured.consumeChannel({ consume: consumeWithNoAck } as any);

    expect(consumeWithNoAck).toHaveBeenCalledWith(
      REPLY_QUEUE,
      expect.any(Function),
      { noAck: false },
    );
  });
});

// No decisions: the error listener always logs.
describe('ClientRMQ.registerErrorListener', () => {
  it('binds "error" and logs the failure', () => {
    const client = createClient();
    const manager = createManagerFake();
    const error = new Error('socket closed');

    client.registerErrorListener(manager);
    manager.emit('error', error);

    expect(manager.listenerCount('error')).toBe(1);
    expect(asAny(client).logger.error).toHaveBeenCalledWith(error);
  });
});

/**
 * `registerDisconnectListener` decisions:
 * D1 `isInitialConnect` false? -> the cached promise is replaced by a rejection
 * D2 `client === this.client`? D3 `replyQueue === REPLY_QUEUE`? -> pending
 *    requests are failed through handleClose()
 */
describe('ClientRMQ.registerDisconnectListener', () => {
  it('does not reject anything before the first connection is established (D1 F)', () => {
    const client = createClient();
    const manager = createManagerFake();
    asAny(client).client = manager;
    const promise = Promise.resolve();
    asAny(client).connectionPromise = promise;
    const status = captureStatus(client);

    client.registerDisconnectListener(manager);
    manager.emit('disconnect', new Error('lost'));

    expect(asAny(client).connectionPromise).toBe(promise);
    expect(status.statuses).toEqual(['disconnected']);
    status.stop();
  });

  it('rejects the current promise after a reconnect (D1 T)', async () => {
    const client = createClient();
    const manager = createManagerFake();
    asAny(client).client = manager;
    asAny(client).isInitialConnect = false;

    client.registerDisconnectListener(manager);
    manager.emit('disconnect', new Error('lost'));

    await expect(asAny(client).connectionPromise).rejects.toBe(
      'Error: Connection lost. Trying to reconnect...',
    );
  });

  it('fails the pending requests on the direct reply-to queue (D2 T, D3 T)', () => {
    const client = createClient();
    const manager = createManagerFake();
    asAny(client).client = manager;
    asAny(client).isInitialConnect = false;
    const callback = vi.fn();
    asAny(client).routingMap.set('id', callback);

    client.registerDisconnectListener(manager);
    manager.emit('disconnect', new Error('lost'));

    expect(callback).toHaveBeenCalledWith({
      err: expect.objectContaining({ message: 'Connection closed' }),
    });
  });

  it('keeps the pending requests of a named reply queue (D3 F)', () => {
    const client = createClient({ replyQueue: 'replies' });
    const manager = createManagerFake();
    asAny(client).client = manager;
    asAny(client).isInitialConnect = false;
    const callback = vi.fn();
    asAny(client).routingMap.set('id', callback);

    client.registerDisconnectListener(manager);
    manager.emit('disconnect', new Error('lost'));

    expect(callback).not.toHaveBeenCalled();
    expect(asAny(client).routingMap.size).toBe(1);
  });

  it('ignores a disconnect of a client that was replaced (D2 F)', () => {
    const client = createClient();
    const stale = createManagerFake();
    asAny(client).client = createManagerFake();
    asAny(client).isInitialConnect = false;
    const callback = vi.fn();
    asAny(client).routingMap.set('id', callback);

    client.registerDisconnectListener(stale);
    stale.emit('disconnect', new Error('lost'));

    expect(callback).not.toHaveBeenCalled();
  });
});

/**
 * `registerConnectListener` decisions:
 * D1 `isInitialConnect`? -> the first connect only clears the flag, a reconnect
 * resolves the previously rejected promise.
 */
describe('ClientRMQ.registerConnectListener', () => {
  it('clears the initial flag on the first connect (D1 T)', () => {
    const client = createClient();
    const manager = createManagerFake();
    const promise = Promise.resolve();
    asAny(client).connectionPromise = promise;
    const status = captureStatus(client);

    client.registerConnectListener(manager);
    manager.emit('connect');

    expect(asAny(client).isInitialConnect).toBe(false);
    expect(asAny(client).connectionPromise).toBe(promise);
    expect(status.statuses).toEqual(['connected']);
    status.stop();
  });

  it('resolves the promise again after a reconnect (D1 F)', async () => {
    const client = createClient();
    const manager = createManagerFake();
    asAny(client).isInitialConnect = false;
    const previous = Promise.reject('lost');
    previous.catch(() => {});
    asAny(client).connectionPromise = previous;

    client.registerConnectListener(manager);
    manager.emit('connect');

    await expect(asAny(client).connectionPromise).resolves.toBeUndefined();
  });
});

// No decisions: the blocked handler always sets the status and warns.
describe('ClientRMQ.registerBlockedListener', () => {
  it('reports BLOCKED with the reason', () => {
    const client = createClient();
    const manager = createManagerFake();
    const status = captureStatus(client);

    client.registerBlockedListener(manager);
    manager.emit('blocked', { reason: 'memory alarm' });

    expect(status.statuses).toEqual(['blocked']);
    expect(asAny(client).logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('memory alarm'),
    );
    status.stop();
  });
});

// No decisions: the unblocked handler always sets the status.
describe('ClientRMQ.registerUnblockedListener', () => {
  it('reports UNBLOCKED', () => {
    const client = createClient();
    const manager = createManagerFake();
    const status = captureStatus(client);

    client.registerUnblockedListener(manager);
    manager.emit('unblocked');

    expect(status.statuses).toEqual(['unblocked']);
    expect(asAny(client).logger.log).toHaveBeenCalled();
    status.stop();
  });
});

/**
 * `on` decisions:
 * D1 `this.client` set? -> forwarded to it, but always kept for later clients.
 */
describe('ClientRMQ.on', () => {
  it('queues the listener before connect (D1 F)', () => {
    const client = createClient();
    const callback = vi.fn();

    client.on('disconnect', callback);

    expect(asAny(client).pendingEventListeners).toEqual([
      { event: 'disconnect', callback },
    ]);
  });

  it('forwards the listener to the manager (D1 T)', () => {
    const client = createClient();
    const manager = createManagerFake();
    asAny(client).client = manager;
    const callback = vi.fn();

    client.on('disconnect', callback);
    manager.emit('disconnect');

    expect(callback).toHaveBeenCalledTimes(1);
    expect(asAny(client).pendingEventListeners).toHaveLength(1);
  });
});

/**
 * `unwrap` decisions:
 * D1 `!this.client`? -> throws before connect().
 */
describe('ClientRMQ.unwrap', () => {
  it('throws before connect() (D1 T)', () => {
    expect(() => createClient().unwrap()).toThrow(/connect/);
  });

  it('returns the manager (D1 F)', () => {
    const client = createClient();
    const manager = createManagerFake();
    asAny(client).client = manager;

    expect(client.unwrap()).toBe(manager);
  });
});

/**
 * `handleMessage` decisions:
 * D1 `isFunction(options)`? -> it is the callback
 * D2 `deserializer.deserialize` resolves? (throw/reject -> callback with the
 *    error, `callback?.` tolerates a missing callback)
 * D3 `isDisposed`? D4 `err`? -> disposed packet
 * D5 a callback is provided? (optional calls)
 */
describe('ClientRMQ.handleMessage', () => {
  const response = { response: 'ok' };
  const handlerError = new Error('handler failed');

  it.each([
    [
      'a disposed response',
      { response: 'ok', isDisposed: true },
      { err: undefined, response: 'ok', isDisposed: true },
    ],
    [
      'an error',
      { err: handlerError },
      { err: handlerError, response: undefined, isDisposed: true },
    ],
    [
      'a final response',
      { response: 'ok' },
      { err: undefined, response: 'ok' },
    ],
  ])('reports %s to the callback (D3/D4)', async (_label, packet, expected) => {
    const client = createClient();
    const callback = vi.fn();

    await client.handleMessage(packet, callback);

    expect(callback).toHaveBeenCalledWith(expected);
  });

  it('treats a function as the callback and the packet without options (D1 T)', async () => {
    const client = createClient();
    const callback = vi.fn();
    const deserialize = vi.spyOn(asAny(client).deserializer, 'deserialize');

    await client.handleMessage(response, callback);

    expect(deserialize).toHaveBeenCalledWith(response, undefined);
    expect(callback).toHaveBeenCalledWith({ err: undefined, response: 'ok' });
  });

  it('passes the options of a reply to the deserializer (D1 F)', async () => {
    const client = createClient();
    const deserialize = vi.spyOn(asAny(client).deserializer, 'deserialize');
    const callback = vi.fn();
    const options = { correlationId: 'id' };

    await client.handleMessage(response, options, callback);

    expect(deserialize).toHaveBeenCalledWith(response, options);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it.each([
    [
      'throws',
      () => {
        throw new Error('bad reply');
      },
    ],
    ['rejects', () => Promise.reject(new Error('bad reply'))],
  ])(
    'fails the request when the deserializer %s (D2 F)',
    async (_label, impl) => {
      const client = createClient();
      Object.assign(client, { deserializer: { deserialize: impl } });
      const callback = vi.fn();

      await expect(client.handleMessage({}, callback)).resolves.toBeUndefined();

      expect(callback).toHaveBeenCalledWith({
        err: expect.any(Error),
        isDisposed: true,
      });
    },
  );

  it('does not throw when the deserializer fails and no callback exists (D5 F)', async () => {
    const client = createClient();
    Object.assign(client, {
      deserializer: {
        deserialize: () => {
          throw new Error('bad reply');
        },
      },
    });

    await expect(client.handleMessage({})).resolves.toBeUndefined();
  });

  it('does nothing without a callback when the reply is disposed (D5 F)', async () => {
    const client = createClient();

    await expect(
      client.handleMessage({ response: 'ok', isDisposed: true }),
    ).resolves.toBeUndefined();
  });
});

/**
 * `publish` decisions:
 * D1 `wildcards || exchangeType === 'fanout'`? (both atoms)
 * D2 the channel promise rejects? -> callback with the error
 * D3 the serializer throws? -> outer catch: cleanup, callback, no-op teardown
 * D4 record data / record options (the serializer extracts `options`)
 * The publish listener parses the content and forwards it to handleMessage.
 */
describe('ClientRMQ.publish', () => {
  let client: ClientRMQ;
  let channel: any;
  let emitter: EventEmitter;

  const publish = (packet: Record<string, any>, callback = vi.fn()) =>
    asAny(client).publish(packet, callback);

  beforeEach(() => {
    client = createClient({ queue: 'workers' });
    emitter = new EventEmitter();
    channel = {
      sendToQueue: vi.fn().mockResolvedValue(undefined),
      publish: vi.fn().mockResolvedValue(undefined),
    };
    asAny(client).channel = channel;
    asAny(client).responseEmitter = emitter;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sends the packet to the queue with replyTo and correlation id (D1 F)', () => {
    const packet = { pattern: 'orders', data: 'data' };

    const teardown = publish(packet);

    const [queue, content, options] = channel.sendToQueue.mock.calls[0];
    expect(queue).toBe('workers');
    expect(options.replyTo).toBe(REPLY_QUEUE);
    expect(options.persistent).toBe(RMQ_DEFAULT_PERSISTENT);
    expect(options.correlationId).toEqual(expect.any(String));
    expect(options.headers).toBeUndefined();
    expect(JSON.parse(content.toString())).toEqual({
      pattern: 'orders',
      data: 'data',
      id: options.correlationId,
    });
    expect(emitter.listenerCount(options.correlationId)).toBe(1);
    expect(asAny(client).routingMap.size).toBe(1);

    teardown();
    expect(emitter.listenerCount(options.correlationId)).toBe(0);
    expect(asAny(client).routingMap.size).toBe(0);
  });

  it('publishes to the exchange for wildcards (D1 T: wildcards)', () => {
    asAny(client).options.wildcards = true;
    asAny(client).options.exchange = 'orders.exchange';

    publish({ pattern: { role: 'user', cmd: 'create' }, data: 'data' });

    const [exchange, routingKey, , options] = channel.publish.mock.calls[0];
    expect(exchange).toBe('orders.exchange');
    expect(routingKey).toBe('{"cmd":"create","role":"user"}');
    expect(options.correlationId).toEqual(expect.any(String));
    expect(channel.sendToQueue).not.toHaveBeenCalled();
  });

  it('falls back to the queue name as exchange (D1 T: fanout)', () => {
    asAny(client).options.exchangeType = 'fanout';

    publish({ pattern: 'orders', data: 'data' });

    expect(channel.publish.mock.calls[0][0]).toBe('workers');
    expect(channel.publish.mock.calls[0][1]).toBe('orders');
  });

  it('reports a rejected sendToQueue (D2 T)', async () => {
    const error = new Error('channel closed');
    channel.sendToQueue.mockRejectedValue(error);
    const callback = vi.fn();

    publish({ pattern: 'orders', data: 'data' }, callback);
    await flush();

    expect(callback).toHaveBeenCalledWith({ err: error });
  });

  it('reports a rejected exchange publish (D2 T)', async () => {
    asAny(client).options.wildcards = true;
    const error = new Error('channel closed');
    channel.publish.mockRejectedValue(error);
    const callback = vi.fn();

    publish({ pattern: 'orders', data: 'data' }, callback);
    await flush();

    expect(callback).toHaveBeenCalledWith({ err: error });
  });

  it('does not call back when the send succeeds (D2 F)', async () => {
    const callback = vi.fn();

    publish({ pattern: 'orders', data: 'data' }, callback);
    await flush();

    expect(callback).not.toHaveBeenCalled();
  });

  it('fails the request when the serializer throws (D3 T)', () => {
    Object.assign(client, {
      serializer: {
        serialize: () => {
          throw new Error('cannot serialize');
        },
      },
    });
    const callback = vi.fn();

    const teardown = publish({ pattern: 'orders', data: 'data' }, callback);

    expect(callback).toHaveBeenCalledWith({
      err: expect.objectContaining({ message: 'cannot serialize' }),
    });
    expect(channel.sendToQueue).not.toHaveBeenCalled();
    expect(emitter.eventNames()).toEqual([]);
    expect(typeof teardown).toBe('function');
  });

  it('sends the record options without the options key in the content (D4)', () => {
    publish({
      pattern: 'orders',
      data: new RmqRecord('data', { priority: 5, headers: { tenant: 'a' } }),
    });

    const [, content, options] = channel.sendToQueue.mock.calls[0];
    expect(JSON.parse(content.toString())).toEqual({
      pattern: 'orders',
      data: 'data',
      id: options.correlationId,
    });
    expect(options.priority).toBe(5);
    expect(options.headers).toEqual({ tenant: 'a' });
  });

  it('merges the packet metadata into the headers', () => {
    publish({
      pattern: 'orders',
      data: 'data',
      metadata: { 'x-request-id': 'trace-1' },
    });

    expect(channel.sendToQueue.mock.calls[0][2].headers).toEqual({
      'x-request-id': 'trace-1',
    });
  });

  it('forwards a reply to the pending request', async () => {
    const callback = vi.fn();
    const handle = vi
      .spyOn(client, 'handleMessage')
      .mockResolvedValue(undefined);
    publish({ pattern: 'orders', data: 'data' }, callback);
    const correlationId = channel.sendToQueue.mock.calls[0][2].correlationId;

    emitter.emit(correlationId, {
      content: Buffer.from(JSON.stringify({ response: 'ok' })),
      options: { correlationId },
    });

    expect(handle).toHaveBeenCalledWith(
      { response: 'ok' },
      { correlationId },
      callback,
    );
  });
});

/**
 * `dispatchEvent` decisions:
 * D1 `wildcards || exchangeType === 'fanout'`? (both atoms)
 * D2 the error callback receives an error? -> reject / resolve
 * D3 the record options / headers are taken from the serializer output.
 */
describe('ClientRMQ.dispatchEvent', () => {
  let client: ClientRMQ;
  let channel: any;

  const dispatch = (packet: Record<string, any>) =>
    asAny(client).dispatchEvent(packet);

  beforeEach(() => {
    client = createClient({ queue: 'workers' });
    channel = {
      sendToQueue: vi.fn(),
      publish: vi.fn(),
    };
    asAny(client).channel = channel;
  });

  it('resolves when the queue accepts the event (D1 F, D2 F)', async () => {
    channel.sendToQueue.mockImplementation(
      (_q: string, _c: Buffer, _o: any, done: Function) => done(),
    );

    await expect(
      dispatch({ pattern: 'orders', data: 'data' }),
    ).resolves.toBeUndefined();
    expect(channel.sendToQueue).toHaveBeenCalledWith(
      'workers',
      expect.any(Buffer),
      expect.objectContaining({ persistent: RMQ_DEFAULT_PERSISTENT }),
      expect.any(Function),
    );
  });

  it('rejects when the queue reports an error (D2 T)', async () => {
    const error = new Error('channel closed');
    channel.sendToQueue.mockImplementation(
      (_q: string, _c: Buffer, _o: any, done: Function) => done(error),
    );

    await expect(dispatch({ pattern: 'orders', data: 'data' })).rejects.toBe(
      error,
    );
  });

  it('publishes to the exchange for wildcards (D1 T: wildcards)', async () => {
    asAny(client).options.wildcards = true;
    channel.publish.mockImplementation(
      (_e: string, _r: string, _c: Buffer, _o: any, done: Function) => done(),
    );

    await dispatch({ pattern: { cmd: 'sum' }, data: 'data' });

    expect(channel.publish).toHaveBeenCalledWith(
      'workers',
      '{"cmd":"sum"}',
      expect.any(Buffer),
      expect.any(Object),
      expect.any(Function),
    );
  });

  it('rejects when the exchange publish fails (D1 T: fanout, D2 T)', async () => {
    asAny(client).options.exchangeType = 'fanout';
    const error = new Error('no exchange');
    channel.publish.mockImplementation(
      (_e: string, _r: string, _c: Buffer, _o: any, done: Function) =>
        done(error),
    );

    await expect(dispatch({ pattern: 'orders', data: 'data' })).rejects.toBe(
      error,
    );
  });

  it('sends the record headers and keeps the options off the payload (D3)', async () => {
    channel.sendToQueue.mockImplementation(
      (_q: string, _c: Buffer, _o: any, done: Function) => done(),
    );

    await dispatch({
      pattern: 'orders',
      data: new RmqRecord('data', { priority: 3, headers: { tenant: 'a' } }),
      metadata: { 'x-request-id': 'trace-1' },
    });

    const [, content, options] = channel.sendToQueue.mock.calls[0];
    expect(options.priority).toBe(3);
    expect(options.headers).toEqual({
      'x-request-id': 'trace-1',
      tenant: 'a',
    });
    expect(JSON.parse(content.toString())).toEqual({
      pattern: 'orders',
      data: 'data',
    });
  });
});

/**
 * `initializeSerializer` decisions:
 * D1 a serializer is provided? -> kept, else the record serializer.
 */
describe('ClientRMQ.initializeSerializer', () => {
  it('keeps a provided serializer (D1 T)', () => {
    const client = createClient();
    const serializer = { serialize: vi.fn() };

    asAny(client).initializeSerializer({ serializer });

    expect(asAny(client).serializer).toBe(serializer);
  });

  it.each([{}, undefined])('falls back to the default (D1 F)', options => {
    const client = createClient();

    asAny(client).initializeSerializer(options);

    expect(asAny(client).serializer).toBeInstanceOf(RmqRecordSerializer);
  });
});

/**
 * `mergeHeaders` decisions:
 * D1 `!requestHeaders`? D2 `!this.options.headers`?
 * D3 `!hasPacketMetadata(metadata)`? -> all three -> undefined
 * Later sources override: metadata < client headers < record headers.
 */
describe('ClientRMQ.mergeHeaders', () => {
  it('returns undefined when nothing is available (D1 T, D2 T, D3 T)', () => {
    const client = createClient();

    expect(asAny(client).mergeHeaders(undefined, undefined)).toBeUndefined();
  });

  it('returns undefined for empty metadata (D3 F, still nothing to send)', () => {
    const client = createClient();

    expect(asAny(client).mergeHeaders(undefined, {})).toBeUndefined();
  });

  it('uses the record headers (D1 F, D3 T)', () => {
    const client = createClient();

    expect(asAny(client).mergeHeaders({ a: '1' }, undefined)).toEqual({
      a: '1',
    });
  });

  it('uses the client headers (D2 F, D3 T)', () => {
    const client = createClient({ headers: { b: '2' } });

    expect(asAny(client).mergeHeaders(undefined, undefined)).toEqual({
      b: '2',
    });
  });

  it('uses the packet metadata (D3 F)', () => {
    const client = createClient();

    expect(asAny(client).mergeHeaders(undefined, { c: '3' })).toEqual({
      c: '3',
    });
  });

  it('applies metadata < client < record precedence (D1 F, D2 F, D3 F)', () => {
    const client = createClient({ headers: { a: 'client', b: 'client' } });

    expect(
      asAny(client).mergeHeaders(
        { a: 'record', c: 'record' },
        {
          a: 'metadata',
          b: 'metadata',
          d: 'metadata',
        },
      ),
    ).toEqual({ a: 'record', b: 'client', c: 'record', d: 'metadata' });
  });
});

/**
 * `parseMessageContent` decisions:
 * D1 the content is JSON? -> parsed value, else the raw string.
 */
describe('ClientRMQ.parseMessageContent', () => {
  it('parses JSON content (D1 T)', () => {
    const client = createClient();

    expect(
      asAny(client).parseMessageContent(Buffer.from('{"response":"ok"}')),
    ).toEqual({ response: 'ok' });
  });

  it('returns the raw string for other content (D1 F)', () => {
    const client = createClient();

    expect(asAny(client).parseMessageContent(Buffer.from('not json'))).toBe(
      'not json',
    );
  });
});
