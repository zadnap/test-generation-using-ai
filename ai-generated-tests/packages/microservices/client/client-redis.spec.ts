import { EventEmitter } from 'events';
import { describe, expect, it, vi } from 'vitest';
import { ClientRedis } from '../../../../packages/microservices/client/client-redis.js';
import {
  REDIS_DEFAULT_HOST,
  REDIS_DEFAULT_PORT,
} from '../../../../packages/microservices/constants.js';
import { IncomingResponseDeserializer } from '../../../../packages/microservices/deserializers/incoming-response.deserializer.js';
import { RedisStatus } from '../../../../packages/microservices/events/redis.events.js';
import { IdentitySerializer } from '../../../../packages/microservices/serializers/identity.serializer.js';

const redisMock = vi.hoisted(() => {
  const calls: any[][] = [];
  class MockRedis {
    public constructor(public readonly options: any) {
      calls.push([options]);
    }
  }
  return { calls, MockRedis };
});

vi.mock('ioredis', () => ({ default: redisMock.MockRedis }));

class FakeRedisClient extends EventEmitter {
  public status = 'wait';
  public readonly connect = vi.fn(async () => undefined);
  public readonly quit = vi.fn(async () => 'OK');
  public readonly disconnect = vi.fn(() => {
    this.status = 'end';
  });
  public readonly subscribe = vi.fn(
    (_channel: string, callback?: (err?: Error) => void) => callback?.(),
  );
  public readonly unsubscribe = vi.fn(
    (_channel: string, callback?: (err?: Error) => void) => callback?.(),
  );
  public readonly publish = vi.fn(
    (_channel: string, _message: string, callback?: (err?: Error) => void) =>
      callback?.(),
  );
}

const asClient = (client: ClientRedis) => client as any;

const createClientWithFakes = () => {
  const client = new ClientRedis({});
  const pub = new FakeRedisClient();
  const sub = new FakeRedisClient();
  asClient(client).pubClient = pub;
  asClient(client).subClient = sub;
  asClient(client).connectionPromise = Promise.resolve();
  vi.spyOn(asClient(client).logger, 'log').mockImplementation(() => {});
  vi.spyOn(asClient(client).logger, 'error').mockImplementation(() => {});
  vi.spyOn(asClient(client).logger, 'debug').mockImplementation(() => {});
  return { client, pub, sub };
};

const collectStatuses = (client: ClientRedis) => {
  const statuses: RedisStatus[] = [];
  const subscription = client.status.subscribe(status => statuses.push(status));
  return { statuses, subscription };
};

/**
 * Constructor decisions: custom serializer (D1 true/false) and custom
 * deserializer (D2 true/false). All four combinations are feasible.
 */
describe('ClientRedis.constructor', () => {
  it('defaults the serializer and deserializer when none are provided', () => {
    const client = new ClientRedis({});

    expect(asClient(client).serializer).toBeInstanceOf(IdentitySerializer);
    expect(asClient(client).deserializer).toBeInstanceOf(
      IncomingResponseDeserializer,
    );
  });

  it('keeps a custom serializer and deserializer (D1 true, D2 true)', () => {
    const serializer = { serialize: vi.fn() };
    const deserializer = { deserialize: vi.fn() };
    const client = new ClientRedis({ serializer, deserializer } as any);

    expect(asClient(client).serializer).toBe(serializer);
    expect(asClient(client).deserializer).toBe(deserializer);
  });

  it('keeps only the custom serializer when only it is provided (D1 true, D2 false)', () => {
    const serializer = { serialize: vi.fn() };
    const client = new ClientRedis({ serializer } as any);

    expect(asClient(client).serializer).toBe(serializer);
    expect(asClient(client).deserializer).toBeInstanceOf(
      IncomingResponseDeserializer,
    );
  });
});

/**
 * No decisions: request pattern is the pattern itself, reply appends `.reply`.
 */
describe('ClientRedis.getRequestPattern / getReplyPattern', () => {
  it('leaves the request pattern unchanged', () => {
    expect(new ClientRedis({}).getRequestPattern('test')).toBe('test');
  });

  it('appends ".reply" to the reply pattern', () => {
    expect(new ClientRedis({}).getReplyPattern('test')).toBe('test.reply');
  });
});

/**
 * `close` decisions:
 *   D1 `pubClient` truthy? -> quitClient (or skip)
 *   D2 `subClient` truthy? -> quitClient (or skip)
 * `quitClient`: quit resolves -> done; rejects -> disconnect fallback.
 * close resets clients/promise/flags on every path.
 */
