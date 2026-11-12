import { EventEmitter } from 'events';
import { EMPTY } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ClientMqtt } from '../../../../packages/microservices/client/client-mqtt.js';
import {
  ECONNREFUSED,
  ENOTFOUND,
  MQTT_DEFAULT_URL,
  MQTT_MAX_TOPIC_LENGTH,
} from '../../../../packages/microservices/constants.js';
import { IncomingResponseDeserializer } from '../../../../packages/microservices/deserializers/incoming-response.deserializer.js';
import { MaxMqttTopicLengthExceededException } from '../../../../packages/microservices/errors/max-mqtt-topic-length-exceeded.exception.js';
import { MqttRecord } from '../../../../packages/microservices/record-builders/mqtt.record-builder.js';
import { MqttRecordSerializer } from '../../../../packages/microservices/serializers/mqtt-record.serializer.js';

// `createClient()` inside `connect()` goes through `loadPackage('mqtt')`, i.e.
// a dynamic `import('mqtt')`. The factory keeps the real package (and therefore
// a real broker connection) out of the suite.
const { mqttConnect } = vi.hoisted(() => ({ mqttConnect: vi.fn() }));
vi.mock('mqtt', () => ({ connect: mqttConnect }));

const asAny = (value: unknown) => value as any;
const flush = () => new Promise<void>(resolve => setImmediate(resolve));

/** The subset of the mqtt.js client that ClientMqtt touches. */
const createFakeClient = (overrides: Record<string, any> = {}) => {
  const emitter = new EventEmitter() as any;
  emitter.options = { reconnectPeriod: 1000 };
  emitter.publish = vi.fn(
    (_topic: string, _payload: any, _options: any, done?: Function) => done?.(),
  );
  emitter.subscribe = vi.fn((_topic: string, done?: Function) => done?.());
  emitter.unsubscribe = vi.fn();
  emitter.endAsync = vi.fn().mockResolvedValue(undefined);
  return Object.assign(emitter, overrides);
};

const createClient = (options: any = {}) => {
  const client = new ClientMqtt(options);
  const logger = asAny(client).logger;
  vi.spyOn(logger, 'error').mockImplementation(() => {});
  vi.spyOn(logger, 'log').mockImplementation(() => {});
  vi.spyOn(logger, 'debug').mockImplementation(() => {});
  return client;
};

const captureStatus = (client: ClientMqtt) => {
  const statuses: string[] = [];
  const subscription = client.status.subscribe(status =>
    statuses.push(status as string),
  );
  return { statuses, stop: () => subscription.unsubscribe() };
};

/**
 * Constructor decisions:
 * D1 `url` option present in `options`? (`?? MQTT_DEFAULT_URL`)
 * D2 `serializer` option present? (D3: `deserializer` option present?)
 */
describe('ClientMqtt.constructor', () => {
  it('uses the default url, serializer and deserializer when options are empty (D1 F, D2 F, D3 F)', () => {
    const client = new ClientMqtt({});

    expect(asAny(client).url).toBe(MQTT_DEFAULT_URL);
    expect(asAny(client).serializer).toBeInstanceOf(MqttRecordSerializer);
    expect(asAny(client).deserializer).toBeInstanceOf(
      IncomingResponseDeserializer,
    );
  });

  it('keeps the custom url, serializer and deserializer (D1 T, D2 T, D3 T)', () => {
    const serializer = { serialize: vi.fn() };
    const deserializer = { deserialize: vi.fn() };

    const client = new ClientMqtt({
      url: 'mqtt://broker:9000',
      serializer,
      deserializer,
    } as any);

    expect(asAny(client).url).toBe('mqtt://broker:9000');
    expect(asAny(client).serializer).toBe(serializer);
    expect(asAny(client).deserializer).toBe(deserializer);
  });

  it('falls back to the default url when the option is explicitly undefined (D1 F)', () => {
    const client = new ClientMqtt({ url: undefined } as any);

    expect(asAny(client).url).toBe(MQTT_DEFAULT_URL);
  });
});

// No decisions in the two pattern helpers.
describe('ClientMqtt.getRequestPattern', () => {
  it('returns the pattern untouched', () => {
    const client = new ClientMqtt({});

    expect(client.getRequestPattern('orders/1')).toBe('orders/1');
  });
});

describe('ClientMqtt.getResponsePattern', () => {
  it('appends "/reply"', () => {
    const client = new ClientMqtt({});

    expect(client.getResponsePattern('orders/1')).toBe('orders/1/reply');
  });
});

/**
 * `close` decisions:
 * D1 `this.mqttClient` set? -> `endAsync()` awaited / skipped.
 * D2 `endAsync()` rejects? -> state is still reset and the rejection
 *    propagates out of the `finally`.
 */
