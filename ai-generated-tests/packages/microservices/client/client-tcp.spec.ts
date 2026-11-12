import { EventEmitter } from 'events';
import * as net from 'net';
import { connect as tlsConnect } from 'tls';
import { describe, expect, it, vi } from 'vitest';
import { ClientTCP } from '../../../../packages/microservices/client/client-tcp.js';
import { ECONNREFUSED } from '../../../../packages/microservices/constants.js';
import { TcpStatus } from '../../../../packages/microservices/events/tcp.events.js';
import {
  JsonSocket,
  TcpSocket,
} from '../../../../packages/microservices/helpers/index.js';
import { IdentitySerializer } from '../../../../packages/microservices/serializers/identity.serializer.js';
import { IncomingResponseDeserializer } from '../../../../packages/microservices/deserializers/incoming-response.deserializer.js';

vi.mock('tls', async importOriginal => {
  const actual = await importOriginal<typeof import('tls')>();
  return { ...actual, connect: vi.fn() };
});

class FakeTcpSocket {
  public readonly netSocket = Object.assign(new EventEmitter(), {
    destroy: vi.fn(),
  });
  public readonly connect = vi.fn();
  public readonly end = vi.fn();
  public readonly sendMessage = vi.fn();

  public on(event: string, callback: (...args: any[]) => void) {
    this.netSocket.on(event, callback);
    return this;
  }
}

class CustomSocket extends TcpSocket {
  public constructorArgs: unknown[] = [];

  public constructor(socket: any, ...args: unknown[]) {
    super(socket);
    this.constructorArgs = args;
  }

  protected handleSend(): void {}
  protected handleData(): void {}
}

const asClient = (client: ClientTCP) => client as any;

const createClientWithFakeSocket = (
  options: ConstructorParameters<typeof ClientTCP>[0] = {},
) => {
  const client = new ClientTCP(options);
  vi.spyOn(asClient(client).logger, 'error').mockImplementation(() => {});
  const socket = new FakeTcpSocket();
  const createSocket = vi
    .spyOn(client, 'createSocket')
    .mockReturnValue(socket as any);
  return { client, socket, createSocket };
};

const connectWith = async (
  client: ClientTCP,
  socket: FakeTcpSocket,
  event = 'connect',
) => {
  const attempt = client.connect();
  socket.netSocket.emit(event);
  await attempt;
};

/**
 * Constructor decisions are the `getOptionsProp` lookups:
 *   D1 port present? default 3000
 *   D2 host present? default localhost
 *   D3 socketClass present? default JsonSocket
 *   D4 tlsOptions present? D5 maxBufferSize? D6 incompleteMessageTimeout?
 *   D7 messageReceiveTimeout? D8 maxSendBufferSize?
 *   D9 serializer present? D10 deserializer present?
 * The "present" and "missing" outcome of every lookup is exercised (all in the
 * defaults case, all in the fully custom case).
 */
describe('ClientTCP.constructor', () => {
  it('applies the defaults when options are empty (all lookups missing)', () => {
    const client = new ClientTCP({});

    expect(asClient(client).port).toBe(3000);
    expect(asClient(client).host).toBe('localhost');
    expect(asClient(client).socketClass).toBe(JsonSocket);
    expect(asClient(client).tlsOptions).toBeUndefined();
    expect(asClient(client).maxBufferSize).toBeUndefined();
    expect(asClient(client).incompleteMessageTimeout).toBeUndefined();
    expect(asClient(client).messageReceiveTimeout).toBeUndefined();
    expect(asClient(client).maxSendBufferSize).toBeUndefined();
    expect(asClient(client).serializer).toBeInstanceOf(IdentitySerializer);
    expect(asClient(client).deserializer).toBeInstanceOf(
      IncomingResponseDeserializer,
    );
  });

  it('keeps every custom option (all lookups present)', () => {
    const serializer = { serialize: vi.fn() };
    const deserializer = { deserialize: vi.fn() };
    const tlsOptions = { rejectUnauthorized: false };
    const client = new ClientTCP({
      port: 1234,
      host: 'custom.host',
      socketClass: CustomSocket as any,
      tlsOptions,
      maxBufferSize: 1,
      incompleteMessageTimeout: 2,
      messageReceiveTimeout: 3,
      maxSendBufferSize: 4,
      serializer,
      deserializer,
    } as any);

    expect(asClient(client).port).toBe(1234);
    expect(asClient(client).host).toBe('custom.host');
    expect(asClient(client).socketClass).toBe(CustomSocket);
    expect(asClient(client).tlsOptions).toBe(tlsOptions);
    expect(asClient(client).maxBufferSize).toBe(1);
    expect(asClient(client).incompleteMessageTimeout).toBe(2);
    expect(asClient(client).messageReceiveTimeout).toBe(3);
    expect(asClient(client).maxSendBufferSize).toBe(4);
    expect(asClient(client).serializer).toBe(serializer);
    expect(asClient(client).deserializer).toBe(deserializer);
  });
});