describe('ClientRedis.close', () => {
  it('quits both clients and resets the connection state (D1 true, D2 true)', async () => {
    const { client, pub, sub } = createClientWithFakes();

    await client.close();

    expect(pub.quit).toHaveBeenCalledTimes(1);
    expect(sub.quit).toHaveBeenCalledTimes(1);
    expect(asClient(client).pubClient).toBeNull();
    expect(asClient(client).subClient).toBeNull();
    expect(asClient(client).connectionPromise).toBeNull();
    expect(asClient(client).isManuallyClosed).toBe(false);
    expect(asClient(client).wasInitialConnectionSuccessful).toBe(false);
    expect(asClient(client).pendingEventListeners).toEqual([]);
  });

  it('skips a missing client (D1 false, D2 false)', async () => {
    const { client, pub, sub } = createClientWithFakes();
    asClient(client).pubClient = null;
    asClient(client).subClient = null;

    await client.close();

    expect(pub.quit).not.toHaveBeenCalled();
    expect(sub.quit).not.toHaveBeenCalled();
  });

  it('closes the sub client when only pub is missing (D1 false, D2 true)', async () => {
    const { client, sub } = createClientWithFakes();
    asClient(client).pubClient = null;

    await client.close();

    expect(sub.quit).toHaveBeenCalledTimes(1);
  });

  it('disconnects a client whose quit rejects and still closes the other', async () => {
    const { client, pub, sub } = createClientWithFakes();
    pub.quit.mockRejectedValueOnce(new Error('stream is not writeable'));
    const subQuit = sub.quit;

    await expect(client.close()).resolves.toBeUndefined();

    expect(pub.disconnect).toHaveBeenCalledTimes(1);
    expect(subQuit).toHaveBeenCalledTimes(1);
    expect(asClient(client).pubClient).toBeNull();
    expect(asClient(client).subClient).toBeNull();
  });

  it('marks itself manually closed while quitting and flushes pending requests', async () => {
    const { client } = createClientWithFakes();
    const callback = vi.fn();
    let manuallyClosedDuringQuit: boolean | undefined;
    asClient(client).routingMap.set('id', callback);
    asClient(client).subClient.quit.mockImplementationOnce(async () => {
      manuallyClosedDuringQuit = asClient(client).isManuallyClosed;
      return 'OK';
    });

    await client.close();

    expect(manuallyClosedDuringQuit).toBe(true);
    expect(callback).toHaveBeenCalledWith({
      err: expect.objectContaining({ message: 'Connection closed' }),
    });
  });
});

/**
 * `connect` decisions:
 *   D1 `connectionPromise` cached? true -> return it, false -> create a pair.
 *   D2 `handleConnection` rejects? catch: if the failing attempt is still the
 *      current one (D3) -> discardClients, then rethrow.
 * The non-current failure (D3 false) keeps a newer promise.
 */
describe('ClientRedis.connect', () => {
  it('returns the cached connection promise without creating clients (D1 true)', async () => {
    const client = new ClientRedis({});
    const cached = Promise.resolve('cached');
    asClient(client).connectionPromise = cached;
    const createClient = vi.spyOn(client, 'createClient');

    await expect(client.connect()).resolves.toBe('cached');
    expect(createClient).not.toHaveBeenCalled();
  });

  it('creates and connects the pub/sub pair (D1 false, D2 resolve)', async () => {
    const client = new ClientRedis({});
    const pub = new FakeRedisClient();
    const sub = new FakeRedisClient();
    vi.spyOn(client, 'createClient')
      .mockResolvedValueOnce(pub as any)
      .mockResolvedValueOnce(sub as any);

    await expect(client.connect()).resolves.toBeUndefined();

    expect(pub.connect).toHaveBeenCalledTimes(1);
    expect(sub.connect).toHaveBeenCalledTimes(1);
    expect(asClient(client).pubClient).toBe(pub);
    expect(asClient(client).subClient).toBe(sub);
  });

  it('discards the pair when creating the clients fails (D2 reject, D3 true)', async () => {
    const client = new ClientRedis({});
    const pub = new FakeRedisClient();
    pub.status = 'connecting';
    const error = new Error('cannot create client');
    vi.spyOn(client, 'createClient')
      .mockResolvedValueOnce(pub as any)
      .mockRejectedValueOnce(error);
    const discard = vi.spyOn(asClient(client), 'discardClients');

    await expect(client.connect()).rejects.toBe(error);

    expect(discard).toHaveBeenCalledTimes(1);
    expect(pub.disconnect).toHaveBeenCalledTimes(1);
    expect(asClient(client).connectionPromise).toBeNull();
  });

  it('keeps a newer promise when a stale attempt fails (D3 false)', async () => {
    const client = new ClientRedis({});
    const pub = new FakeRedisClient();
    let rejectSecond!: (err: Error) => void;
    vi.spyOn(client, 'createClient')
      .mockResolvedValueOnce(pub as any)
      .mockImplementationOnce(
        () =>
          new Promise<any>((_resolve, reject) => {
            rejectSecond = reject;
          }),
      );
    const discard = vi.spyOn(asClient(client), 'discardClients');

    const attempt = client.connect();
    await vi.waitFor(() => expect(rejectSecond).toBeTypeOf('function'));
    const newer = Promise.resolve('newer');
    asClient(client).connectionPromise = newer;
    const error = new Error('stale failure');
    rejectSecond(error);

    await expect(attempt).rejects.toBe(error);
    expect(discard).not.toHaveBeenCalled();
    expect(asClient(client).connectionPromise).toBe(newer);
  });
});

/**
 * `discardClients` decisions:
 *   D1 client truthy? D2 `client.status !== 'end'`? -> disconnect; otherwise
 *   skip. It always clears the clients/promise/flags.
 */
describe('ClientRedis.discardClients', () => {
  it('disconnects only clients that are not already ended (D1/D2 both)', () => {
    const client = new ClientRedis({});
    const alive = new FakeRedisClient();
    alive.status = 'reconnecting';
    const ended = new FakeRedisClient();
    ended.status = 'end';
    asClient(client).pubClient = alive;
    asClient(client).subClient = ended;
    asClient(client).connectionPromise = Promise.resolve();
    asClient(client).wasInitialConnectionSuccessful = true;

    asClient(client).discardClients();

    expect(alive.disconnect).toHaveBeenCalledTimes(1);
    expect(ended.disconnect).not.toHaveBeenCalled();
    expect(asClient(client).pubClient).toBeNull();
    expect(asClient(client).subClient).toBeNull();
    expect(asClient(client).connectionPromise).toBeNull();
    expect(asClient(client).wasInitialConnectionSuccessful).toBe(false);
  });

  it('skips null clients (D1 false)', () => {
    const client = new ClientRedis({});
    asClient(client).pubClient = null;
    asClient(client).subClient = null;

    expect(() => asClient(client).discardClients()).not.toThrow();
  });
});

