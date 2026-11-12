import {
  connect as natsConnect,
  headers as createHeaders,
} from '@nats-io/transport-node';
import { describe, expect, it, vi } from 'vitest';
import { ClientNats } from '../../../../packages/microservices/client/client-nats.js';
import { NATS_DEFAULT_URL } from '../../../../packages/microservices/constants.js';
import { NatsResponseJSONDeserializer } from '../../../../packages/microservices/deserializers/nats-response-json.deserializer.js';
import { EmptyResponseException } from '../../../../packages/microservices/errors/empty-response.exception.js';
import { NatsStatus } from '../../../../packages/microservices/events/nats.events.js';
import type {
  ReadPacket,
  WritePacket,
} from '../../../../packages/microservices/interfaces/index.js';
import { NatsRecordSerializer } from '../../../../packages/microservices/serializers/nats-record.serializer.js';

vi.mock('@nats-io/transport-node', async importOriginal => {
  const actual =
    await importOriginal<typeof import('@nats-io/transport-node')>();
  return { ...actual, connect: vi.fn() };
});

const asClient = (client: ClientNats) => client as any;

// Populates the module-level nats package (createInbox/headers) without ever
// opening a connection: package.connect is replaced by a mock.
beforeAll(async () => {
  vi.mocked(natsConnect).mockResolvedValue({} as any);
  await new ClientNats({}).createClient();
});

/**
 * One object plays both roles required by `handleStatusUpdates`: it is the
 * argument that yields statuses and the value stored in `this.natsClient`, so
 * neither the identity guard nor `status()` blows up.
 */
const fakeStatusClient = (
  statuses: any[],
  info?: unknown,
  gate?: Promise<void>,
) => ({
  info,
  status: () => ({
    [Symbol.asyncIterator]: async function* () {
      for (const status of statuses) {
        yield status;
      }
      if (gate) {
        await gate;
      }
    },
  }),
  subscribe: vi.fn(() => ({ unsubscribe: vi.fn() })),
  publish: vi.fn(),
});

const createClientWithFakeNats = (options: Record<string, any> = {}) => {
  const client = new ClientNats(options as any);
  const subscription = { unsubscribe: vi.fn() };
  const natsClient = {
    info: undefined as any,
    subscribe: vi.fn(() => subscription),
    publish: vi.fn(),
  };
  asClient(client).natsClient = natsClient;
  vi.spyOn(asClient(client).logger, 'log').mockImplementation(() => {});
  vi.spyOn(asClient(client).logger, 'error').mockImplementation(() => {});
  vi.spyOn(asClient(client).logger, 'debug').mockImplementation(() => {});
  return { client, natsClient, subscription };
};

const collectStatuses = (client: ClientNats) => {
  const statuses: NatsStatus[] = [];
  const subscription = client.status.subscribe(status => statuses.push(status));
  return { statuses, subscription };
};

/**
 * Constructor decisions: custom serializer (D1 true/false) and custom
 * deserializer (D2 true/false).
 */
describe('ClientNats.constructor', () => {
  it('defaults the NATS serializer and deserializer', () => {
    const client = new ClientNats({});

    expect(asClient(client).serializer).toBeInstanceOf(NatsRecordSerializer);
    expect(asClient(client).deserializer).toBeInstanceOf(
      NatsResponseJSONDeserializer,
    );
  });

  it('keeps custom serializer and deserializer (D1 true, D2 true)', () => {
    const serializer = { serialize: vi.fn() };
    const deserializer = { deserialize: vi.fn() };
    const client = new ClientNats({ serializer, deserializer } as any);

    expect(asClient(client).serializer).toBe(serializer);
    expect(asClient(client).deserializer).toBe(deserializer);
  });

  it('keeps the custom serializer only (D1 true, D2 false)', () => {
    const serializer = { serialize: vi.fn() };
    const client = new ClientNats({ serializer } as any);

    expect(asClient(client).serializer).toBe(serializer);
    expect(asClient(client).deserializer).toBeInstanceOf(
      NatsResponseJSONDeserializer,
    );
  });
});

/**
 * `close` has no decisions beyond the optional natsClient: it always
 * flushes pending requests, resets the fields and removes status listeners,
 * even when `natsClient.close()` rejects.
 */