/**
 * `connect` decisions:
 *   D1 `connectionPromise` cached? -> returned without a new socket.
 *   D2 `tlsOptions`? -> waits for `secureConnect` and also rejects on `close`;
 *      otherwise waits for `connect` and calls socket.connect(port, host).
 *   D3 pendingEventListeners non-empty? (forEach over 0 and >0 entries).
 *   D4 lastValueFrom rejection instanceof EmptyError? The EmptyError branch is
 *      infeasible: both merged event streams are `fromEvent` on an
 *      EventEmitter, which never completes, so lastValueFrom cannot settle
 *      without a value. The non-EmptyError rethrow branch is covered instead.
 * The tap (connectedSockets + message listener) runs on both connect paths.
 */
describe('ClientTCP.connect', () => {
  it('creates a socket, registers listeners and resolves on connect (D1 false, D2 non-TLS)', async () => {
    const { client, socket } = createClientWithFakeSocket();
    client.on('timeout', vi.fn());

    const listenerSpy = vi.spyOn(socket.netSocket, 'on');
    await connectWith(client, socket);

    expect(socket.connect).toHaveBeenCalledWith(3000, 'localhost');
    expect(listenerSpy).toHaveBeenCalledWith('connect', expect.any(Function));
    expect(listenerSpy).toHaveBeenCalledWith('close', expect.any(Function));
    expect(listenerSpy).toHaveBeenCalledWith('error', expect.any(Function));
    expect(listenerSpy).toHaveBeenCalledWith('timeout', expect.any(Function));
    expect(listenerSpy).toHaveBeenCalledWith('message', expect.any(Function));
    expect(asClient(client).connectionPromise).toBeInstanceOf(Promise);
  });

  it('returns the cached connection promise and does not create a second socket (D1 true)', async () => {
    const { client, socket, createSocket } = createClientWithFakeSocket();
    await connectWith(client, socket);
    const cached = asClient(client).connectionPromise;

    await expect(client.connect()).resolves.toBeUndefined();

    expect(asClient(client).connectionPromise).toBe(cached);
    expect(createSocket).toHaveBeenCalledTimes(1);
  });

  it('waits for secureConnect and does not call socket.connect for TLS (D2 TLS)', async () => {
    const { client, socket } = createClientWithFakeSocket({ tlsOptions: {} });
    const attempt = client.connect();

    socket.netSocket.emit('connect');
    await new Promise(resolve => setImmediate(resolve));
    expect(asClient(client).connectionPromise).toBeInstanceOf(Promise);

    socket.netSocket.emit('secureConnect');
    await expect(attempt).resolves.toBeUndefined();
    expect(socket.connect).not.toHaveBeenCalled();
    expect(socket.netSocket.listenerCount('message')).toBe(1);
  });

  it('rejects a TLS connection closed before the handshake completes (D2 TLS close)', async () => {
    const { client, socket } = createClientWithFakeSocket({ tlsOptions: {} });
    const attempt = client.connect();

    socket.netSocket.emit('close');

    await expect(attempt).rejects.toThrow('Connection closed');
  });

  it('rejects when the socket emits an error (D4 non-EmptyError rethrow)', async () => {
    const { client, socket } = createClientWithFakeSocket();
    const error = Object.assign(new Error('refused'), { code: ECONNREFUSED });
    const attempt = client.connect();

    socket.netSocket.emit('error', error);

    await expect(attempt).rejects.toBe(error);
  });
});