describe('ClientMqtt.close', () => {
  it('ends the client and resets the connection state (D1 T)', async () => {
    const client = createClient();
    const fake = createFakeClient();
    asAny(client).mqttClient = fake;
    asAny(client).connectionPromise = Promise.resolve();
    asAny(client).isInitialConnection = true;
    asAny(client).subscriptionsCount.set('a/reply', 2);
    asAny(client).pendingEventListeners.push({ event: 'x', callback: vi.fn() });

    await client.close();

    expect(fake.endAsync).toHaveBeenCalledTimes(1);
    expect(asAny(client).mqttClient).toBeNull();
    expect(asAny(client).connectionPromise).toBeNull();
    expect(asAny(client).isInitialConnection).toBe(false);
    expect(asAny(client).subscriptionsCount.size).toBe(0);
    expect(asAny(client).pendingEventListeners).toEqual([]);
  });

  it('does not touch a client that was never created (D1 F)', async () => {
    const client = createClient();

    await expect(client.close()).resolves.toBeUndefined();
    expect(asAny(client).mqttClient).toBeNull();
  });

  it('resets the state and rethrows when ending the client fails (D2 T)', async () => {
    const client = createClient();
    const fake = createFakeClient({
      endAsync: vi.fn().mockRejectedValue(new Error('end failed')),
    });
    asAny(client).mqttClient = fake;
    asAny(client).connectionPromise = Promise.resolve();
    asAny(client).subscriptionsCount.set('a/reply', 1);

    await expect(client.close()).rejects.toThrow('end failed');

    expect(asAny(client).mqttClient).toBeNull();
    expect(asAny(client).connectionPromise).toBeNull();
    expect(asAny(client).subscriptionsCount.size).toBe(0);
  });

  it('fails the pending requests through handleClose() (D1 T)', async () => {
    const client = createClient();
    const callback = vi.fn();
    asAny(client).mqttClient = createFakeClient();
    asAny(client).routingMap.set('id', callback);

    await client.close();

    expect(callback).toHaveBeenCalledWith({
      err: expect.objectContaining({ message: 'Connection closed' }),
    });
  });
});

/**
 * `handleClose` decisions:
 * D1 routingMap non-empty?
 * D2 a callback throws? -> it is logged and the remaining callbacks still run.
 */