describe('ClientNats.close', () => {
  it('flushes pending requests, closes the client and removes listeners', async () => {
    const { client, natsClient } = createClientWithFakeNats();
    natsClient.close = vi.fn(async () => undefined);
    const callback = vi.fn();
    const listener = vi.fn();
    client.on('disconnect', listener);
    asClient(client).routingMap.set('id', callback);
    asClient(client).connectionPromise = Promise.resolve();

    await client.close();

    expect(callback).toHaveBeenCalledWith({
      err: expect.objectContaining({ message: 'Connection closed' }),
    });
    expect(natsClient.close).toHaveBeenCalledTimes(1);
    expect(asClient(client).natsClient).toBeNull();
    expect(asClient(client).connectionPromise).toBeNull();
    expect(
      asClient(client).statusEventEmitter.listenerCount('disconnect'),
    ).toBe(0);
  });

  it('works without a connected client', async () => {
    const client = new ClientNats({});

    await expect(client.close()).resolves.toBeUndefined();
    expect(asClient(client).natsClient).toBeNull();
  });

  it('resets the state and removes listeners when closing rejects', async () => {
    const { client, natsClient } = createClientWithFakeNats();
    const error = new Error('close failed');
    natsClient.close = vi.fn().mockRejectedValueOnce(error);
    client.on('reconnect', vi.fn());

    await expect(client.close()).rejects.toBe(error);

    expect(asClient(client).natsClient).toBeNull();
    expect(asClient(client).connectionPromise).toBeNull();
    expect(asClient(client).statusEventEmitter.listenerCount('reconnect')).toBe(
      0,
    );
  });
});

/**
 * `handleClose` decisions:
 *   D1 `routingMap.size > 0`? false -> nothing; true -> flush.
 *   D2 a callback throws? catch -> logger.error, continue.
 */