/**
 * `handleConnection` has no decisions: create both clients, register the four
 * listeners on each, forward pending listeners with a pub/sub prefix, connect.
 */
describe('ClientRedis.handleConnection', () => {
  it('creates the pair, registers listeners and replays pending listeners', async () => {
    const client = new ClientRedis({});
    const pub = new FakeRedisClient();
    const sub = new FakeRedisClient();
    vi.spyOn(client, 'createClient')
      .mockResolvedValueOnce(pub as any)
      .mockResolvedValueOnce(sub as any);
    const registerError = vi.spyOn(client, 'registerErrorListener');
    const registerReconnect = vi.spyOn(client, 'registerReconnectListener');
    const registerReady = vi.spyOn(client, 'registerReadyListener');
    const registerEnd = vi.spyOn(client, 'registerEndListener');
    const pending = vi.fn();
    asClient(client).pendingEventListeners = [
      { event: 'warning', callback: pending },
    ];

    await asClient(client).handleConnection();

    expect(registerError).toHaveBeenCalledTimes(2);
    expect(registerReconnect).toHaveBeenCalledTimes(2);
    expect(registerReady).toHaveBeenCalledTimes(2);
    expect(registerEnd).toHaveBeenCalledTimes(2);
    expect(pub.connect).toHaveBeenCalledTimes(1);
    expect(sub.connect).toHaveBeenCalledTimes(1);

    pub.emit('warning', 'pub-warning');
    sub.emit('warning', 'sub-warning');
    expect(pending).toHaveBeenCalledWith('pub', 'pub-warning');
    expect(pending).toHaveBeenCalledWith('sub', 'sub-warning');
  });
});

/**
 * `createClient` decisions:
 *   D1 `clientInfoTag` present? -> spread into options.
 *   D2 options object? `getClientOptions` spreads the constructor options.
 * The ioredis constructor is replaced by a capturing mock, so no connection
 * is ever opened (lazyConnect is asserted too).
 */
describe('ClientRedis.createClient', () => {
  it('builds a lazy client with the default host/port and no clientInfoTag (D1 false)', async () => {
    const client = new ClientRedis({ host: 'redis.local' });
    redisMock.calls.length = 0;

    await client.createClient();

    expect(redisMock.calls).toHaveLength(1);
    const options = redisMock.calls[0][0];
    expect(options).toMatchObject({
      host: 'redis.local',
      port: REDIS_DEFAULT_PORT,
      lazyConnect: true,
    });
    expect(options.clientInfoTag).toBeUndefined();
    expect(typeof options.retryStrategy).toBe('function');
  });

  it('uses the defaults and includes clientInfoTag when set (D1 true)', async () => {
    const client = new ClientRedis({ clientInfoTag: 'my-app' });
    redisMock.calls.length = 0;

    await client.createClient();

    const options = redisMock.calls[0][0];
    expect(options.host).toBe(REDIS_DEFAULT_HOST);
    expect(options.port).toBe(REDIS_DEFAULT_PORT);
    expect(options.clientInfoTag).toBe('my-app');
  });
});

/**
 * `registerErrorListener` has no decisions: logs every error.
 */
describe('ClientRedis.registerErrorListener', () => {
  it('logs errors emitted by the client', () => {
    const { client, pub } = createClientWithFakes();
    const error = new Error('redis error');

    client.registerErrorListener(pub);
    pub.emit('error', error);

    expect(asClient(client).logger.error).toHaveBeenCalledWith(error);
  });
});

/**
 * `registerReconnectListener` decisions:
 *   D1 `isManuallyClosed`? true -> ignore.
 *   D2 `!isCurrentClient(client)`? true -> ignore.
 *   D3 `wasInitialConnectionSuccessful`? true -> extra log, false -> no log.
 * The reconnecting status and the rejected cached promise are set on both
 * live paths.
 */
describe('ClientRedis.registerReconnectListener', () => {
  it('ignores a manually closed client (D1 true)', async () => {
    const { client, pub } = createClientWithFakes();
    asClient(client).isManuallyClosed = true;
    const connectionPromise = Promise.resolve();
    asClient(client).connectionPromise = connectionPromise;

    client.registerReconnectListener(pub);
    pub.emit('reconnecting');

    expect(asClient(client).connectionPromise).toBe(connectionPromise);
    expect(asClient(client).logger.log).not.toHaveBeenCalled();
  });

  it('ignores a client that is no longer current (D2 true)', () => {
    const { client, pub } = createClientWithFakes();
    asClient(client).pubClient = new FakeRedisClient();
    asClient(client).subClient = new FakeRedisClient();
    const connectionPromise = Promise.resolve();
    asClient(client).connectionPromise = connectionPromise;

    client.registerReconnectListener(pub);
    pub.emit('reconnecting');

    expect(asClient(client).connectionPromise).toBe(connectionPromise);
  });

  it('caches a rejection and reports RECONNECTING (D2 false, D3 false)', async () => {
    const { client, pub } = createClientWithFakes();
    asClient(client).wasInitialConnectionSuccessful = false;
    const { statuses, subscription } = collectStatuses(client);

    client.registerReconnectListener(pub);
    pub.emit('reconnecting');

    await expect(asClient(client).connectionPromise).rejects.toBe(
      'Error: Connection lost. Trying to reconnect...',
    );
    expect(statuses).toEqual([RedisStatus.RECONNECTING]);
    expect(asClient(client).logger.log).not.toHaveBeenCalled();
    subscription.unsubscribe();
  });

  it('logs the reconnect when the initial connection had succeeded (D3 true)', async () => {
    const { client, pub } = createClientWithFakes();
    asClient(client).wasInitialConnectionSuccessful = true;
    const { subscription } = collectStatuses(client);

    client.registerReconnectListener(pub);
    pub.emit('reconnecting');

    await expect(asClient(client).connectionPromise).rejects.toBeDefined();
    expect(asClient(client).logger.log).toHaveBeenCalledWith(
      'Reconnecting to Redis...',
    );
    subscription.unsubscribe();
  });
});