/**
 * `handleResponse` decisions:
 *   D1 deserializer resolves? catch (throw/reject) -> logger.error, return;
 *   D2 routing callback found? missing -> undefined;
 *   D3 `isDisposed || err`? true -> callback isDisposed true, false -> normal.
 * All outcomes are feasible and covered.
 */
describe('ClientTCP.handleResponse', () => {
  const response = { id: '1', response: 'res', err: undefined };

  it('logs and resolves when the deserializer throws (D1 catch)', async () => {
    const client = new ClientTCP({});
    const error = new TypeError('bad packet');
    const logError = vi
      .spyOn(asClient(client).logger, 'error')
      .mockImplementation(() => {});
    asClient(client).deserializer = {
      deserialize: () => {
        throw error;
      },
    };

    await expect(client.handleResponse('raw')).resolves.toBeUndefined();
    expect(logError).toHaveBeenCalledWith(
      `Dropped a response that the deserializer failed on: ${error}`,
      error.stack,
    );
  });

  it('returns undefined when no routing callback matches (D2 false)', async () => {
    const client = new ClientTCP({});
    asClient(client).deserializer = {
      deserialize: async () => response,
    };

    await expect(client.handleResponse('raw')).resolves.toBeUndefined();
  });

  it('marks a disposed reply as disposed (D3 disposed)', async () => {
    const client = new ClientTCP({});
    const callback = vi.fn();
    asClient(client).deserializer = {
      deserialize: async () => ({ ...response, isDisposed: true }),
    };
    asClient(client).routingMap.set('1', callback);

    await client.handleResponse('raw');

    expect(callback).toHaveBeenCalledWith({
      err: undefined,
      response: 'res',
      isDisposed: true,
    });
  });

  it('marks an error reply as disposed (D3 err)', async () => {
    const client = new ClientTCP({});
    const callback = vi.fn();
    const err = new Error('remote error');
    asClient(client).deserializer = {
      deserialize: async () => ({ ...response, err }),
    };
    asClient(client).routingMap.set('1', callback);

    await client.handleResponse('raw');

    expect(callback).toHaveBeenCalledWith({
      err,
      response: 'res',
      isDisposed: true,
    });
  });

  it('passes a normal reply to the callback (D3 false)', async () => {
    const client = new ClientTCP({});
    const callback = vi.fn();
    asClient(client).deserializer = {
      deserialize: async () => response,
    };
    asClient(client).routingMap.set('1', callback);

    await client.handleResponse('raw');

    expect(callback).toHaveBeenCalledWith({ err: undefined, response: 'res' });
  });
});

/**
 * `createSocket` decisions:
 *   D1 `tlsOptions`? -> tls.connect with port/host vs new net.Socket().
 *   D2 `socketClass === JsonSocket`? -> framing options vs no second argument.
 * All four combinations are feasible; TLS is covered with a mocked
 * tls.connect that returns an EventEmitter instead of opening a connection.
 */