describe('ClientMqtt.handleClose', () => {
  it('does nothing when no request is pending (D1 F)', () => {
    const client = createClient();

    expect(() => client.handleClose()).not.toThrow();
  });

  it('fails every pending request and clears the map (D1 T, D2 F)', () => {
    const client = createClient();
    const first = vi.fn();
    const second = vi.fn();
    asAny(client).routingMap.set('a', first);
    asAny(client).routingMap.set('b', second);

    client.handleClose();

    expect(first).toHaveBeenCalledWith({
      err: expect.objectContaining({ message: 'Connection closed' }),
    });
    expect(second).toHaveBeenCalledWith({
      err: expect.objectContaining({ message: 'Connection closed' }),
    });
    expect(asAny(client).routingMap.size).toBe(0);
  });

  it('logs a throwing callback and still fails the next one (D2 T)', () => {
    const client = createClient();
    const throwing = vi.fn(() => {
      throw new Error('callback failed');
    });
    const other = vi.fn();
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
 * D1 `this.mqttClient` already set? -> cached `connectionPromise` returned.
 * D2 package not loaded yet? (`!mqttPackage`)
 * D3 after the await: another `connect()` of this instance already created a
 *    client? -> its promise is returned.
 * D4 `close()` ran while the package loaded? -> throws 'Connection closed'.
 * D5 the attempt rejected with `EmptyError`? INFEASIBLE: the merged source only
 *    errors on 'close' and otherwise emits on 'connect'; `fromEvent` never
 *    completes, so `lastValueFrom` cannot reject empty.
 * D6 (in the rejection handler) `this.connectionPromise === connectionPromise`
 *    AND `client.options?.reconnectPeriod === 0`? -> discardClient().
 */
describe('ClientMqtt.connect', () => {
  beforeEach(() => {
    mqttConnect.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Runs first on purpose: the module-level `mqttPackage` cache is still empty,
  // which is the only state in which `connect()` suspends before creating a
  // client (D4 needs that window).
  it('rejects when close() runs while the package is still loading (D2 T, D4 T)', async () => {
    const client = createClient();
    const attempt = client.connect();

    // `close()` never awaits in this state, so `closeCount` is bumped before
    // the pending `loadPackage()` resumes.
    await client.close();

    await expect(attempt).rejects.toThrow('Connection closed');
  });

  it('creates a client, registers the listeners and resolves on "connect" (D2 F)', async () => {
    const client = createClient();
    const fake = createFakeClient();
    mqttConnect.mockReturnValue(fake);
    const onSpy = vi.spyOn(fake, 'on');
    const pending = vi.fn();
    client.on('close', pending);

    const attempt = client.connect();
    fake.emit('connect');
    await expect(attempt).resolves.toBeUndefined();

    const events = onSpy.mock.calls.map(([event]) => event);
    expect(events).toEqual(
      expect.arrayContaining([
        'error',
        'offline',
        'reconnect',
        'connect',
        'disconnect',
        'close',
        'message',
        'close',
      ]),
    );
    expect(asAny(client).mqttClient).toBe(fake);
    expect(asAny(client).isInitialConnection).toBe(true);
  });

  it('reuses the pending connection of a concurrent connect() (D3 T, D1 F)', async () => {
    // A fresh module instance: the package is still uncached, so both calls
    // suspend in `loadPackage()` and the second one sees the client the first
    // has just created.
    vi.resetModules();
    const { ClientMqtt: FreshClientMqtt } =
      await import('../../../../packages/microservices/client/client-mqtt.js');
    const fake = createFakeClient();
    mqttConnect.mockReturnValue(fake);

    const client = new FreshClientMqtt({});
    const first = client.connect();
    const second = client.connect();
    // Both calls are suspended in `loadPackage()`; let them resume so the
    // first one can create the client and attach its listeners.
    await flush();
    fake.emit('connect');

    await expect(first).resolves.toBeUndefined();
    await expect(second).resolves.toBeUndefined();
    expect(mqttConnect).toHaveBeenCalledTimes(1);
    expect(asAny(client).mqttClient).toBe(fake);
  });

  it('returns the cached promise once connected (D1 T)', async () => {
    const client = createClient();
    const fake = createFakeClient();
    const createStub = vi
      .spyOn(client, 'createClient')
      .mockReturnValue(fake as any);

    const attempt = client.connect();
    fake.emit('connect');
    await attempt;
    const cached = asAny(client).connectionPromise;

    await expect(client.connect()).resolves.toBeUndefined();
    expect(createStub).toHaveBeenCalledTimes(1);
    expect(asAny(client).connectionPromise).toBe(cached);
  });

  it.each([
    ['reconnectPeriod 0', { options: { reconnectPeriod: 0 } }, null],
    ['reconnectPeriod 1000', { options: { reconnectPeriod: 1000 } }, 'keep'],
    ['no options at all', { options: undefined }, 'keep'],
  ])(
    'handles a failed attempt with %s (D6 %s)',
    async (_label, overrides, expected) => {
      const client = createClient();
      const fake = createFakeClient(overrides);
      vi.spyOn(client, 'createClient').mockReturnValue(fake as any);
      mqttConnect.mockReturnValue(fake);
      const err: any = new Error('connect ECONNREFUSED');
      err.code = ECONNREFUSED;

      const attempt = client.connect();
      fake.emit('error', err);

      await expect(attempt).rejects.toThrow('connect ECONNREFUSED');
      if (expected === null) {
        expect(asAny(client).mqttClient).toBeNull();
        expect(asAny(client).connectionPromise).toBeNull();
      } else {
        expect(asAny(client).mqttClient).toBe(fake);
      }
    },
  );

  it('does not discard the current client when a stale attempt rejects (D6 first atom F)', async () => {
    const client = createClient();
    const stale = createFakeClient({ options: { reconnectPeriod: 0 } });
    const current = createFakeClient({ options: { reconnectPeriod: 0 } });
    const createStub = vi
      .spyOn(client, 'createClient')
      .mockReturnValueOnce(stale as any)
      .mockReturnValueOnce(current as any);
    mqttConnect.mockReturnValue(current);

    const staleAttempt = client.connect();
    const staleResult = staleAttempt.catch(error => error);
    await client.close();

    const currentAttempt = client.connect();
    current.emit('connect');
    await currentAttempt;

    stale.emit('error', new Error('attempt timed out'));
    await expect(staleResult).resolves.toBeInstanceOf(Error);

    expect(asAny(client).mqttClient).toBe(current);
    expect(createStub).toHaveBeenCalledTimes(2);
  });
});

/**
 * `discardClient` decisions:
 * D1 `client !== this.mqttClient`? -> no-op.
 */
describe('ClientMqtt.discardClient', () => {
  it('ignores a client that is no longer the current one (D1 T)', () => {
    const client = createClient();
    const stale = createFakeClient();
    const current = createFakeClient();
    asAny(client).mqttClient = current;
    const callback = vi.fn();
    asAny(client).routingMap.set('id', callback);

    asAny(client).discardClient(stale);

    expect(asAny(client).mqttClient).toBe(current);
    expect(callback).not.toHaveBeenCalled();
  });

  it('drops the current client, its pending requests and its subscriptions (D1 F)', () => {
    const client = createClient();
    const fake = createFakeClient();
    asAny(client).mqttClient = fake;
    asAny(client).connectionPromise = Promise.resolve();
    asAny(client).isInitialConnection = true;
    asAny(client).subscriptionsCount.set('a/reply', 1);
    const callback = vi.fn();
    asAny(client).routingMap.set('id', callback);

    asAny(client).discardClient(fake);

    expect(asAny(client).mqttClient).toBeNull();
    expect(asAny(client).connectionPromise).toBeNull();
    expect(asAny(client).isInitialConnection).toBe(false);
    expect(asAny(client).subscriptionsCount.size).toBe(0);
    expect(callback).toHaveBeenCalledWith({
      err: expect.objectContaining({ message: 'Connection closed' }),
    });
  });
});

/**
 * `mergeCloseEvent` has no decision; the 'close' tap and the error mapping are
 * both exercised, as is the pass-through of the source value.
 */
describe('ClientMqtt.mergeCloseEvent', () => {
  it('passes the source value through', () => {
    const client = createClient();
    const fake = createFakeClient();
    const values: any[] = [];

    client.mergeCloseEvent(fake, EMPTY).subscribe(value => values.push(value));
    expect(values).toEqual([]);
  });

  it('emits CLOSED and throws the close payload as an error', async () => {
    const client = createClient();
    const fake = createFakeClient();
    const error = new Error('connection closed');
    const status = captureStatus(client);

    const result = new Promise(resolve =>
      client.mergeCloseEvent(fake, EMPTY).subscribe({
        error: err => resolve(err),
      }),
    );
    fake.emit('close', error);

    await expect(result).resolves.toBe(error);
    expect(status.statuses).toEqual(['closed']);
    status.stop();
  });
});

/**
 * `createClient` decisions:
 * D1 `mqttPackage ??= loadPackageSync(...)`: the assign outcome (first call in
 *    a process) would call `connect()` of the real mqtt package, i.e. open a
 *    real broker connection, which the suite must not do. INFEASIBLE here; only
 *    the cached-package outcome is exercised.
 */
describe('ClientMqtt.createClient', () => {
  beforeEach(() => {
    mqttConnect.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('connects the loaded package with the default url and the options (D1 F)', async () => {
    const client = createClient({ connectTimeout: 1234 });
    await primePackage(client);
    mqttConnect.mockClear();
    mqttConnect.mockReturnValue(createFakeClient());

    const created = asAny(client).createClient();

    expect(mqttConnect).toHaveBeenCalledWith(
      MQTT_DEFAULT_URL,
      expect.objectContaining({ connectTimeout: 1234 }),
    );
    expect(created).toBeDefined();
  });

  it('uses the configured url (D1 F)', async () => {
    const client = createClient({ url: 'mqtt://broker:9000' });
    await primePackage(client);
    mqttConnect.mockClear();
    mqttConnect.mockReturnValue(createFakeClient());

    asAny(client).createClient();

    expect(mqttConnect).toHaveBeenCalledWith(
      'mqtt://broker:9000',
      expect.anything(),
    );
  });
});

/** Loads the (mocked) package without relying on the createClient branch. */
const primePackage = async (client: ClientMqtt) => {
  const fake = createFakeClient();
  const stub = vi.spyOn(client, 'createClient').mockReturnValue(fake as any);
  const attempt = client.connect();
  fake.emit('connect');
  await attempt;
  stub.mockRestore();
};

/**
 * `registerErrorListener` decisions:
 * D1 `err.code === ECONNREFUSED`? D2 `err.code === ENOTFOUND`? -> ignored
 * (logger.error not called). Both atoms get a true and a false case.
 */
describe('ClientMqtt.registerErrorListener', () => {
  it.each([
    ['ECONNREFUSED', { code: ECONNREFUSED }, 0],
    ['ENOTFOUND', { code: ENOTFOUND }, 0],
    ['another code', { code: 'EPERM' }, 1],
    ['no code', new Error('socket hang up'), 1],
  ])('binds "error" and logs for %s', (_label, err, logged) => {
    const client = createClient();
    const fake = createFakeClient();

    client.registerErrorListener(fake);
    fake.emit('error', err);

    expect(fake.listenerCount('error')).toBe(1);
    expect(asAny(client).logger.error).toHaveBeenCalledTimes(logged);
  });
});

// No decisions: the offline handler always replaces the promise and logs.
describe('ClientMqtt.registerOfflineListener', () => {
  it('rejects the connection promise and logs', async () => {
    const client = createClient();
    const fake = createFakeClient();

    client.registerOfflineListener(fake);
    fake.emit('offline');

    await expect(asAny(client).connectionPromise).rejects.toBe(
      'Error: Connection lost. Trying to reconnect...',
    );
    expect(asAny(client).logger.error).toHaveBeenCalledWith(
      'MQTT broker went offline.',
    );
  });
});

// No decisions: the reconnect handler always toggles the flag and the status.
describe('ClientMqtt.registerReconnectListener', () => {
  it('sets the reconnecting flag and the RECONNECTING status', () => {
    const client = createClient();
    const fake = createFakeClient();
    const status = captureStatus(client);

    client.registerReconnectListener(fake);
    fake.emit('reconnect');

    expect(asAny(client).isReconnecting).toBe(true);
    expect(status.statuses).toEqual(['reconnecting']);
    status.stop();
  });
});

// No decisions: the disconnect handler always emits DISCONNECTED.
describe('ClientMqtt.registerDisconnectListener', () => {
  it('emits the DISCONNECTED status', () => {
    const client = createClient();
    const fake = createFakeClient();
    const status = captureStatus(client);

    client.registerDisconnectListener(fake);
    fake.emit('disconnect');

    expect(status.statuses).toEqual(['disconnected']);
    status.stop();
  });
});

/**
 * `registerCloseListener` decisions:
 * D1 `client === this.mqttClient`? D2 `client.reconnecting`?
 * D3 `client.reconnectTimer !== null`? (D2 short-circuits D3)
 * D4 `!willReconnect`? -> discardClient().
 */
describe('ClientMqtt.registerCloseListener', () => {
  it.each([
    ['a current client that gave up', true, false, null, true],
    ['a current client with a scheduled reconnect', true, true, {}, false],
    ['a refused CONNACK (reconnecting, no timer)', true, true, null, true],
    ['a client that is not the current one', false, false, null, false],
  ])(
    'discards %s (D1/D2/D3/D4)',
    (_label, isCurrent, reconnecting, reconnectTimer, discarded) => {
      const client = createClient();
      const fake = createFakeClient();
      fake.reconnecting = reconnecting;
      fake.reconnectTimer = reconnectTimer;
      asAny(client).mqttClient = isCurrent ? fake : createFakeClient();
      asAny(client).connectionPromise = Promise.resolve();
      const current = asAny(client).mqttClient;
      const status = captureStatus(client);

      client.registerCloseListener(fake);
      fake.emit('close');

      expect(status.statuses).toEqual(['closed']);
      expect(asAny(client).mqttClient).toBe(discarded ? null : current);
      status.stop();
    },
  );
});

/**
 * `registerConnectListener` decisions:
 * D1 `isInitialConnection` false? -> the response listener is attached once.
 */
describe('ClientMqtt.registerConnectListener', () => {
  it('attaches the response listener on the first connect only (D1 T then F)', () => {
    const client = createClient();
    const fake = createFakeClient();
    client.registerConnectListener(fake);
    const [onConnect] = fake.listeners('connect') as Array<Function>;
    expect(fake.listenerCount('connect')).toBe(1);

    onConnect();
    expect(fake.listenerCount('message')).toBe(1);
    expect(asAny(client).isReconnecting).toBe(false);

    onConnect();
    expect(fake.listenerCount('message')).toBe(1);
    // The response listener routes through the deserializer.
    expect(() =>
      fake.emit('message', 'topic', Buffer.from('{}')),
    ).not.toThrow();
  });

  it('emits CONNECTED and resolves the connection promise', async () => {
    const client = createClient();
    const fake = createFakeClient();
    const status = captureStatus(client);

    client.registerConnectListener(fake);
    fake.emit('connect');

    expect(status.statuses).toEqual(['connected']);
    await expect(asAny(client).connectionPromise).resolves.toBeUndefined();
    status.stop();
  });
});

/**
 * `on` decisions:
 * D1 `this.mqttClient` set? -> the listener is forwarded right away, but it is
 * also kept for the clients created later.
 */
describe('ClientMqtt.on', () => {
  it('queues the listener when no client exists yet (D1 F)', () => {
    const client = createClient();
    const callback = vi.fn();

    client.on('connect', callback);

    expect(asAny(client).pendingEventListeners).toEqual([
      { event: 'connect', callback },
    ]);
  });

  it('forwards the listener to an existing client (D1 T)', () => {
    const client = createClient();
    const fake = createFakeClient();
    asAny(client).mqttClient = fake;
    const callback = vi.fn();

    client.on('close', callback);
    fake.emit('close');

    expect(callback).toHaveBeenCalledTimes(1);
    expect(asAny(client).pendingEventListeners).toEqual([
      { event: 'close', callback },
    ]);
  });
});

/**
 * `unwrap` decisions:
 * D1 `!this.mqttClient`? -> throws when not connected.
 */
describe('ClientMqtt.unwrap', () => {
  it('throws before connect() (D1 T)', () => {
    const client = createClient();

    expect(() => client.unwrap()).toThrow(/connect/);
  });

  it('returns the client once connected (D1 F)', () => {
    const client = createClient();
    const fake = createFakeClient();
    asAny(client).mqttClient = fake;

    expect(client.unwrap()).toBe(fake);
  });
});

/**
 * `createResponseCallback` decisions:
 * D1 buffer parses as JSON? (catch logs debug and keeps the raw string)
 * D2 `deserializer.deserialize` resolves? (throw/reject -> logged, dropped)
 * D3 a callback is registered for the id?
 * D4 `isDisposed`? D5 `err`? -> callback with isDisposed
 */
describe('ClientMqtt.createResponseCallback', () => {
  const response = { id: '1', response: 'payload' };

  it('dispatches a JSON response to the pending request (D1 T, D2 T, D3 T, D4 F, D5 F)', async () => {
    const client = createClient();
    const callback = vi.fn();
    asAny(client).routingMap.set('1', callback);

    await client.createResponseCallback()(
      'channel',
      Buffer.from(JSON.stringify(response)),
    );

    expect(callback).toHaveBeenCalledWith({
      err: undefined,
      response: 'payload',
    });
  });

  it('passes a non-JSON buffer to the deserializer (D1 F)', async () => {
    const client = createClient();
    const callback = vi.fn();
    const deserialize = vi.fn().mockResolvedValue({
      id: '1',
      response: 'raw',
    });
    Object.assign(client, { deserializer: { deserialize } });
    asAny(client).routingMap.set('1', callback);

    await client.createResponseCallback()('channel', Buffer.from('1|raw'));

    expect(asAny(client).logger.debug).toHaveBeenCalledWith(
      'MQTT response packet is not in json format, bypassing...',
    );
    expect(deserialize).toHaveBeenCalledWith('1|raw');
    expect(callback).toHaveBeenCalledWith({ err: undefined, response: 'raw' });
  });

  it('logs and resolves when the deserializer throws (D2 F)', async () => {
    const client = createClient();
    const error = new Error('bad packet');
    Object.assign(client, {
      deserializer: {
        deserialize: () => {
          throw error;
        },
      },
    });

    await expect(
      client.createResponseCallback()('channel', Buffer.from('{}')),
    ).resolves.toBeUndefined();
    expect(asAny(client).logger.error).toHaveBeenCalledWith(
      `Dropped a response that the deserializer failed on: ${error}`,
      error.stack,
    );
  });

  it('logs and resolves when the deserializer rejects (D2 F)', async () => {
    const client = createClient();
    const error = new Error('bad packet');
    Object.assign(client, {
      deserializer: { deserialize: () => Promise.reject(error) },
    });

    await expect(
      client.createResponseCallback()('channel', Buffer.from('{}')),
    ).resolves.toBeUndefined();
    expect(asAny(client).logger.error).toHaveBeenCalledTimes(1);
  });

  it('ignores a response without a pending request (D3 F)', async () => {
    const client = createClient();

    await expect(
      client.createResponseCallback()(
        'channel',
        Buffer.from(JSON.stringify(response)),
      ),
    ).resolves.toBeUndefined();
  });

  it.each([
    ['isDisposed true', { isDisposed: true }, undefined],
    ['an error', { err: new Error('handler failed') }, undefined],
  ])('reports %s as disposed (D4 T, D5 T)', async (_label, extra, _unused) => {
    const client = createClient();
    const callback = vi.fn();
    asAny(client).routingMap.set('1', callback);

    await client.createResponseCallback()(
      'channel',
      Buffer.from(JSON.stringify({ ...response, ...extra })),
    );

    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({ isDisposed: true }),
    );
  });
});

/**
 * `publish` decisions:
 * D1 `isCounted` (undoBookkeeping guard)? D2 `isCounted` (publishPacket guard)?
 * D3 `data` is an object? D4 `data instanceof MqttRecord`?
 * D5 publish callback: `err && isCounted`?
 * D6 the publish throws synchronously? (inner catch, outside the outer try)
 * D7 `isCounted` (cleanup guard)?
 * D8 `subscriptionsCount <= 0`? -> subscribe first, else publish directly.
 * D9 the subscribe reply carries an error?
 * Plus the outer catch (any throw before the subscription, e.g. topic length).
 */
describe('ClientMqtt.publish', () => {
  const packet = () => ({ pattern: 'orders', data: 'data' });
  let client: ClientMqtt;
  let fake: any;
  let theClientId: string;

  const publish = (
    message: Record<string, any> = packet(),
    callback: (...args: any[]) => any = vi.fn(),
  ) => asAny(client).publish(message, callback);

  beforeEach(() => {
    client = createClient();
    fake = createFakeClient();
    asAny(client).mqttClient = fake;
    theClientId = 'generated-id';
    vi.spyOn(asAny(client), 'assignPacketId').mockImplementation(
      (message: any) => Object.assign(message, { id: theClientId }),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('subscribes to the reply topic and publishes on acknowledgement (D8 T, D1 F)', () => {
    publish();

    expect(fake.subscribe).toHaveBeenCalledWith(
      'orders/reply',
      expect.any(Function),
    );
    expect(fake.publish).toHaveBeenCalledWith(
      'orders',
      JSON.stringify({ pattern: 'orders', data: 'data', id: theClientId }),
      undefined,
      expect.any(Function),
    );
    expect(asAny(client).routingMap.has(theClientId)).toBe(true);
  });

  it('publishes directly when another request already holds the subscription (D8 F)', () => {
    asAny(client).subscriptionsCount.set('orders/reply', 1);

    publish();

    expect(fake.subscribe).not.toHaveBeenCalled();
    expect(fake.publish).toHaveBeenCalledTimes(1);
    expect(asAny(client).subscriptionsCount.get('orders/reply')).toBe(2);
  });

  it('fails the request when the subscribe reply carries an error (D9 T)', () => {
    const error = new Error('not authorized');
    fake.subscribe.mockImplementation((_topic: string, done: Function) =>
      done(error),
    );
    const callback = vi.fn();

    publish(packet(), callback);

    expect(callback).toHaveBeenCalledWith({ err: error });
    expect(fake.publish).not.toHaveBeenCalled();
    expect(asAny(client).routingMap.size).toBe(0);
    expect(asAny(client).subscriptionsCount.size).toBe(0);
  });

  it('fails the request when publish reports an error before it is torn down (D5 T)', () => {
    const error = new Error('quota exceeded');
    fake.publish.mockImplementation(
      (_topic: string, _payload: any, _options: any, done: Function) =>
        done(error),
    );
    const callback = vi.fn();

    publish(packet(), callback);

    expect(callback).toHaveBeenCalledWith({ err: error });
    expect(asAny(client).routingMap.size).toBe(0);
    expect(asAny(client).subscriptionsCount.size).toBe(0);
  });

  it('ignores a publish error reported after the teardown already ran (D5 second atom F)', () => {
    asAny(client).subscriptionsCount.set('orders/reply', 1);
    let finish: Function = () => {};
    fake.publish.mockImplementation(
      (_topic: string, _payload: any, _options: any, done: Function) =>
        (finish = done),
    );
    const callback = vi.fn();

    const teardown = publish(packet(), callback);
    teardown();
    finish(new Error('late failure'));

    expect(callback).not.toHaveBeenCalled();
  });

  it('undoes its own bookkeeping when publish throws, without unsubscribing (D6 T, D1 T)', () => {
    asAny(client).subscriptionsCount.set('orders/reply', 1);
    fake.publish.mockImplementation(() => {
      throw new Error('Send error');
    });
    const callback = vi.fn();

    publish(packet(), callback);

    expect(callback).toHaveBeenCalledWith({
      err: expect.objectContaining({ message: 'Send error' }),
    });
    expect(asAny(client).routingMap.size).toBe(0);
    // Only this request's own count is released; the other request keeps it.
    expect(asAny(client).subscriptionsCount.get('orders/reply')).toBe(1);
    // The subscription is left to self-heal, as another request may use it.
    expect(fake.unsubscribe).not.toHaveBeenCalled();
  });

  it('does the same when the throw happens after a late acknowledgement (D6 T)', () => {
    let acknowledge: Function = () => {};
    fake.subscribe.mockImplementation((_topic: string, done: Function) => {
      acknowledge = done;
    });
    fake.publish.mockImplementation(() => {
      throw new Error('Send error');
    });
    const callback = vi.fn();

    publish(packet(), callback);
    acknowledge();

    expect(callback).toHaveBeenCalledWith({
      err: expect.objectContaining({ message: 'Send error' }),
    });
    expect(asAny(client).routingMap.size).toBe(0);
    expect(asAny(client).subscriptionsCount.size).toBe(0);
  });

  it('fails the request and returns a no-op when the id cannot be assigned (outer catch, D1 F)', () => {
    vi.mocked(asAny(client).assignPacketId).mockImplementation(() => {
      throw new Error('no id');
    });
    const callback = vi.fn();

    const teardown = publish(packet(), callback);

    expect(callback).toHaveBeenCalledWith({
      err: expect.objectContaining({ message: 'no id' }),
    });
    expect(typeof teardown).toBe('function');
    expect(fake.subscribe).not.toHaveBeenCalled();
  });

  it.each([
    ['request topic too long', `${'a'.repeat(MQTT_MAX_TOPIC_LENGTH)}a`],
    [
      'reply topic too long',
      'a'.repeat(MQTT_MAX_TOPIC_LENGTH - '/reply'.length + 1),
    ],
  ])('rejects a %s without subscribing or publishing', (_label, pattern) => {
    const callback = vi.fn();

    publish({ pattern, data: 'data' }, callback);

    expect(callback).toHaveBeenCalledWith({
      err: expect.any(MaxMqttTopicLengthExceededException),
    });
    expect(fake.subscribe).not.toHaveBeenCalled();
    expect(fake.publish).not.toHaveBeenCalled();
    expect(asAny(client).subscriptionsCount.size).toBe(0);
  });

  it('sends a topic that exactly fits', () => {
    const longest = 'a'.repeat(MQTT_MAX_TOPIC_LENGTH - '/reply'.length);
    const callback = vi.fn();

    publish({ pattern: longest, data: 'data' }, callback);

    expect(callback).not.toHaveBeenCalled();
    expect(fake.publish.mock.calls[0][0]).toBe(longest);
  });

  it('does not publish when the request is disposed before the acknowledgement (D2 F)', () => {
    let acknowledge: Function = () => {};
    fake.subscribe.mockImplementation((_topic: string, done: Function) => {
      acknowledge = done;
    });
    const callback = vi.fn();

    const teardown = publish(packet(), callback);
    teardown();
    acknowledge();

    expect(fake.publish).not.toHaveBeenCalled();
    expect(callback).not.toHaveBeenCalled();
    expect(fake.unsubscribe).toHaveBeenCalledWith('orders/reply');
    expect(asAny(client).routingMap.size).toBe(0);
  });

  it('tears down once: unsubscribes and drops the routing entry (D7 T then F)', () => {
    const teardown = publish(packet());

    teardown();
    // A second teardown must not decrement the count again or unsubscribe twice.
    teardown();

    expect(fake.unsubscribe).toHaveBeenCalledTimes(1);
    expect(asAny(client).routingMap.size).toBe(0);
    expect(asAny(client).subscriptionsCount.size).toBe(0);
  });

  it('keeps the subscription of a request that started earlier (D7 F in cleanup)', () => {
    asAny(client).subscriptionsCount.set('orders/reply', 1);
    const teardown = publish(packet());

    teardown();

    expect(fake.unsubscribe).not.toHaveBeenCalled();
    expect(asAny(client).subscriptionsCount.get('orders/reply')).toBe(1);
  });

  it.each([
    ['a MqttRecord', new MqttRecord('data', { qos: 2 }), { qos: 2 }],
    [
      'a plain object with an options key',
      { data: 'x', options: { qos: 1 } },
      undefined,
    ],
    ['a primitive payload', 'data', undefined],
  ])(
    'derives the publish options from %s (D3/D4)',
    (_label, data, expectedOptions) => {
      publish({ pattern: 'orders', data });

      expect(fake.publish.mock.calls[0][2]).toEqual(expectedOptions);
    },
  );

  it('sends the packet metadata as MQTT 5 user properties (D3 F, D4 T)', () => {
    const clientWithV5 = createClient({ protocolVersion: 5 });
    const v5Fake = createFakeClient();
    asAny(clientWithV5).mqttClient = v5Fake;
    vi.spyOn(asAny(clientWithV5), 'assignPacketId').mockImplementation(
      (message: any) => Object.assign(message, { id: 'id' }),
    );

    asAny(clientWithV5).publish(
      {
        pattern: 'orders',
        data: 'data',
        metadata: { 'x-request-id': 'trace-1' },
      },
      vi.fn(),
    );

    const [, payload, options] = v5Fake.publish.mock.calls[0];
    expect(options).toEqual({
      properties: { userProperties: { 'x-request-id': 'trace-1' } },
    });
    expect(JSON.parse(payload)).toEqual({
      pattern: 'orders',
      data: 'data',
      id: 'id',
    });
  });
});

/**
 * `dispatchEvent` decisions:
 * D1 topic within the limit? (assertTopicLength throws otherwise)
 * D2 `data` is an object? D3 `data instanceof MqttRecord`?
 * D4 the publish callback reports an error? -> reject / resolve.
 */
describe('ClientMqtt.dispatchEvent', () => {
  let client: ClientMqtt;
  let fake: any;

  const dispatch = (packet: Record<string, any>) =>
    asAny(client).dispatchEvent(packet);

  beforeEach(() => {
    client = createClient();
    fake = createFakeClient();
    asAny(client).mqttClient = fake;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('resolves when the broker accepts the event (D4 F)', async () => {
    await expect(
      dispatch({ pattern: 'orders', data: 'data' }),
    ).resolves.toBeUndefined();
    expect(fake.publish).toHaveBeenCalledWith(
      'orders',
      JSON.stringify({ pattern: 'orders', data: 'data' }),
      undefined,
      expect.any(Function),
    );
  });

  it('rejects when the publish reports an error (D4 T)', async () => {
    const error = new Error('quota exceeded');
    fake.publish.mockImplementation(
      (_topic: string, _payload: any, _options: any, done: Function) =>
        done(error),
    );

    await expect(dispatch({ pattern: 'orders', data: 'data' })).rejects.toBe(
      error,
    );
  });

  it('throws for a topic over the limit (D1 T)', () => {
    expect(() =>
      dispatch({
        pattern: 'a'.repeat(MQTT_MAX_TOPIC_LENGTH + 1),
        data: 'data',
      }),
    ).toThrow(MaxMqttTopicLengthExceededException);
    expect(fake.publish).not.toHaveBeenCalled();
  });

  it.each([
    [
      'a MqttRecord',
      new MqttRecord('data', { qos: 1, retain: true }),
      { qos: 1, retain: true },
    ],
    ['a plain object', { value: 1 }, undefined],
    ['a primitive', 'data', undefined],
  ])(
    'derives the options from %s (D2/D3)',
    async (_label, data, expectedOptions) => {
      await dispatch({ pattern: 'orders', data });

      expect(fake.publish.mock.calls[0][2]).toEqual(expectedOptions);
    },
  );

  it('does not send metadata over MQTT 3 (D3 F)', async () => {
    await dispatch({
      pattern: 'orders',
      data: 'data',
      metadata: { 'x-request-id': 'trace-1' },
    });

    expect(fake.publish.mock.calls[0][2]).toBeUndefined();
    expect(fake.publish.mock.calls[0][1]).not.toContain('x-request-id');
  });
});

/**
 * `unsubscribeFromChannel` decisions:
 * D1 `subscriptionCount - 1 <= 0`? -> the client is unsubscribed.
 */
describe('ClientMqtt.unsubscribeFromChannel', () => {
  it('keeps the subscription while another request uses it (D1 F)', () => {
    const client = createClient();
    const fake = createFakeClient();
    asAny(client).mqttClient = fake;
    asAny(client).subscriptionsCount.set('orders/reply', 2);

    asAny(client).unsubscribeFromChannel('orders/reply');

    expect(fake.unsubscribe).not.toHaveBeenCalled();
    expect(asAny(client).subscriptionsCount.get('orders/reply')).toBe(1);
  });

  it('unsubscribes with the last request (D1 T)', () => {
    const client = createClient();
    const fake = createFakeClient();
    asAny(client).mqttClient = fake;
    asAny(client).subscriptionsCount.set('orders/reply', 1);

    asAny(client).unsubscribeFromChannel('orders/reply');

    expect(fake.unsubscribe).toHaveBeenCalledWith('orders/reply');
    expect(asAny(client).subscriptionsCount.has('orders/reply')).toBe(false);
  });
});

/**
 * `setSubscriptionsCount` decisions:
 * D1 `count > 0`? -> stored / entry removed.
 */
describe('ClientMqtt.setSubscriptionsCount', () => {
  it('stores a positive count (D1 T)', () => {
    const client = createClient();

    asAny(client).setSubscriptionsCount('a/reply', 3);

    expect(asAny(client).subscriptionsCount.get('a/reply')).toBe(3);
  });

  it.each([0, -1])('removes the entry for %i (D1 F)', count => {
    const client = createClient();
    asAny(client).subscriptionsCount.set('a/reply', 1);

    asAny(client).setSubscriptionsCount('a/reply', count);

    expect(asAny(client).subscriptionsCount.has('a/reply')).toBe(false);
  });
});

/**
 * `assertTopicLength` decisions:
 * D1 `byteLength > MQTT_MAX_TOPIC_LENGTH`? -> exception.
 */
describe('ClientMqtt.assertTopicLength', () => {
  it('accepts the maximum length (D1 F)', () => {
    const client = createClient();

    expect(() =>
      asAny(client).assertTopicLength('a'.repeat(MQTT_MAX_TOPIC_LENGTH)),
    ).not.toThrow();
  });

  it('counts bytes, not characters (D1 T)', () => {
    const client = createClient();

    expect(() =>
      asAny(client).assertTopicLength(
        'é'.repeat(Math.ceil(MQTT_MAX_TOPIC_LENGTH / 2) + 1),
      ),
    ).toThrow(MaxMqttTopicLengthExceededException);
  });
});

/**
 * `initializeSerializer` decisions:
 * D1 `options?.serializer` provided? -> kept, else the default serializer.
 */
describe('ClientMqtt.initializeSerializer', () => {
  it('keeps a provided serializer (D1 T)', () => {
    const client = createClient();
    const serializer = { serialize: vi.fn() };

    asAny(client).initializeSerializer({ serializer });

    expect(asAny(client).serializer).toBe(serializer);
  });

  it.each([{}, undefined])(
    'falls back to MqttRecordSerializer for %s (D1 F)',
    options => {
      const client = createClient();

      asAny(client).initializeSerializer(options);

      expect(asAny(client).serializer).toBeInstanceOf(MqttRecordSerializer);
    },
  );
});

/**
 * `mergePacketOptions` decisions:
 * D1 `protocolVersion === 5`? D2 `hasPacketMetadata(metadata)`?
 * D3 `!requestOptions`? D4 `!this.options?.userProperties`?
 * D5 `!metadataProperties`? (D3+D4+D5 -> undefined)
 * D6 `requestOptions` truthy? D7 `userProperties || metadataProperties`?
 */
describe('ClientMqtt.mergePacketOptions', () => {
  it('returns undefined when nothing is available (D3 T, D4 T, D5 T)', () => {
    const client = createClient();

    expect(
      asAny(client).mergePacketOptions(undefined, undefined),
    ).toBeUndefined();
  });

  it('returns undefined when the only metadata cannot travel over MQTT 3 (D1 F)', () => {
    const client = createClient();

    expect(
      asAny(client).mergePacketOptions(undefined, { trace: '1' }),
    ).toBeUndefined();
  });

  it('returns undefined when the metadata object is empty (D2 F)', () => {
    const client = createClient({ protocolVersion: 5 });

    expect(asAny(client).mergePacketOptions(undefined, {})).toBeUndefined();
  });

  it('copies the record options when there is nothing to merge (D6 T, D7 F)', () => {
    const client = createClient();
    const requestOptions = { qos: 1 as const };

    const merged = asAny(client).mergePacketOptions(requestOptions, undefined);

    expect(merged).toEqual({ qos: 1 });
    expect(merged).not.toBe(requestOptions);
  });

  it('merges the metadata into the user properties on MQTT 5 (D1 T, D2 T, D7 T)', () => {
    const client = createClient({ protocolVersion: 5 });

    expect(asAny(client).mergePacketOptions(undefined, { trace: '1' })).toEqual(
      { properties: { userProperties: { trace: '1' } } },
    );
  });

  it('uses the client user properties without metadata (D4 F, D7 T)', () => {
    const client = createClient({ userProperties: { tenant: 'acme' } });

    expect(asAny(client).mergePacketOptions(undefined, undefined)).toEqual({
      properties: { userProperties: { tenant: 'acme' } },
    });
  });

  it('lets the record, then the options, then the metadata win (D6 T)', () => {
    const client = createClient({
      protocolVersion: 5,
      userProperties: { trace: 'from-options', tenant: 'acme' },
    });

    const merged = asAny(client).mergePacketOptions(
      { qos: 2, properties: { userProperties: { trace: 'from-record' } } },
      { trace: 'from-metadata', locale: 'pl' },
    );

    expect(merged).toEqual({
      qos: 2,
      properties: {
        userProperties: {
          trace: 'from-record',
          tenant: 'acme',
          locale: 'pl',
        },
      },
    });
  });
});