/**
 * `registerReadyListener` decisions:
 *   D1 `!isCurrentClient`? -> return
 *   D2 `pubClient?.status !== 'ready'`? -> return (covers pub null)
 *   D3 `subClient?.status !== 'ready'`? -> return (covers sub null)
 *   D4 `!wasInitialConnectionSuccessful`? -> attach message listener
 *   D5 `returnBuffers`? -> 'messageBuffer' vs 'message'
 */
describe('ClientRedis.registerReadyListener', () => {
  it('ignores a non-current client (D1 true)', () => {
    const { client, sub } = createClientWithFakes();
    asClient(client).pubClient = new FakeRedisClient();
    asClient(client).subClient = new FakeRedisClient();
    asClient(client).pubClient.status = 'ready';
    asClient(client).subClient.status = 'ready';
    const { statuses, subscription } = collectStatuses(client);

    client.registerReadyListener(sub);
    sub.emit('ready');

    expect(statuses).toEqual([]);
    subscription.unsubscribe();
  });

  it.each([
    ['pub client is not ready (D2 true)', 'connecting', 'ready'],
    ['sub client is not ready (D3 true)', 'ready', 'connecting'],
    ['pub client is missing (D2 true)', null, 'ready'],
  ])('returns early when the %s', (_name, pubStatus, subStatus) => {
    const { client, sub } = createClientWithFakes();
    asClient(client).pubClient =
      pubStatus === null
        ? null
        : Object.assign(new FakeRedisClient(), {
            status: pubStatus,
          });
    sub.status = subStatus;
    const { statuses, subscription } = collectStatuses(client);

    client.registerReadyListener(sub);
    sub.emit('ready');

    expect(statuses).toEqual([]);
    expect(asClient(client).logger.log).not.toHaveBeenCalled();
    subscription.unsubscribe();
  });

  it('reports CONNECTED and subscribes to "message" once ready (D4 true, D5 false)', () => {
    const { client, sub } = createClientWithFakes();
    asClient(client).pubClient.status = 'ready';
    sub.status = 'ready';
    asClient(client).wasInitialConnectionSuccessful = false;
    const { statuses, subscription } = collectStatuses(client);

    client.registerReadyListener(sub);
    sub.emit('ready');

    expect(statuses).toEqual([RedisStatus.CONNECTED]);
    expect(asClient(client).logger.log).toHaveBeenCalledWith(
      'Connected to Redis. Subscribing to channels...',
    );
    expect(asClient(client).wasInitialConnectionSuccessful).toBe(true);
    expect(sub.listenerCount('message')).toBe(1);
    expect(sub.listenerCount('messageBuffer')).toBe(0);
    subscription.unsubscribe();
  });

  it('subscribes to "messageBuffer" when returnBuffers is true (D5 true)', () => {
    const client = new ClientRedis({ returnBuffers: true });
    vi.spyOn(asClient(client).logger, 'log').mockImplementation(() => {});
    const pub = new FakeRedisClient();
    pub.status = 'ready';
    const sub = new FakeRedisClient();
    sub.status = 'ready';
    asClient(client).pubClient = pub;
    asClient(client).subClient = sub;
    const { subscription } = collectStatuses(client);

    client.registerReadyListener(sub);
    sub.emit('ready');

    expect(sub.listenerCount('messageBuffer')).toBe(1);
    expect(sub.listenerCount('message')).toBe(0);
    subscription.unsubscribe();
  });

  it('does not attach the response listener again after a reconnect (D4 false)', () => {
    const { client, sub } = createClientWithFakes();
    asClient(client).pubClient.status = 'ready';
    sub.status = 'ready';
    asClient(client).wasInitialConnectionSuccessful = true;
    const { subscription } = collectStatuses(client);

    client.registerReadyListener(sub);
    sub.emit('ready');

    expect(sub.listenerCount('message')).toBe(0);
    subscription.unsubscribe();
  });
});

/**
 * `registerEndListener` decisions:
 *   D1 `isManuallyClosed`? true -> return.
 *   D2 `!isCurrentClient`? true -> return.
 *   live path: DISCONNECTED status + handleClose + error log + discard.
 */