describe('ClientTCP.createSocket', () => {
  const fakeTlsSocket = () =>
    Object.assign(new EventEmitter(), { write: vi.fn() });

  it('wraps a plain net.Socket in JsonSocket with framing options (D1 false, D2 true)', () => {
    const client = new ClientTCP({
      maxBufferSize: 10,
      incompleteMessageTimeout: 20,
      messageReceiveTimeout: 30,
      maxSendBufferSize: 40,
    });

    const socket = client.createSocket();

    expect(socket).toBeInstanceOf(JsonSocket);
    expect((socket.netSocket as net.Socket).constructor).toBe(net.Socket);
    expect(asClient(socket).maxBufferSize).toBe(10);
    expect(asClient(socket).incompleteMessageTimeout).toBe(20);
    expect(asClient(socket).messageReceiveTimeout).toBe(30);
    expect(asClient(socket).maxSendBufferSize).toBe(40);
    expect(asClient(socket).pauseOnBackpressure).toBe(false);
    (socket.netSocket as net.Socket).destroy();
  });

  it('does not pass framing options to a custom socketClass (D1 false, D2 false)', () => {
    const client = new ClientTCP({
      socketClass: CustomSocket as any,
      maxBufferSize: 10,
    });

    const socket = client.createSocket();

    expect(socket).toBeInstanceOf(CustomSocket);
    expect((socket as CustomSocket).constructorArgs).toEqual([]);
    expect(asClient(socket).maxBufferSize).toBeUndefined();
    (socket.netSocket as net.Socket).destroy();
  });

  it('calls tls.connect with the merged connection options and wraps it (D1 true, D2 true)', () => {
    const tlsSocket = fakeTlsSocket();
    vi.mocked(tlsConnect).mockReturnValue(tlsSocket as any);
    const tlsOptions = { rejectUnauthorized: false };
    const client = new ClientTCP({ tlsOptions, port: 4242, host: 'tls.test' });

    const socket = client.createSocket();

    expect(tlsConnect).toHaveBeenCalledWith({
      rejectUnauthorized: false,
      port: 4242,
      host: 'tls.test',
    });
    expect(socket).toBeInstanceOf(JsonSocket);
  });

  it('wraps a TLS socket in a custom socketClass without framing options (D1 true, D2 false)', () => {
    const tlsSocket = fakeTlsSocket();
    vi.mocked(tlsConnect).mockReturnValue(tlsSocket as any);
    const client = new ClientTCP({
      tlsOptions: {},
      socketClass: CustomSocket as any,
    });

    const socket = client.createSocket();

    expect(socket).toBeInstanceOf(CustomSocket);
    expect((socket as CustomSocket).constructorArgs).toEqual([]);
  });
});

/**
 * `close` decisions:
 *   D1 `socket` truthy? false -> only cleanup.
 *   D2 `tlsOptions && !connectedSockets.has(socket)`? true -> destroy,
 *      false -> end() (TLS connected and non-TLS both take end()).
 * `handleClose` and clearing pendingEventListeners run on every path.
 */
describe('ClientTCP.close', () => {
  it('ends a non-TLS socket and clears state (D1 true, D2 false)', () => {
    const { client, socket } = createClientWithFakeSocket();
    asClient(client).socket = socket;
    client.on('close', vi.fn());

    client.close();

    expect(socket.end).toHaveBeenCalledTimes(1);
    expect(socket.netSocket.destroy).not.toHaveBeenCalled();
    expect(asClient(client).socket).toBeNull();
    expect(asClient(client).pendingEventListeners).toEqual([]);
  });

  it('destroys a TLS socket that never finished the handshake (D2 true)', () => {
    const { client, socket } = createClientWithFakeSocket({ tlsOptions: {} });
    asClient(client).socket = socket;

    client.close();

    expect(socket.netSocket.destroy).toHaveBeenCalledTimes(1);
    expect(socket.end).not.toHaveBeenCalled();
  });

  it('ends a TLS socket that finished the handshake (D2 false)', async () => {
    const { client, socket } = createClientWithFakeSocket({ tlsOptions: {} });
    await connectWith(client, socket, 'secureConnect');

    client.close();

    expect(socket.end).toHaveBeenCalledTimes(1);
    expect(socket.netSocket.destroy).not.toHaveBeenCalled();
  });

  it('still flushes pending callbacks without a socket (D1 false)', () => {
    const client = new ClientTCP({});
    const callback = vi.fn();
    asClient(client).routingMap.set('id', callback);

    client.close();

    expect(callback).toHaveBeenCalledWith({
      err: expect.objectContaining({ message: 'Connection closed' }),
    });
    expect(asClient(client).socket).toBeNull();
  });
});