describe('ClientNats.handleClose', () => {
  it('does nothing when no request is pending (D1 false)', () => {
    const { client } = createClientWithFakeNats();

    expect(() => client.handleClose()).not.toThrow();
  });

  it('fails every pending request and survives a throwing callback (D1 true, D2 both)', () => {
    const { client } = createClientWithFakeNats();
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
 * `connect` decisions:
 *   D1 `connectionPromise` cached? -> return it.
 *   D2 createClient rejects? catch: still current (D3) -> clear promise.
 *   D4 after a successful create, was the promise replaced meanwhile?
 *      true -> close the stale connection, then return the current promise
 *      (D5 true) or throw 'Connection closed' (D5 false).
 *   D6 D4 false -> adopt the client, emit CONNECTED, start status updates.
 */
describe('ClientNats.connect', () => {
  it('returns the cached promise (D1 true)', async () => {
    const client = new ClientNats({});
    const cached = Promise.resolve('cached');
    asClient(client).connectionPromise = cached;
    const createClient = vi.spyOn(client, 'createClient');

    await expect(client.connect()).resolves.toBe('cached');
    expect(createClient).not.toHaveBeenCalled();
  });

  it('connects, reports CONNECTED and starts status updates (D1 false, D6)', async () => {
    const client = new ClientNats({});
    const natsClient = fakeStatusClient([]);
    vi.spyOn(client, 'createClient').mockResolvedValue(natsClient as any);
    const handleStatusUpdates = vi
      .spyOn(client, 'handleStatusUpdates')
      .mockResolvedValue(undefined);
    const { statuses, subscription } = collectStatuses(client);

    await expect(client.connect()).resolves.toBe(natsClient);

    expect(asClient(client).natsClient).toBe(natsClient);
    expect(statuses).toEqual([NatsStatus.CONNECTED]);
    expect(handleStatusUpdates).toHaveBeenCalledWith(natsClient);
    subscription.unsubscribe();
  });

  it('clears the cached promise when the current attempt fails (D2 reject, D3 true)', async () => {
    const client = new ClientNats({});
    const error = new Error('connect failed');
    vi.spyOn(client, 'createClient').mockRejectedValue(error);

    await expect(client.connect()).rejects.toBe(error);
    expect(asClient(client).connectionPromise).toBeNull();
  });

  it('keeps a newer promise when a stale attempt fails (D3 false)', async () => {
    const client = new ClientNats({});
    let rejectAttempt!: (err: Error) => void;
    vi.spyOn(client, 'createClient').mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          rejectAttempt = reject;
        }),
    );
    const attempt = client.connect();
    const newer = Promise.resolve('newer');
    asClient(client).connectionPromise = newer;
    const error = new Error('stale');
    rejectAttempt(error);

    await expect(attempt).rejects.toBe(error);
    expect(asClient(client).connectionPromise).toBe(newer);
  });

  it('closes a stale successful connection and returns the current promise (D4 true, D5 true)', async () => {
    const client = new ClientNats({});
    let resolveAttempt!: (value: any) => void;
    vi.spyOn(client, 'createClient').mockImplementation(
      () =>
        new Promise(resolve => {
          resolveAttempt = resolve;
        }),
    );
    const attempt = client.connect();
    const current = Promise.resolve('current');
    asClient(client).connectionPromise = current;
    const stale = { close: vi.fn(async () => undefined) };
    resolveAttempt(stale);

    await expect(attempt).resolves.toBe('current');
    expect(stale.close).toHaveBeenCalledTimes(1);
    expect(asClient(client).natsClient).toBeNull();
  });

  it('throws "Connection closed" when a stale connection succeeds after close (D4 true, D5 false)', async () => {
    const client = new ClientNats({});
    let resolveAttempt!: (value: any) => void;
    vi.spyOn(client, 'createClient').mockImplementation(
      () =>
        new Promise(resolve => {
          resolveAttempt = resolve;
        }),
    );
    const attempt = client.connect();
    asClient(client).connectionPromise = null;
    const stale = { close: vi.fn(async () => undefined) };
    resolveAttempt(stale);

    await expect(attempt).rejects.toThrow('Connection closed');
    expect(stale.close).toHaveBeenCalledTimes(1);
  });
});

/**
 * `createClient` decisions:
 *   D1 serializer has an init hook? D2 deserializer has an init hook?
 *   D3 `this.options` truthy? false -> `{}` fallback.
 * package.connect is mocked; no network is opened.
 */
describe('ClientNats.createClient', () => {
  it('calls the package connect with the default URL and the options (D3 true)', async () => {
    vi.mocked(natsConnect).mockClear();
    const client = new ClientNats({ name: 'app', servers: 'nats://custom' });

    await client.createClient();

    expect(natsConnect).toHaveBeenCalledWith({
      servers: 'nats://custom',
      name: 'app',
    });
  });

  it('uses the default URL when no servers option is given', async () => {
    vi.mocked(natsConnect).mockClear();
    const client = new ClientNats({});

    await client.createClient();

    expect(natsConnect).toHaveBeenCalledWith({ servers: NATS_DEFAULT_URL });
  });

  it('falls back to an empty options object (D3 false)', async () => {
    vi.mocked(natsConnect).mockClear();
    const client = new ClientNats(undefined as any);

    await client.createClient();

    expect(natsConnect).toHaveBeenCalledWith({ servers: NATS_DEFAULT_URL });
  });

  it('awaits serializer and deserializer init hooks when present (D1 true, D2 true)', async () => {
    const serializer = { serialize: vi.fn(), init: vi.fn(async () => {}) };
    const deserializer = { deserialize: vi.fn(), init: vi.fn(async () => {}) };
    const client = new ClientNats({ serializer, deserializer } as any);
    vi.mocked(natsConnect).mockClear();

    await client.createClient();

    expect(serializer.init).toHaveBeenCalledTimes(1);
    expect(deserializer.init).toHaveBeenCalledTimes(1);
  });

  it('skips clients without an init hook (D1 false, D2 false)', async () => {
    const client = new ClientNats({});
    vi.mocked(natsConnect).mockClear();

    await expect(client.createClient()).resolves.toBeDefined();
  });
});

/**
 * `handleStatusUpdates` decisions:
 *   D1 current client? false -> return before handling.
 *   D2 switch on status.type: error, disconnect, reconnecting, reconnect,
 *      ping (D3 options.debug? true/false), update, default.
 *      default data: D4 object? -> JSON, D5 'data' present? -> raw, else ''.
 *   D6 a listener throws? catch -> logger.error, keep handling.
 *   D7 iterator completed and still current? -> reset + handleClose.
 */
describe('ClientNats.handleStatusUpdates', () => {
  // `handleStatusUpdates` compares the argument with `this.natsClient` on every
  // status, so the fake must be stored in the client and passed as the argument.
  const setup = (
    statuses: any[],
    options: Record<string, any> = {},
    gate?: Promise<void>,
  ) => {
    const { client } = createClientWithFakeNats(options);
    const statusClient = fakeStatusClient(statuses, undefined, gate);
    asClient(client).natsClient = statusClient;
    return { client, statusClient };
  };

  it('returns early when the client was replaced (D1 false)', async () => {
    const { client } = createClientWithFakeNats();
    asClient(client).natsClient = { info: undefined };
    const { statuses, subscription } = collectStatuses(client);

    await client.handleStatusUpdates(
      fakeStatusClient([{ type: 'error', error: 'ignored' }]) as any,
    );

    expect(statuses).toEqual([]);
    expect(asClient(client).logger.error).not.toHaveBeenCalled();
    subscription.unsubscribe();
  });

  it('logs "error" statuses (D2 error)', async () => {
    const { client, statusClient } = setup([
      { type: 'error', error: 'broken' },
    ]);

    await client.handleStatusUpdates(statusClient as any);

    expect(asClient(client).logger.error).toHaveBeenCalledWith(
      'NatsError: type: "error", error: "broken".',
    );
  });

  it('handles "disconnect": rejected promise, DISCONNECTED and event (D2 disconnect)', async () => {
    let release!: () => void;
    const gate = new Promise<void>(resolve => {
      release = resolve;
    });
    const { client, statusClient } = setup(
      [{ type: 'disconnect', server: 'srv' }],
      {},
      gate,
    );
    const listener = vi.fn();
    client.on('disconnect', listener);
    const { statuses, subscription } = collectStatuses(client);

    const handling = client.handleStatusUpdates(statusClient as any);
    await vi.waitFor(() => expect(listener).toHaveBeenCalledWith('srv'));

    await expect(asClient(client).connectionPromise).rejects.toBe(
      'Error: Connection lost. Trying to reconnect...',
    );
    expect(statuses).toContain(NatsStatus.DISCONNECTED);
    release();
    await handling;
    subscription.unsubscribe();
  });

  it('reports RECONNECTING (D2 reconnecting)', async () => {
    const { client, statusClient } = setup([{ type: 'reconnecting' }]);
    const { statuses, subscription } = collectStatuses(client);

    await client.handleStatusUpdates(statusClient as any);

    expect(statuses).toContain(NatsStatus.RECONNECTING);
    subscription.unsubscribe();
  });

  it('handles "reconnect": resolved promise, CONNECTED and event (D2 reconnect)', async () => {
    let release!: () => void;
    const gate = new Promise<void>(resolve => {
      release = resolve;
    });
    const { client, statusClient } = setup(
      [{ type: 'reconnect', server: 'srv' }],
      {},
      gate,
    );
    const listener = vi.fn();
    client.on('reconnect', listener);
    const { statuses, subscription } = collectStatuses(client);

    const handling = client.handleStatusUpdates(statusClient as any);
    await vi.waitFor(() => expect(listener).toHaveBeenCalledWith('srv'));

    await expect(asClient(client).connectionPromise).resolves.toBe(
      statusClient,
    );
    expect(statuses).toContain(NatsStatus.CONNECTED);
    release();
    await handling;
    subscription.unsubscribe();
  });

  it('logs pings only when debug is enabled (D3 true)', async () => {
    const { client, statusClient } = setup(
      [{ type: 'ping', pendingPings: 2 }],
      {
        debug: true,
      },
    );

    await client.handleStatusUpdates(statusClient as any);

    expect(asClient(client).logger.debug).toHaveBeenCalledWith(
      'NatsStatus: type: "ping", pending pings: "2".',
    );
  });

  it('does not log pings when debug is disabled (D3 false)', async () => {
    const { client, statusClient } = setup(
      [{ type: 'ping', pendingPings: 2 }],
      {
        debug: false,
      },
    );

    await client.handleStatusUpdates(statusClient as any);

    expect(asClient(client).logger.debug).not.toHaveBeenCalled();
  });

  it('handles "update" and emits the server change event (D2 update)', async () => {
    const { client, statusClient } = setup([
      { type: 'update', added: ['a'], deleted: ['b'] },
    ]);
    const listener = vi.fn();
    client.on('update', listener);

    await client.handleStatusUpdates(statusClient as any);

    expect(listener).toHaveBeenCalledWith({ added: ['a'], deleted: ['b'] });
  });

  it('logs default statuses with an object payload as JSON (D4 true)', async () => {
    const { client, statusClient } = setup([
      { type: 'close', data: { reason: 'bye' } },
    ]);

    await client.handleStatusUpdates(statusClient as any);

    expect(asClient(client).logger.log).toHaveBeenCalledWith(
      'NatsStatus: type: "close", data: "{"reason":"bye"}".',
    );
  });

  it('logs default statuses with a primitive payload as-is (D4 false, D5 true)', async () => {
    const { client, statusClient } = setup([{ type: 'close', data: 'text' }]);

    await client.handleStatusUpdates(statusClient as any);

    expect(asClient(client).logger.log).toHaveBeenCalledWith(
      'NatsStatus: type: "close", data: "text".',
    );
  });

  it('logs default statuses without data as an empty string (D5 false)', async () => {
    const { client, statusClient } = setup([{ type: 'close' }]);

    await client.handleStatusUpdates(statusClient as any);

    expect(asClient(client).logger.log).toHaveBeenCalledWith(
      'NatsStatus: type: "close", data: "".',
    );
  });

  it('logs a throwing listener and keeps handling the next status (D6)', async () => {
    const { client, statusClient } = setup([
      { type: 'disconnect', server: 's1' },
      { type: 'reconnect', server: 's2' },
    ]);
    const error = new Error('listener failed');
    const reconnect = vi.fn();
    client.on('disconnect', () => {
      throw error;
    });
    client.on('reconnect', reconnect);

    await client.handleStatusUpdates(statusClient as any);

    expect(asClient(client).logger.error).toHaveBeenCalledWith(error);
    expect(reconnect).toHaveBeenCalledWith('s2');
  });

  it('resets the client and fails pending requests when the iterator completes (D7 true)', async () => {
    const { client, statusClient } = setup([]);
    asClient(client).connectionPromise = Promise.resolve(statusClient);
    const callback = vi.fn();
    asClient(client).routingMap.set('id', callback);
    const { statuses, subscription } = collectStatuses(client);

    await client.handleStatusUpdates(statusClient as any);

    expect(asClient(client).natsClient).toBeNull();
    expect(asClient(client).connectionPromise).toBeNull();
    expect(statuses).toEqual([NatsStatus.DISCONNECTED]);
    expect(callback).toHaveBeenCalledWith({
      err: expect.objectContaining({ message: 'Connection closed' }),
    });
    subscription.unsubscribe();
  });

  it('leaves state alone when a dropped client iterator completes (D7 false)', async () => {
    const { client, natsClient } = createClientWithFakeNats();
    asClient(client).natsClient = { info: undefined };
    asClient(client).connectionPromise = Promise.resolve('kept');

    await client.handleStatusUpdates(fakeStatusClient([]) as any);

    expect(asClient(client).natsClient).not.toBeNull();
    await expect(asClient(client).connectionPromise).resolves.toBe('kept');
    expect(natsClient.publish).not.toHaveBeenCalled();
  });
});

/**
 * `publish` decisions:
 *   D1 assign/serialize/subscribe/publish path succeeds? catch -> cleanup +
 *      callback({err}) and a no-op cleanup is returned.
 *   The try/catch has no finer atoms; failures before and after the reply
 *   subscription are both covered (the latter also unsubscribes).
 * Metadata is stripped from the payload and merged into the headers.
 */
describe('ClientNats.publish', () => {
  const packet: ReadPacket = { pattern: 'test', data: 'data' };

  it('subscribes to an inbox, publishes and cleans up', () => {
    const { client, natsClient, subscription } = createClientWithFakeNats();
    const callback = vi.fn();

    const cleanup = client['publish'](packet, callback);

    expect(natsClient.subscribe).toHaveBeenCalledTimes(1);
    const [inbox, options] = natsClient.subscribe.mock.calls[0] as any[];
    expect(inbox).toMatch(/^_INBOX\.[0-9A-Za-z]{22}[0-9a-f]{32}$/);
    expect(options.callback).toBeTypeOf('function');
    expect(natsClient.publish).toHaveBeenCalledTimes(1);
    const [channel, data, publishOptions] = natsClient.publish.mock
      .calls[0] as any[];
    expect(channel).toBe('test');
    expect(JSON.parse(data)).toMatchObject({ pattern: 'test', data: 'data' });
    expect(publishOptions.reply).toBe(inbox);
    expect(publishOptions.headers).toBeUndefined();
    expect(asClient(client).routingMap.size).toBe(1);

    cleanup();
    expect(asClient(client).routingMap.size).toBe(0);
    expect(subscription.unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('sends packet metadata as headers and strips it from the payload', () => {
    const { client, natsClient } = createClientWithFakeNats();

    client['publish']({ ...packet, metadata: { 'x-id': 'trace' } }, vi.fn());

    const [, data, options] = natsClient.publish.mock.calls[0] as any[];
    expect(options.headers.get('x-id')).toBe('trace');
    expect(JSON.parse(data)).not.toHaveProperty('metadata');
  });

  it('reports a serialization error (D1 catch before subscribing)', () => {
    const { client, natsClient } = createClientWithFakeNats();
    const error = new Error('serialize failed');
    asClient(client).serializer = {
      serialize: () => {
        throw error;
      },
    };
    const callback = vi.fn();

    const cleanup = client['publish'](packet, callback);

    expect(callback).toHaveBeenCalledWith({ err: error });
    expect(natsClient.subscribe).not.toHaveBeenCalled();
    expect(asClient(client).routingMap.size).toBe(0);
    expect(() => cleanup()).not.toThrow();
  });

  it('unsubscribes and reports an error when publish throws after subscribing', () => {
    const { client, natsClient, subscription } = createClientWithFakeNats();
    const error = new Error('publish failed');
    natsClient.publish.mockImplementationOnce(() => {
      throw error;
    });
    const callback = vi.fn();

    client['publish'](packet, callback);

    expect(callback).toHaveBeenCalledWith({ err: error });
    expect(subscription.unsubscribe).toHaveBeenCalledTimes(1);
    expect(asClient(client).routingMap.size).toBe(0);
  });

  it('reports an error when subscribe throws', () => {
    const { client, natsClient } = createClientWithFakeNats();
    const error = new Error('subscribe failed');
    natsClient.subscribe.mockImplementationOnce(() => {
      throw error;
    });
    const callback = vi.fn();

    client['publish'](packet, callback);

    expect(callback).toHaveBeenCalledWith({ err: error });
    expect(asClient(client).routingMap.size).toBe(0);
  });

  it('reports an error when header merging throws', () => {
    const { client, natsClient } = createClientWithFakeNats();
    const error = new Error('headers failed');
    vi.spyOn(asClient(client), 'mergeHeaders').mockImplementationOnce(() => {
      throw error;
    });
    const callback = vi.fn();

    client['publish'](packet, callback);

    expect(callback).toHaveBeenCalledWith({ err: error });
    expect(natsClient.publish).not.toHaveBeenCalled();
  });
});

/**
 * `createSubscriptionHandler` decisions:
 *   D1 transport error? -> callback({err}).
 *   D2 `rawPacket?.length === 0`? -> EmptyResponseException + disposed.
 *   D3 deserializer succeeds? false -> callback({err, isDisposed:true}).
 *   D4 message id present and different? -> ignore.
 *   D5 `isDisposed || err`? -> disposed callback, false -> normal callback.
 */
describe('ClientNats.createSubscriptionHandler', () => {
  const packet = { pattern: { cmd: 'test' }, data: 'data', id: '1' };
  const message = { id: '1', response: 'res' };
  const natsMessage = { data: JSON.stringify(message), json: () => message };

  it('passes a transport error to the callback (D1 true)', async () => {
    const { client } = createClientWithFakeNats();
    const callback = vi.fn();
    const error = new Error('transport');

    await client.createSubscriptionHandler(packet, callback)(error, {} as any);

    expect(callback).toHaveBeenCalledWith({ err: error });
  });

  it('fails an empty reply with EmptyResponseException (D2 true)', async () => {
    const { client } = createClientWithFakeNats();
    const callback = vi.fn();

    await client.createSubscriptionHandler(packet, callback)(null, {
      data: '',
      json: () => ({}),
    } as any);

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback.mock.calls[0][0].err).toBeInstanceOf(
      EmptyResponseException,
    );
    expect(callback.mock.calls[0][0].isDisposed).toBe(true);
    expect(callback.mock.calls[0][0].err.message).toContain('{"cmd":"test"}');
  });

  it('fails the request when the deserializer throws (D3 false)', async () => {
    const { client } = createClientWithFakeNats();
    const callback = vi.fn();
    const error = new SyntaxError('bad json');
    asClient(client).deserializer = {
      deserialize: () => {
        throw error;
      },
    };

    await client.createSubscriptionHandler(packet, callback)(
      null,
      natsMessage as any,
    );

    expect(callback).toHaveBeenCalledWith({ err: error, isDisposed: true });
  });

  it('ignores a reply with a different id (D4 true)', async () => {
    const { client } = createClientWithFakeNats();
    const callback = vi.fn();
    const other = { id: '2', response: 'res' };

    await client.createSubscriptionHandler(packet, callback)(null, {
      data: JSON.stringify(other),
      json: () => other,
    } as any);

    expect(callback).not.toHaveBeenCalled();
  });

  it('accepts a reply without an id (D4 false)', async () => {
    const { client } = createClientWithFakeNats();
    const callback = vi.fn();
    const withoutId = { response: 'res' };

    await client.createSubscriptionHandler(packet, callback)(null, {
      data: JSON.stringify(withoutId),
      json: () => withoutId,
    } as any);

    expect(callback).toHaveBeenCalledWith({
      err: undefined,
      response: 'res',
    });
  });

  it('marks a disposed reply as disposed (D5 disposed)', async () => {
    const { client } = createClientWithFakeNats();
    const callback = vi.fn();
    const disposed = { ...message, isDisposed: true };

    await client.createSubscriptionHandler(packet, callback)(null, {
      data: JSON.stringify(disposed),
      json: () => disposed,
    } as any);

    expect(callback).toHaveBeenCalledWith({
      err: undefined,
      response: 'res',
      isDisposed: true,
    });
  });

  it('marks an error reply as disposed (D5 err)', async () => {
    const { client } = createClientWithFakeNats();
    const callback = vi.fn();
    const err = new Error('remote');
    const failed = { ...message, err };

    await client.createSubscriptionHandler(packet, callback)(null, {
      data: JSON.stringify(failed),
      json: () => failed,
    } as any);

    expect(callback).toHaveBeenCalledWith({
      err,
      response: 'res',
      isDisposed: true,
    });
  });

  it('passes a normal reply through (D5 false)', async () => {
    const { client } = createClientWithFakeNats();
    const callback = vi.fn();

    await client.createSubscriptionHandler(packet, callback)(
      null,
      natsMessage as any,
    );

    expect(callback).toHaveBeenCalledWith({
      err: undefined,
      response: 'res',
    });
  });
});

/**
 * `dispatchEvent` decisions: only the publish try/catch (D1):
 * success -> resolve, throw -> reject.
 */
describe('ClientNats.dispatchEvent', () => {
  it('publishes the serialized event and resolves (D1 success)', async () => {
    const { client, natsClient } = createClientWithFakeNats();

    await client['dispatchEvent']({ pattern: { cmd: 'event' }, data: 'x' });

    expect(natsClient.publish).toHaveBeenCalledTimes(1);
    expect(natsClient.publish.mock.calls[0][0]).toBe('{"cmd":"event"}');
    expect(JSON.parse(natsClient.publish.mock.calls[0][1])).toEqual({
      pattern: { cmd: 'event' },
      data: 'x',
    });
  });

  it('rejects when publish throws (D1 throw)', async () => {
    const { client, natsClient } = createClientWithFakeNats();
    const error = new Error('send failed');
    natsClient.publish.mockImplementationOnce(() => {
      throw error;
    });

    await expect(
      client['dispatchEvent']({ pattern: 'event', data: 'x' }),
    ).rejects.toBe(error);
  });

  it('rejects when serialization rejects', async () => {
    const { client } = createClientWithFakeNats();
    const error = new Error('serialize failed');
    asClient(client).serializer = {
      serialize: vi.fn().mockRejectedValue(error),
    };

    await expect(
      client['dispatchEvent']({ pattern: 'event', data: 'x' }),
    ).rejects.toBe(error);
  });

  it('rejects when no client is connected', async () => {
    const client = new ClientNats({});
    asClient(client).natsClient = null;

    await expect(
      client['dispatchEvent']({ pattern: 'event', data: 'x' }),
    ).rejects.toBeInstanceOf(TypeError);
  });
});

/**
 * `initializeSerializer` / `initializeDeserializer` decisions: custom
 * (`options?.serializer` / `options?.deserializer` truthy) versus defaults,
 * including a missing options object.
 */
describe('ClientNats.initializeSerializer / initializeDeserializer', () => {
  it('uses the NATS defaults when the options are missing', () => {
    const client = new ClientNats({});

    client['initializeSerializer'](undefined as any);
    client['initializeDeserializer'](undefined as any);

    expect(asClient(client).serializer).toBeInstanceOf(NatsRecordSerializer);
    expect(asClient(client).deserializer).toBeInstanceOf(
      NatsResponseJSONDeserializer,
    );
  });

  it('uses the custom implementations', () => {
    const client = new ClientNats({});
    const serializer = { serialize: vi.fn() };
    const deserializer = { deserialize: vi.fn() };

    client['initializeSerializer']({ serializer } as any);
    client['initializeDeserializer']({ deserializer } as any);

    expect(asClient(client).serializer).toBe(serializer);
    expect(asClient(client).deserializer).toBe(deserializer);
  });
});

/**
 * `mergeHeaders` decisions:
 *   D1 packet metadata present AND headers supported? -> metadata entries.
 *   D2 no request headers AND no option headers AND no metadata? -> undefined.
 *   D3 request headers are MsgHdrs? -> append values, else if D4 plain object
 *      -> set entries (non-object -> neither).
 *   D5 an option header not already present? -> set.
 *   D6 a metadata entry not already present? -> set.
 * Precedence: record > client options > metadata.
 */
describe('ClientNats.mergeHeaders', () => {
  const metadata = { 'x-meta': 'meta', 'x-shared': 'meta' };

  it('returns undefined when nothing to merge (D2 true)', () => {
    const { client, natsClient } = createClientWithFakeNats();
    asClient(client).natsClient = natsClient;

    expect(client['mergeHeaders'](undefined, undefined)).toBeUndefined();
    expect(client['mergeHeaders'](undefined, {})).toBeUndefined();
  });

  it('copies every value of MsgHdrs request headers (D3 true)', () => {
    const { client } = createClientWithFakeNats();
    const requestHeaders = createHeaders();
    requestHeaders.append('x-tag', 'a');
    requestHeaders.append('x-tag', 'b');

    const headers = client['mergeHeaders'](requestHeaders as any, undefined);

    expect(headers.values('x-tag')).toEqual(['a', 'b']);
  });

  it('copies plain object request headers (D3 false, D4 true)', () => {
    const { client } = createClientWithFakeNats();

    const headers = client['mergeHeaders']({ 'x-plain': 'v' }, undefined);

    expect(headers.get('x-plain')).toBe('v');
  });

  it('does not add request headers when they are not an object (D4 false)', () => {
    const { client } = createClientWithFakeNats();
    asClient(client).options.headers = { 'x-option': 'o' };

    const headers = client['mergeHeaders']('not-headers', undefined);

    expect(headers.get('x-option')).toBe('o');
    expect(headers.keys()).not.toContain('not-headers');
  });

  it('applies option headers and lets request headers win (D5 both)', () => {
    const { client } = createClientWithFakeNats();
    asClient(client).options.headers = {
      'x-option': 'o',
      'x-shared': 'option',
    };
    const requestHeaders = createHeaders();
    requestHeaders.set('x-shared', 'record');

    const headers = client['mergeHeaders'](requestHeaders as any, undefined);

    expect(headers.get('x-option')).toBe('o');
    expect(headers.values('x-shared')).toEqual(['record']);
  });

  it('applies metadata as the lowest precedence (D1 true, D6 both)', () => {
    const { client } = createClientWithFakeNats();
    asClient(client).options.headers = { 'x-shared': 'option' };

    const headers = client['mergeHeaders'](undefined, metadata);

    expect(headers.get('x-meta')).toBe('meta');
    expect(headers.get('x-shared')).toBe('option');
  });

  it('drops metadata when the server has no header support (D1 false)', () => {
    const { client, natsClient } = createClientWithFakeNats();
    natsClient.info = { headers: false };
    asClient(client).natsClient = natsClient;

    expect(client['mergeHeaders'](undefined, metadata)).toBeUndefined();
  });
});

/**
 * `supportsHeaders` decisions:
 *   D1 `natsClient?.info` truthy? false -> supported (D2 skipped).
 *   D2 `info.headers` truthy? -> supported; false -> not.
 */
describe('ClientNats.supportsHeaders', () => {
  it.each([
    ['no client', undefined, true],
    ['no info', {}, true],
    ['headers enabled', { info: { headers: true } }, true],
    ['headers disabled', { info: { headers: false } }, false],
  ])('returns %s', (_name, natsClient, expected) => {
    const client = new ClientNats({});
    asClient(client).natsClient = natsClient as any;

    expect(client['supportsHeaders']()).toBe(expected);
  });
});

/**
 * `on` has no decisions: it registers on the internal status emitter.
 */
describe('ClientNats.on', () => {
  it('forwards status events to the registered callback', () => {
    const { client, natsClient } = createClientWithFakeNats();
    asClient(client).natsClient = natsClient;
    const callback = vi.fn();

    client.on('update', callback);
    asClient(client).statusEventEmitter.emit('update', { added: [] });

    expect(callback).toHaveBeenCalledWith({ added: [] });
  });
});

/**
 * `unwrap` decisions:
 *   D1 `natsClient` truthy? false -> throw, true -> client.
 */
describe('ClientNats.unwrap', () => {
  it('throws before connect (D1 false)', () => {
    const client = new ClientNats({});

    expect(() => client.unwrap()).toThrow(
      'Not initialized. Please call the "connect" method first.',
    );
  });

  it('returns the client after connect (D1 true)', () => {
    const { client, natsClient } = createClientWithFakeNats();

    expect(client.unwrap()).toBe(natsClient);
  });
});