describe('ClientRedis.registerEndListener', () => {
  it('ignores an end during a manual close (D1 true)', () => {
    const { client } = createClientWithFakes();
    asClient(client).isManuallyClosed = true;
    const handleClose = vi.spyOn(client, 'handleClose');
    const discard = vi.spyOn(asClient(client), 'discardClients');
    const sub = asClient(client).subClient;

    client.registerEndListener(sub);
    sub.emit('end');

    expect(handleClose).not.toHaveBeenCalled();
    expect(discard).not.toHaveBeenCalled();
  });

  it('ignores the end of a dropped client (D2 true)', () => {
    const { client, sub } = createClientWithFakes();
    asClient(client).pubClient = new FakeRedisClient();
    asClient(client).subClient = new FakeRedisClient();
    const handleClose = vi.spyOn(client, 'handleClose');

    client.registerEndListener(sub);
    sub.emit('end');

    expect(handleClose).not.toHaveBeenCalled();
  });

  it('reports DISCONNECTED, tears down and discards the pair (D1/D2 false)', () => {
    const { client, sub } = createClientWithFakes();
    asClient(client).isManuallyClosed = false;
    sub.status = 'end';
    const handleClose = vi.spyOn(client, 'handleClose');
    const discard = vi.spyOn(asClient(client), 'discardClients');
    const { statuses, subscription } = collectStatuses(client);

    client.registerEndListener(sub);
    sub.emit('end');

    expect(statuses).toEqual([RedisStatus.DISCONNECTED]);
    expect(handleClose).toHaveBeenCalledTimes(1);
    expect(discard).toHaveBeenCalledTimes(1);
    expect(asClient(client).logger.error).toHaveBeenCalledWith(
      'Disconnected from Redis.',
    );
    subscription.unsubscribe();
  });
});

/**
 * `handleClose` decisions:
 *   D1 `routingMap.size > 0`? true -> flush requests, false -> skip.
 *   D2 each callback throws? catch -> logger.error, continue.
 * `subscriptionsCount` is always cleared.
 */
describe('ClientRedis.handleClose', () => {
  it('clears only the subscription counters when nothing is pending (D1 false)', () => {
    const { client } = createClientWithFakes();
    asClient(client).subscriptionsCount.set('channel', 1);

    client.handleClose();

    expect(asClient(client).subscriptionsCount.size).toBe(0);
  });

  it('fails pending requests and keeps flushing when a callback throws (D1 true, D2 both)', () => {
    const { client } = createClientWithFakes();
    const throwing = vi.fn(() => {
      throw new Error('callback failed');
    });
    const other = vi.fn();
    asClient(client).routingMap.set('a', throwing);
    asClient(client).routingMap.set('b', other);

    client.handleClose();

    expect(throwing).toHaveBeenCalledTimes(1);
    expect(other).toHaveBeenCalledWith({
      err: expect.objectContaining({ message: 'Connection closed' }),
    });
    expect(asClient(client).logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'callback failed' }),
    );
    expect(asClient(client).routingMap.size).toBe(0);
  });
});

/**
 * `getClientOptions` has no decisions besides spreading the options; the
 * returned `retryStrategy` delegates to createRetryStrategy.
 */
describe('ClientRedis.getClientOptions', () => {
  it('spreads the options and delegates retryStrategy', () => {
    const client = new ClientRedis({ host: 'custom', retryAttempts: 2 });
    const createRetryStrategy = vi
      .spyOn(client, 'createRetryStrategy')
      .mockReturnValue(123);

    const options = client.getClientOptions() as any;

    expect(options.host).toBe('custom');
    expect(options.retryStrategy(4)).toBe(123);
    expect(createRetryStrategy).toHaveBeenCalledWith(4);
  });
});

/**
 * `on` decisions:
 *   D1 both `subClient` and `pubClient` set? true -> attach to both; false ->
 *   only keep the listener for the pair created later.
 */
describe('ClientRedis.on', () => {
  it('keeps the listener when no clients exist (D1 false)', () => {
    const client = new ClientRedis({});
    const callback = vi.fn();

    client.on('warning', callback);

    expect(asClient(client).pendingEventListeners).toEqual([
      { event: 'warning', callback },
    ]);
  });

  it('attaches the listener to both clients with the pub/sub prefix (D1 true)', () => {
    const { client, pub, sub } = createClientWithFakes();
    const callback = vi.fn();

    client.on('warning', callback);
    pub.emit('warning', 'p');
    sub.emit('warning', 's');

    expect(callback).toHaveBeenCalledWith('pub', 'p');
    expect(callback).toHaveBeenCalledWith('sub', 's');
    expect(asClient(client).pendingEventListeners).toHaveLength(1);
  });
});

/**
 * `unwrap` decisions:
 *   D1 both clients set? false -> throw; true -> [pub, sub].
 */
describe('ClientRedis.unwrap', () => {
  it('throws before connect (D1 false)', () => {
    const client = new ClientRedis({});

    expect(() => client.unwrap()).toThrow(
      'Not initialized. Please call the "connect" method first.',
    );
  });

  it('throws when only one client exists (D1 false)', () => {
    const { client } = createClientWithFakes();
    asClient(client).subClient = null;

    expect(() => client.unwrap()).toThrow(
      'Not initialized. Please call the "connect" method first.',
    );
  });

  it('returns the pub/sub pair after connect (D1 true)', () => {
    const { client, pub, sub } = createClientWithFakes();

    expect(client.unwrap()).toEqual([pub, sub]);
  });
});

/**
 * `createRetryStrategy` decisions:
 *   D1 `isManuallyClosed`? true -> undefined.
 *   D2 `retryAttempts` falsy? true -> undefined.
 *   D3 `times > retryAttempts`? true -> undefined; false -> delay.
 *   D4 `retryDelay` present? -> value, missing -> 5000.
 */