/**
 * `handleClose` decisions:
 *   D1 `routingMap.size > 0`? false -> nothing to flush; true -> each callback.
 *   D2 each callback throws? catch -> logger.error and continue.
 * Socket/connectionPromise reset on both paths.
 */
describe('ClientTCP.handleClose', () => {
  it('only resets the connection state when nothing is pending (D1 false)', () => {
    const client = new ClientTCP({});
    asClient(client).socket = new FakeTcpSocket();
    asClient(client).connectionPromise = Promise.resolve();

    client.handleClose();

    expect(asClient(client).socket).toBeNull();
    expect(asClient(client).connectionPromise).toBeNull();
  });

  it('fails every pending request, logging a throwing callback and continuing (D1 true, D2 both)', () => {
    const client = new ClientTCP({});
    const logError = vi
      .spyOn(asClient(client).logger, 'error')
      .mockImplementation(() => {});
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
    expect(logError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'callback failed' }),
    );
    expect(asClient(client).routingMap.size).toBe(0);
  });
});

/**
 * `registerErrorListener` decisions:
 *   D1 `err.code !== ECONNREFUSED`? true -> handleError.
 *   D2 when refused: `!isReplacedSocket(socket)`? false -> ignore,
 *      true -> status DISCONNECTED. `isReplacedSocket` atoms:
 *      D3 socket !== null, D4 socket !== incoming.
 */
describe('ClientTCP.registerErrorListener', () => {
  it.each([
    [
      'a non-refused error calls handleError (D1 true)',
      { code: 'ETIMEDOUT' },
      'handleError',
    ],
    [
      'a refused error on the current socket reports DISCONNECTED (D1 false, D2 true, D3 true, D4 false)',
      { code: ECONNREFUSED },
      'disconnected',
    ],
    [
      'a refused error on a replaced socket is ignored (D2 false, D4 true)',
      { code: ECONNREFUSED },
      'ignored',
    ],
    [
      'a refused error with no current socket reports DISCONNECTED (D3 false)',
      { code: ECONNREFUSED },
      'no-socket',
    ],
  ] as Array<[string, { code: string }, string]>)(
    'handles %s',
    (_name, err, expectation) => {
      const { client, socket } = createClientWithFakeSocket();
      const handleError = vi
        .spyOn(client, 'handleError')
        .mockImplementation(() => {});
      const statuses: TcpStatus[] = [];
      const subscription = client.status.subscribe(status =>
        statuses.push(status),
      );

      if (expectation === 'ignored') {
        asClient(client).socket = new FakeTcpSocket();
      } else if (expectation === 'no-socket') {
        asClient(client).socket = null;
      } else {
        asClient(client).socket = socket;
      }
      client.registerErrorListener(socket as any);
      socket.netSocket.emit('error', err);

      if (expectation === 'handleError') {
        expect(handleError).toHaveBeenCalledWith(err);
        expect(statuses).toEqual([]);
      } else if (expectation === 'ignored') {
        expect(handleError).not.toHaveBeenCalled();
        expect(statuses).toEqual([]);
      } else {
        expect(statuses).toEqual([TcpStatus.DISCONNECTED]);
      }
      subscription.unsubscribe();
    },
  );
});

/**
 * `registerConnectListener` decisions:
 *   D1 `tlsOptions`? -> listen on `secureConnect` instead of `connect`.
 *   D2 `isReplacedSocket(socket)`? true -> ignore, false -> status CONNECTED.
 */
describe('ClientTCP.registerConnectListener', () => {
  it('reports CONNECTED for the current non-TLS socket (D1 false, D2 false)', () => {
    const { client, socket } = createClientWithFakeSocket();
    asClient(client).socket = socket;
    const statuses: TcpStatus[] = [];
    const subscription = client.status.subscribe(status =>
      statuses.push(status),
    );

    client.registerConnectListener(socket as any);
    socket.netSocket.emit('connect');

    expect(statuses).toEqual([TcpStatus.CONNECTED]);
    subscription.unsubscribe();
  });

  it('ignores a late connect of a replaced socket (D2 true)', () => {
    const { client, socket } = createClientWithFakeSocket();
    asClient(client).socket = new FakeTcpSocket();
    const statuses: TcpStatus[] = [];
    const subscription = client.status.subscribe(status =>
      statuses.push(status),
    );

    client.registerConnectListener(socket as any);
    socket.netSocket.emit('connect');

    expect(statuses).toEqual([]);
    subscription.unsubscribe();
  });

  it('listens on secureConnect for TLS (D1 true)', () => {
    const { client, socket } = createClientWithFakeSocket({ tlsOptions: {} });
    asClient(client).socket = socket;
    const statuses: TcpStatus[] = [];
    const subscription = client.status.subscribe(status =>
      statuses.push(status),
    );

    client.registerConnectListener(socket as any);
    socket.netSocket.emit('connect');
    expect(statuses).toEqual([]);
    socket.netSocket.emit('secureConnect');

    expect(statuses).toEqual([TcpStatus.CONNECTED]);
    subscription.unsubscribe();
  });
});

/**
 * `registerCloseListener` decisions:
 *   D1 `isReplacedSocket(socket)`? true -> ignore, false -> status
 *      DISCONNECTED + handleClose.
 */
describe('ClientTCP.registerCloseListener', () => {
  it('reports DISCONNECTED and tears down for the current socket (D1 false)', () => {
    const { client, socket } = createClientWithFakeSocket();
    asClient(client).socket = socket;
    const handleClose = vi.spyOn(client, 'handleClose');
    const statuses: TcpStatus[] = [];
    const subscription = client.status.subscribe(status =>
      statuses.push(status),
    );

    client.registerCloseListener(socket as any);
    socket.netSocket.emit('close');

    expect(statuses).toEqual([TcpStatus.DISCONNECTED]);
    expect(handleClose).toHaveBeenCalledTimes(1);
    subscription.unsubscribe();
  });

  it('ignores the close of a replaced socket (D1 true)', () => {
    const { client, socket } = createClientWithFakeSocket();
    asClient(client).socket = new FakeTcpSocket();
    const handleClose = vi.spyOn(client, 'handleClose');
    const statuses: TcpStatus[] = [];
    const subscription = client.status.subscribe(status =>
      statuses.push(status),
    );

    client.registerCloseListener(socket as any);
    socket.netSocket.emit('close');

    expect(statuses).toEqual([]);
    expect(handleClose).not.toHaveBeenCalled();
    subscription.unsubscribe();
  });
});

/**
 * `on` decisions:
 *   D1 `this.socket` truthy? -> also attach to the current socket; always keep
 *   the listener for sockets created later.
 */
describe('ClientTCP.on', () => {
  it('keeps the listener while no socket exists and does not attach it (D1 false)', () => {
    const client = new ClientTCP({});
    const callback = vi.fn();

    client.on('timeout', callback);

    expect(asClient(client).pendingEventListeners).toEqual([
      { event: 'timeout', callback },
    ]);
  });

  it('keeps and attaches the listener when a socket exists (D1 true)', () => {
    const { client, socket } = createClientWithFakeSocket();
    asClient(client).socket = socket;
    const callback = vi.fn();

    client.on('drain', callback);

    expect(asClient(client).pendingEventListeners).toHaveLength(1);
    expect(socket.netSocket.listenerCount('drain')).toBe(1);
  });
});

/**
 * `unwrap` decisions:
 *   D1 `this.socket` truthy? false -> throw, true -> netSocket.
 */
describe('ClientTCP.unwrap', () => {
  it('throws before connect (D1 false)', () => {
    const client = new ClientTCP({});

    expect(() => client.unwrap()).toThrow(
      'Not initialized. Please call the "connect" method first.',
    );
  });

  it('returns the underlying net socket after connect (D1 true)', () => {
    const { client, socket } = createClientWithFakeSocket();
    asClient(client).socket = socket;

    expect(client.unwrap()).toBe(socket.netSocket);
  });
});