describe('ClientRedis.createRetryStrategy', () => {
  it('returns undefined when the client is manually closed (D1 true)', () => {
    const { client } = createClientWithFakes();
    asClient(client).isManuallyClosed = true;

    expect(client.createRetryStrategy(1)).toBeUndefined();
  });

  it('returns undefined and logs when retryAttempts is missing (D2 true)', () => {
    const client = new ClientRedis({});
    const logError = vi
      .spyOn(asClient(client).logger, 'error')
      .mockImplementation(() => {});

    expect(client.createRetryStrategy(1)).toBeUndefined();
    expect(logError).toHaveBeenCalledWith(
      'Redis connection closed and retry attempts not specified',
    );
  });

  it('returns undefined when the attempts are exhausted (D3 true)', () => {
    const client = new ClientRedis({ retryAttempts: 2 });
    const logError = vi
      .spyOn(asClient(client).logger, 'error')
      .mockImplementation(() => {});

    expect(client.createRetryStrategy(3)).toBeUndefined();
    expect(logError).toHaveBeenCalledWith('Retry time exhausted');
  });

  it('returns the custom delay while attempts remain (D3 false, D4 true)', () => {
    const client = new ClientRedis({ retryAttempts: 2, retryDelay: 25 });

    expect(client.createRetryStrategy(2)).toBe(25);
  });

  it('returns the 5000 ms default while attempts remain (D3 false, D4 false)', () => {
    const client = new ClientRedis({ retryAttempts: 2 });

    expect(client.createRetryStrategy(1)).toBe(5000);
  });
});

/**
 * `createResponseCallback` decisions:
 *   D1 `JSON.parse` succeeds? false -> use the raw buffer and log debug.
 *   D2 deserializer succeeds? false -> logger.error, return.
 *   D3 routing callback found? false -> debug (Buffer.isBuffer D4 true/false).
 *   D5 `isDisposed || err`? true -> disposed callback; false -> normal callback.
 */
describe('ClientRedis.createResponseCallback', () => {
  const message = { id: '1', response: 'res' };

  it('uses a non-JSON buffer as-is and logs the bypass (D1 false)', async () => {
    const { client } = createClientWithFakes();
    const deserialize = vi.fn(async () => message);
    asClient(client).deserializer = { deserialize };
    const callback = vi.fn();
    asClient(client).routingMap.set('1', callback);
    const buffer = Buffer.from('not-json');

    await client.createResponseCallback()('channel', buffer as any);

    expect(asClient(client).logger.debug).toHaveBeenCalledWith(
      'Redis response packet is not in json format, bypassing...',
    );
    expect(deserialize).toHaveBeenCalledWith(buffer);
    expect(callback).toHaveBeenCalledWith({
      err: undefined,
      response: 'res',
    });
  });

  it('logs and resolves when the deserializer throws (D2 false)', async () => {
    const { client } = createClientWithFakes();
    const error = new TypeError('bad response');
    asClient(client).deserializer = {
      deserialize: () => {
        throw error;
      },
    };
    const callback = vi.fn();
    asClient(client).routingMap.set('1', callback);

    await expect(
      client.createResponseCallback()('channel', JSON.stringify(message)),
    ).resolves.toBeUndefined();

    expect(asClient(client).logger.error).toHaveBeenCalledWith(
      `Dropped a response that the deserializer failed on: ${error}`,
      error.stack,
    );
    expect(callback).not.toHaveBeenCalled();
  });

  it('returns when no callback matches, with the buffer hint for Buffers (D3 false, D4 true)', async () => {
    const { client } = createClientWithFakes();
    asClient(client).deserializer = {
      deserialize: async () => ({ ...message, id: 'missing' }),
    };
    const buffer = Buffer.from(JSON.stringify(message));

    await client.createResponseCallback()('channel', buffer as any);

    expect(asClient(client).logger.debug).toHaveBeenCalledWith(
      'You have to parse your buffer on your own to get id from it, because it is not in json format',
    );
    expect(asClient(client).logger.debug).toHaveBeenCalledWith(
      'No matching callback found for Redis response packet with id: missing',
    );
  });

  it('returns without the buffer hint for strings (D4 false)', async () => {
    const { client } = createClientWithFakes();
    asClient(client).deserializer = {
      deserialize: async () => ({ ...message, id: 'missing' }),
    };
    const debug = asClient(client).logger.debug;

    await client.createResponseCallback()('channel', JSON.stringify(message));

    expect(debug).toHaveBeenCalledTimes(1);
    expect(debug).toHaveBeenCalledWith(
      'No matching callback found for Redis response packet with id: missing',
    );
  });

  it('marks a disposed reply as disposed (D5 disposed)', async () => {
    const { client } = createClientWithFakes();
    asClient(client).deserializer = {
      deserialize: async () => ({ ...message, isDisposed: true }),
    };
    const callback = vi.fn();
    asClient(client).routingMap.set('1', callback);

    await client.createResponseCallback()('channel', JSON.stringify(message));

    expect(callback).toHaveBeenCalledWith({
      err: undefined,
      response: 'res',
      isDisposed: true,
    });
  });

  it('marks an error reply as disposed (D5 err)', async () => {
    const { client } = createClientWithFakes();
    const err = new Error('remote');
    asClient(client).deserializer = {
      deserialize: async () => ({ ...message, err }),
    };
    const callback = vi.fn();
    asClient(client).routingMap.set('1', callback);

    await client.createResponseCallback()('channel', JSON.stringify(message));

    expect(callback).toHaveBeenCalledWith({
      err,
      response: 'res',
      isDisposed: true,
    });
  });

  it('passes a normal reply through (D5 false)', async () => {
    const { client } = createClientWithFakes();
    asClient(client).deserializer = {
      deserialize: async () => message,
    };
    const callback = vi.fn();
    asClient(client).routingMap.set('1', callback);

    await client.createResponseCallback()('channel', JSON.stringify(message));

    expect(callback).toHaveBeenCalledWith({
      err: undefined,
      response: 'res',
    });
  });
});

/**
 * `publish` decisions:
 *   D1 `subscriptionsCount <= 0`? true -> subscribe first; false -> publish now.
 *   D2 subscribe callback reports an error? -> callback({err}), no publish.
 *   D3 `isTornDown` before the subscription is acknowledged? -> skip publish.
 *   D4 pub.publish callback error and !isTornDown? -> undo + callback({err}).
 *   D5 pub.publish throws synchronously? -> undo bookkeeping + callback({err}).
 *   D6 outer catch (assign/serialize/getReplyPattern) -> callback({err}).
 *   D7 cleanup before publish? -> nothing to undo.
 *   D8 cleanup after publish? -> unsubscribe when the last waiter leaves.
 */
describe('ClientRedis.publish', () => {
  const packet = { pattern: 'test', data: 'data' };
  const responseChannel = 'test.reply';

  const setup = () => {
    const { client, pub, sub } = createClientWithFakes();
    asClient(client).routingMap.clear();
    asClient(client).subscriptionsCount.clear();
    return { client, pub, sub };
  };

  it('subscribes, publishes and cleans up the last waiter (D1 true, D8 true)', () => {
    const { client, pub, sub } = setup();
    const callback = vi.fn();

    const cleanup = client['publish'](packet, callback);

    expect(sub.subscribe).toHaveBeenCalledTimes(1);
    expect(sub.subscribe.mock.calls[0][0]).toBe(responseChannel);
    expect(pub.publish).toHaveBeenCalledTimes(1);
    expect(pub.publish.mock.calls[0][0]).toBe('test');
    const serialized = JSON.parse(pub.publish.mock.calls[0][1]);
    expect(serialized).toMatchObject(packet);
    expect(asClient(client).routingMap.size).toBe(1);
    expect(asClient(client).subscriptionsCount.get(responseChannel)).toBe(1);

    cleanup();

    expect(sub.unsubscribe).toHaveBeenCalledWith(
      responseChannel,
      expect.any(Function),
    );
    expect(asClient(client).routingMap.size).toBe(0);
    expect(asClient(client).subscriptionsCount.has(responseChannel)).toBe(
      false,
    );
  });

  it('publishes immediately when the channel already has a waiter (D1 false)', () => {
    const { client, pub, sub } = setup();
    asClient(client).subscriptionsCount.set(responseChannel, 1);

    const cleanup = client['publish'](packet, vi.fn());

    expect(sub.subscribe).not.toHaveBeenCalled();
    expect(pub.publish).toHaveBeenCalledTimes(1);

    cleanup();
    expect(asClient(client).subscriptionsCount.get(responseChannel)).toBe(1);
    expect(sub.unsubscribe).not.toHaveBeenCalled();
  });

  it('reports a subscribe error and does not publish (D2 true)', () => {
    const { client, pub, sub } = setup();
    const error = new Error('Connection is closed.');
    sub.subscribe.mockImplementationOnce(
      (_channel: string, callback?: (err?: Error) => void) => callback?.(error),
    );
    const callback = vi.fn();

    client['publish'](packet, callback);

    expect(callback).toHaveBeenCalledWith({ err: error });
    expect(pub.publish).not.toHaveBeenCalled();
    expect(asClient(client).routingMap.size).toBe(0);
  });

  it('does not publish when torn down before the subscribe is acknowledged (D3 true)', () => {
    const { client, pub, sub } = setup();
    let acknowledge = () => {};
    sub.subscribe.mockImplementationOnce((_channel, callback) => {
      acknowledge = () => callback?.();
    });
    const callback = vi.fn();

    const cleanup = client['publish'](packet, callback);
    cleanup();
    acknowledge();

    expect(pub.publish).not.toHaveBeenCalled();
    expect(sub.unsubscribe).not.toHaveBeenCalled();
    expect(callback).not.toHaveBeenCalled();
    expect(asClient(client).routingMap.size).toBe(0);
  });

  it('undoes the bookkeeping and reports an asynchronous publish error (D4 true)', async () => {
    const { client, pub } = setup();
    const error = new Error('publish failed');
    pub.publish.mockImplementationOnce((_channel, _message, callback) => {
      setImmediate(() => callback?.(error));
    });
    const callback = vi.fn();

    client['publish'](packet, callback);
    await vi.waitFor(() => expect(callback).toHaveBeenCalled());

    expect(callback).toHaveBeenCalledWith({ err: error });
    expect(asClient(client).routingMap.size).toBe(0);
    expect(asClient(client).subscriptionsCount.has(responseChannel)).toBe(
      false,
    );
  });

  it('ignores a late publish error after teardown (D4 false)', async () => {
    const { client, pub } = setup();
    let fail: (err: Error) => void = () => {};
    pub.publish.mockImplementationOnce((_channel, _message, callback) => {
      fail = err => callback?.(err);
    });
    const callback = vi.fn();

    const cleanup = client['publish'](packet, callback);
    cleanup();
    fail(new Error('late'));

    await new Promise(resolve => setImmediate(resolve));
    expect(callback).not.toHaveBeenCalled();
  });

  it('reports a synchronous publish throw and leaves the broker subscription (D5)', () => {
    const { client, pub, sub } = setup();
    const error = new Error('Send error');
    pub.publish.mockImplementationOnce(() => {
      throw error;
    });
    const callback = vi.fn();

    const cleanup = client['publish'](packet, callback);

    expect(callback).toHaveBeenCalledWith({ err: error });
    expect(asClient(client).routingMap.size).toBe(0);
    expect(asClient(client).subscriptionsCount.has(responseChannel)).toBe(
      false,
    );
    expect(sub.unsubscribe).not.toHaveBeenCalled();
    expect(() => cleanup()).not.toThrow();
  });

  it('reports serialization failures through the outer catch (D6)', () => {
    const { client } = setup();
    const error = new Error('serialize failed');
    asClient(client).serializer = {
      serialize: () => {
        throw error;
      },
    };
    const callback = vi.fn();

    const cleanup = client['publish'](packet, callback);

    expect(callback).toHaveBeenCalledWith({ err: error });
    expect(asClient(client).routingMap.size).toBe(0);
    expect(() => cleanup()).not.toThrow();
  });

  it('does not unsubscribe when cleanup runs before publishing (D7)', () => {
    const { client, sub } = setup();
    let acknowledge = () => {};
    sub.subscribe.mockImplementationOnce((_channel, callback) => {
      acknowledge = () => callback?.();
    });

    const cleanup = client['publish'](packet, vi.fn());
    cleanup();
    cleanup();
    acknowledge();

    expect(sub.unsubscribe).not.toHaveBeenCalled();
  });

  it('keeps the channel while another waiter remains (D8 false)', () => {
    const { client, sub } = setup();

    const first = client['publish'](packet, vi.fn());
    const second = client['publish'](packet, vi.fn());
    expect(asClient(client).subscriptionsCount.get(responseChannel)).toBe(2);

    first();
    expect(asClient(client).subscriptionsCount.get(responseChannel)).toBe(1);
    expect(sub.unsubscribe).not.toHaveBeenCalled();

    second();
    expect(asClient(client).subscriptionsCount.has(responseChannel)).toBe(
      false,
    );
    expect(sub.unsubscribe).toHaveBeenCalledTimes(1);
  });
});