/**
 * `publish` decisions:
 *   D1 assign/serialize/send succeeds? catch -> cleanup + callback({err}).
 *   try/catch has no finer atoms; the throw can come before the routing map is
 *   touched or after it was set (cleanup is a no-op in the former).
 * The cleanup returned on success deletes only this request's id.
 */
describe('ClientTCP.publish', () => {
  const packet = { pattern: 'sum', data: [1, 2] };

  it('serializes, registers and sends the packet, returning a cleanup', () => {
    const { client, socket } = createClientWithFakeSocket();
    asClient(client).socket = socket;
    const callback = vi.fn();

    const cleanup = client['publish'](packet, callback);

    expect(socket.sendMessage).toHaveBeenCalledTimes(1);
    const sent = socket.sendMessage.mock.calls[0][0];
    expect(sent).toMatchObject(packet);
    expect(typeof sent.id).toBe('string');
    expect(asClient(client).routingMap.get(sent.id)).toBe(callback);

    cleanup();
    expect(asClient(client).routingMap.has(sent.id)).toBe(false);
    expect(callback).not.toHaveBeenCalled();
  });

  it('reports a serializer failure and leaves nothing registered (D1 catch)', () => {
    const { client, socket } = createClientWithFakeSocket();
    asClient(client).socket = socket;
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
    expect(socket.sendMessage).not.toHaveBeenCalled();
    expect(() => cleanup()).not.toThrow();
  });

  it('reports a send failure and removes the pending request (D1 catch after registration)', () => {
    const { client, socket } = createClientWithFakeSocket();
    asClient(client).socket = socket;
    const error = new Error('send failed');
    socket.sendMessage.mockImplementation(() => {
      throw error;
    });
    const callback = vi.fn();

    client['publish'](packet, callback);

    expect(callback).toHaveBeenCalledWith({ err: error });
    expect(asClient(client).routingMap.size).toBe(0);
  });

  it('reports a failure before the routing map is touched (no-op cleanup)', () => {
    const { client, socket } = createClientWithFakeSocket();
    asClient(client).socket = socket;
    const error = new Error('id failed');
    vi.spyOn(client as any, 'assignPacketId').mockImplementation(() => {
      throw error;
    });
    const callback = vi.fn();

    client['publish'](packet, callback);

    expect(callback).toHaveBeenCalledWith({ err: error });
    expect(asClient(client).routingMap.size).toBe(0);
  });
});

/**
 * `dispatchEvent` has no decisions: it normalizes, serializes and sends.
 * Serializer failures reject the returned promise.
 */
describe('ClientTCP.dispatchEvent', () => {
  it('normalizes an object pattern, serializes and sends the event', async () => {
    const { client, socket } = createClientWithFakeSocket();
    asClient(client).socket = socket;

    await client['dispatchEvent']({ pattern: { cmd: 'event' }, data: 'x' });

    expect(socket.sendMessage).toHaveBeenCalledWith({
      pattern: '{"cmd":"event"}',
      data: 'x',
    });
  });

  it('passes a string pattern through', async () => {
    const { client, socket } = createClientWithFakeSocket();
    asClient(client).socket = socket;

    await client['dispatchEvent']({ pattern: 'event', data: 'x' });

    expect(socket.sendMessage).toHaveBeenCalledWith({
      pattern: 'event',
      data: 'x',
    });
  });

  it('rejects when serialization throws', async () => {
    const { client, socket } = createClientWithFakeSocket();
    asClient(client).socket = socket;
    const error = new Error('serialize failed');
    asClient(client).serializer = {
      serialize: () => {
        throw error;
      },
    };

    await expect(
      client['dispatchEvent']({ pattern: 'event', data: 'x' }),
    ).rejects.toBe(error);
  });
});