/**
 * `dispatchEvent` decisions: only the publish callback error flag (D1).
 * D1 false -> resolve; true -> reject.
 */
describe('ClientRedis.dispatchEvent', () => {
  it('publishes the serialized event and resolves (D1 false)', async () => {
    const { client, pub } = createClientWithFakes();

    await client['dispatchEvent']({ pattern: { cmd: 'event' }, data: 'x' });

    expect(pub.publish).toHaveBeenCalledTimes(1);
    expect(pub.publish.mock.calls[0][0]).toBe('{"cmd":"event"}');
    expect(JSON.parse(pub.publish.mock.calls[0][1])).toEqual({
      pattern: { cmd: 'event' },
      data: 'x',
    });
  });

  it('rejects when the publish callback reports an error (D1 true)', async () => {
    const { client, pub } = createClientWithFakes();
    const error = new Error('publish failed');
    pub.publish.mockImplementationOnce((_channel, _message, callback) => {
      callback?.(error);
    });

    await expect(
      client['dispatchEvent']({ pattern: 'event', data: 'x' }),
    ).rejects.toBe(error);
  });

  it('rejects when publish throws synchronously', async () => {
    const { client, pub } = createClientWithFakes();
    const error = new Error('send failed');
    pub.publish.mockImplementationOnce(() => {
      throw error;
    });

    await expect(
      client['dispatchEvent']({ pattern: 'event', data: 'x' }),
    ).rejects.toBe(error);
  });
});

/**
 * `unsubscribeFromChannel` decisions:
 *   D1 `subscriptionCount - 1 <= 0`? true -> unsubscribe, false -> keep.
 * `setSubscriptionsCount` decisions: D2 count > 0? set vs delete.
 */
describe('ClientRedis.unsubscribeFromChannel / setSubscriptionsCount', () => {
  it('unsubscribes when the last waiter leaves (D1 true)', () => {
    const { client, sub } = createClientWithFakes();
    asClient(client).subscriptionsCount.set('channel', 1);

    client['unsubscribeFromChannel']('channel');

    expect(sub.unsubscribe).toHaveBeenCalledTimes(1);
    expect(asClient(client).subscriptionsCount.has('channel')).toBe(false);
  });

  it('keeps the channel subscribed while waiters remain (D1 false)', () => {
    const { client, sub } = createClientWithFakes();
    asClient(client).subscriptionsCount.set('channel', 2);

    client['unsubscribeFromChannel']('channel');

    expect(sub.unsubscribe).not.toHaveBeenCalled();
    expect(asClient(client).subscriptionsCount.get('channel')).toBe(1);
  });

  it.each([
    [2, true],
    [0, false],
    [-1, false],
  ])('stores %i only when positive (D2)', (count, expected) => {
    const { client } = createClientWithFakes();

    asClient(client).setSubscriptionsCount('channel', count);

    expect(asClient(client).subscriptionsCount.has('channel')).toBe(expected);
  });
});
