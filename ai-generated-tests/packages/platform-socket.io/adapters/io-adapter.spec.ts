import { EventEmitter } from 'events';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IoAdapter } from '../../../../packages/platform-socket.io/adapters/io-adapter.js';

/**
 * `socket.io` is an indirect dependency: it is replaced by a stub so that the
 * two branches of `createIOServer()` can be exercised without opening a real
 * port or attaching to a real HTTP server.
 */
vi.mock('socket.io', () => {
  class Server {
    static instances: any[] = [];
    public args: any[];
    public ofCalls: string[] = [];

    constructor(...args: any[]) {
      this.args = args;
      Server.instances.push(this);
    }

    public of(namespace: string) {
      this.ofCalls.push(namespace);
      return { kind: 'namespace', namespace, server: this };
    }
  }
  class Namespace {}
  class Socket {}

  return { Server, Namespace, Socket };
});

// eslint-disable-next-line import/order
import { Server } from 'socket.io';

const serverInstances = (): any[] => (Server as any).instances;
const resetServerInstances = () => {
  (Server as any).instances = [];
};

class IoAdapterWithStubbedServer extends IoAdapter {
  public createIOServerCalls: Array<{ port: number; options: any }> = [];
  public ofCalls: string[] = [];

  constructor(
    public readonly fakeServer: any,
    appOrHttpServer?: any,
  ) {
    super(appOrHttpServer);
  }

  public override createIOServer(port: number, options?: any): any {
    this.createIOServerCalls.push({ port, options });
    return this.fakeServer;
  }
}

const makeFakeServer = () => {
  const fakeServer: any = {
    ofCalls: [] as string[],
    of(namespace: string) {
      fakeServer.ofCalls.push(namespace);
      return { kind: 'namespace', namespace };
    },
  };
  return fakeServer;
};

const silentLogger = (adapter: IoAdapter) =>
  vi.spyOn((adapter as any).logger, 'error').mockImplementation(() => undefined);

describe('IoAdapter (C3)', () => {
  beforeEach(() => {
    resetServerInstances();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor (node 1: maxConcurrentMessages ?? default)', () => {
    it.each([
      ['no options', undefined, 1000],
      ['empty options', {}, 1000],
      ['zero is not nullish', { maxConcurrentMessages: 0 }, 0],
      ['explicit value', { maxConcurrentMessages: 5 }, 5],
      ['Infinity', { maxConcurrentMessages: Infinity }, Infinity],
    ])('%s -> %s: 1(T)/1(F)', (_label, options, expected) => {
      const adapter = new IoAdapter(undefined, options as any);
      expect((adapter as any).maxConcurrentMessages).toBe(expected);
    });
  });

  describe('create (node 1 + node 2c1..c3 + node 3)', () => {
    it('returns createIOServer() when options are missing: 1(T)', () => {
      const fakeServer = makeFakeServer();
      const adapter = new IoAdapterWithStubbedServer(fakeServer);

      const result = adapter.create(1234);

      expect(result).toBe(fakeServer);
      expect(adapter.createIOServerCalls).toEqual([
        { port: 1234, options: undefined },
      ]);
    });

    it('creates a server when neither server nor namespace is given: 1(F), 2c1(F) (2c2/2c3 skipped), 3(F)', () => {
      const fakeServer = makeFakeServer();
      const adapter = new IoAdapterWithStubbedServer(fakeServer);

      const result = adapter.create(1234, {} as any);

      expect(result).toBe(fakeServer);
      expect(fakeServer.ofCalls).toEqual([]);
      expect(adapter.createIOServerCalls).toEqual([{ port: 1234, options: {} }]);
    });

    it('creates a server and enters the namespace: 2c1(F), 3(T)', () => {
      const fakeServer = makeFakeServer();
      const adapter = new IoAdapterWithStubbedServer(fakeServer);

      const result = adapter.create(1234, { namespace: 'chat' } as any);

      expect(result).toEqual({ kind: 'namespace', namespace: 'chat' });
      expect(fakeServer.ofCalls).toEqual(['chat']);
      expect(adapter.createIOServerCalls).toEqual([{ port: 1234, options: {} }]);
    });

    it('reuses an existing server and its namespace: 2c1(T), 2c2(T), 2c3(T)', () => {
      const fakeServer = makeFakeServer();
      const adapter = new IoAdapterWithStubbedServer(makeFakeServer());

      const result = adapter.create(1234, {
        server: fakeServer,
        namespace: 'chat',
      } as any);

      expect(result).toEqual({ kind: 'namespace', namespace: 'chat' });
      expect(fakeServer.ofCalls).toEqual(['chat']);
      expect(adapter.createIOServerCalls).toEqual([]);
    });

    it('falls back to createIOServer() when server.of is not a function: 2c1(T), 2c2(T), 2c3(F), 3(T)', () => {
      const fakeServer = makeFakeServer();
      const serverWithoutOf = { of: 'not-a-function' };
      const adapter = new IoAdapterWithStubbedServer(fakeServer);

      const result = adapter.create(1234, {
        server: serverWithoutOf,
        namespace: 'chat',
      } as any);

      expect(result).toEqual({ kind: 'namespace', namespace: 'chat' });
      expect(fakeServer.ofCalls).toEqual(['chat']);
      expect(adapter.createIOServerCalls).toEqual([{ port: 1234, options: {} }]);
    });

    it('creates a plain server when the server is given without a namespace: 2c1(T), 2c2(F) (2c3 skipped), 3(F)', () => {
      const fakeServer = makeFakeServer();
      const adapter = new IoAdapterWithStubbedServer(fakeServer);

      const result = adapter.create(1234, { server: fakeServer } as any);

      expect(result).toBe(fakeServer);
      expect(fakeServer.ofCalls).toEqual([]);
      expect(adapter.createIOServerCalls).toEqual([{ port: 1234, options: {} }]);
    });

    it('treats an empty namespace as absent: 2c2(F), 3(F)', () => {
      const fakeServer = makeFakeServer();
      const adapter = new IoAdapterWithStubbedServer(fakeServer);

      const result = adapter.create(1234, {
        server: makeFakeServer(),
        namespace: '',
      } as any);

      expect(result).toBe(fakeServer);
      expect(adapter.createIOServerCalls).toEqual([{ port: 1234, options: {} }]);
    });
  });

  describe('createIOServer (node 1c1 httpServer, 1c2 port === 0)', () => {
    it('attaches to the HTTP server when it exists and port is 0: 1c1(T), 1c2(T)', () => {
      const httpServer = { marker: 'http' };
      const adapter = new IoAdapter(httpServer);

      adapter.createIOServer(0, { path: '/ws' } as any);

      const [instance] = serverInstances();
      expect(instance.args[0]).toBe(httpServer);
      expect(instance.args[1]).toEqual({ path: '/ws' });
    });

    it('listens on the port when it is not 0: 1c1(T), 1c2(F)', () => {
      const adapter = new IoAdapter({ marker: 'http' });

      adapter.createIOServer(4321);

      const [instance] = serverInstances();
      expect(instance.args[0]).toBe(4321);
      expect(instance.args[1]).toBeUndefined();
    });

    it('listens on the port when there is no HTTP server: 1c1(F) (1c2 skipped)', () => {
      const adapter = new IoAdapter();

      adapter.createIOServer(0);

      const [instance] = serverInstances();
      expect(instance.args[0]).toBe(0);
    });
  });

  describe('bindMessageHandlers (disconnect cache, response.event, ack, filter, catch)', () => {
    const createSocket = () => new EventEmitter() as any;

    it('registers the disconnect listener only once: 1(T), 1(F)', () => {
      const adapter = new IoAdapter();
      const socket = createSocket();
      const handler = {
        message: 'evt',
        callback: vi.fn(() => undefined),
        isAckHandledManually: false,
      };

      adapter.bindMessageHandlers(socket, [handler as any], (data: any) => of(data));
      adapter.bindMessageHandlers(socket, [handler as any], (data: any) => of(data));

      expect(socket.listenerCount('disconnect')).toBe(1);
    });

    it('does nothing for an empty handler list', () => {
      const adapter = new IoAdapter();
      const socket = createSocket();

      adapter.bindMessageHandlers(socket, [], (data: any) => of(data));

      // fromEvent is lazy: without a handler subscription no listener is added.
      expect(socket.listenerCount('disconnect')).toBe(0);
    });

    it('filters nil responses and forwards non-nil ones: 2(T), 2(F)', () => {
      const adapter = new IoAdapter();
      const socket = createSocket();
      const ack = vi.fn();
      let call = 0;

      adapter.bindMessageHandlers(
        socket,
        [
          {
            message: 'evt',
            callback: () => (++call === 1 ? undefined : null),
            isAckHandledManually: false,
          } as any,
          {
            message: 'evt-nil',
            callback: () => null,
            isAckHandledManually: false,
          } as any,
          {
            message: 'evt-ok',
            callback: () => ({ data: 'ok' }),
            isAckHandledManually: false,
          } as any,
        ],
        (data: any) => of(data),
      );

      socket.emit('evt', [undefined, ack]);
      expect(ack).not.toHaveBeenCalled();

      socket.emit('evt-nil', [undefined, ack]);
      expect(ack).not.toHaveBeenCalled();

      socket.emit('evt-ok', [undefined, ack]);
      expect(ack).toHaveBeenCalledWith({ data: 'ok' });
    });

    it('emits an event response: 3c1(T), 3c2 skipped', () => {
      const adapter = new IoAdapter();
      const socket = createSocket();
      const emitSpy = vi.spyOn(socket, 'emit');

      adapter.bindMessageHandlers(
        socket,
        [
          {
            message: 'evt',
            callback: () => ({ event: 'reply', data: 'payload' }),
            isAckHandledManually: false,
          } as any,
        ],
        (data: any) => of(data),
      );

      socket.emit('evt', {});

      expect(emitSpy).toHaveBeenCalledWith('reply', 'payload');
    });

    it('acks when the handler does not ack manually and an ack exists: 3c1(T), 3c2(T)', () => {
      const adapter = new IoAdapter();
      const socket = createSocket();
      const ack = vi.fn();

      adapter.bindMessageHandlers(
        socket,
        [
          {
            message: 'evt',
            callback: () => ({ data: 'ok' }),
            isAckHandledManually: false,
          } as any,
        ],
        (data: any) => of(data),
      );

      socket.emit('evt', [{ a: 1 }, ack]);

      expect(ack).toHaveBeenCalledWith({ data: 'ok' });
    });

    it('does not ack when the handler ack is handled manually: 3c1(F) (3c2 skipped)', () => {
      const adapter = new IoAdapter();
      const socket = createSocket();
      const ack = vi.fn();

      adapter.bindMessageHandlers(
        socket,
        [
          {
            message: 'evt',
            callback: () => ({ data: 'ok' }),
            isAckHandledManually: true,
          } as any,
        ],
        (data: any) => of(data),
      );

      socket.emit('evt', [{ a: 1 }, ack]);

      expect(ack).not.toHaveBeenCalled();
    });

    it('does not ack when the payload has no ack callback: 3c1(T), 3c2(F)', () => {
      const adapter = new IoAdapter();
      const socket = createSocket();
      const handler = {
        message: 'evt',
        callback: () => ({ data: 'ok' }),
        isAckHandledManually: false,
      };

      adapter.bindMessageHandlers(socket, [handler as any], (data: any) => of(data));

      expect(() => socket.emit('evt', { a: 1 })).not.toThrow();
    });

    it('logs a throwing emit and a throwing ack instead of escaping', () => {
      const adapter = new IoAdapter();
      const logError = silentLogger(adapter);
      const socket = createSocket();
      const error = new Error('encoder blew up');
      const originalEmit = socket.emit.bind(socket);

      socket.emit = (event: string, ...args: any[]) => {
        if (event === 'reply') {
          throw error;
        }
        return originalEmit(event, ...args);
      };

      const throwingAck = () => {
        throw error;
      };

      adapter.bindMessageHandlers(
        socket,
        [
          {
            message: 'evt-event',
            callback: () => ({ event: 'reply', data: 1 }),
            isAckHandledManually: false,
          } as any,
          {
            message: 'evt-ack',
            callback: () => ({ data: 1 }),
            isAckHandledManually: false,
          } as any,
        ],
        (data: any) => of(data),
      );

      expect(() => socket.emit('evt-event', {})).not.toThrow();
      expect(() => socket.emit('evt-ack', [{}, throwingAck])).not.toThrow();
      expect(logError).toHaveBeenCalledTimes(2);
      expect(logError).toHaveBeenNthCalledWith(1, error);
      expect(logError).toHaveBeenNthCalledWith(2, error);
    });

    it('logs a throwing handler through catchError and keeps the stream alive', () => {
      const adapter = new IoAdapter();
      const logError = silentLogger(adapter);
      const socket = createSocket();
      const error = new Error('handler blew up');
      const ack = vi.fn();
      let calls = 0;

      adapter.bindMessageHandlers(
        socket,
        [
          {
            message: 'evt',
            callback: () => {
              if (++calls === 1) {
                throw error;
              }
              return { data: 'recovered' };
            },
            isAckHandledManually: false,
          } as any,
        ],
        (data: any) => of(data),
      );

      socket.emit('evt', [{}, ack]);
      expect(ack).not.toHaveBeenCalled();

      socket.emit('evt', [{}, ack]);
      expect(ack).toHaveBeenCalledWith({ data: 'recovered' });
      expect(logError).toHaveBeenCalledWith(error);
    });

    it('stops handling messages after disconnect', () => {
      const adapter = new IoAdapter();
      const socket = createSocket();
      const callback = vi.fn(() => ({ data: 'ok' }));

      adapter.bindMessageHandlers(
        socket,
        [
          {
            message: 'evt',
            callback,
            isAckHandledManually: false,
          } as any,
        ],
        (data: any) => of(data),
      );

      socket.emit('disconnect');
      socket.emit('evt', {});

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('mapPayload (node 1 array, node 2 function, node 3 isAck, node 4 size === 1)', () => {
    it.each([
      ['non-array value', 42, { data: 42 }],
      ['non-array function', undefined, { data: undefined, ack: 'ack-fn' }],
      ['empty array', [], { data: [] }],
      ['array without ack', [1, 2], { data: [1, 2] }],
      ['single value plus ack', [1, 'ack-fn'], { data: 1, ack: 'ack-fn' }],
      [
        'several values plus ack',
        [1, 2, 3, 'ack-fn'],
        { data: [1, 2, 3], ack: 'ack-fn' },
      ],
      ['only an ack', ['ack-fn'], { data: [], ack: 'ack-fn' }],
    ])('%s', (_label, payload, expected) => {
      const adapter = new IoAdapter();
      const ackFn = () => undefined;
      const withAck = (value: any): any => {
        if (value === 'ack-fn') {
          return ackFn;
        }
        if (Array.isArray(value)) {
          return value.map(withAck);
        }
        if (value && typeof value === 'object') {
          return Object.fromEntries(
            Object.entries(value).map(([key, item]) => [key, withAck(item)]),
          );
        }
        return value;
      };

      const input = payload === undefined ? ackFn : withAck(payload);

      expect(adapter.mapPayload(input)).toEqual(withAck(expected));
    });
  });

  describe('bindClientDisconnect (no decision node)', () => {
    it('forwards the disconnect reason through once()', () => {
      const adapter = new IoAdapter();
      const callback = vi.fn();
      let registered: ((reason: string) => void) | undefined;
      const client = {
        once: vi.fn((event: string, cb: any) => {
          expect(event).toBe('disconnect');
          registered = cb;
        }),
      };

      adapter.bindClientDisconnect(client as any, callback);
      registered!('client namespace disconnect');

      expect(callback).toHaveBeenCalledWith('client namespace disconnect');
    });
  });

  describe('close (node 1c1 forceCloseConnections, 1c2 same httpServer)', () => {
    it('closes the server when forceCloseConnections is falsy: 1c1(F) (1c2 skipped)', async () => {
      const httpServer = { marker: 'http' };
      const adapter = new IoAdapter(httpServer);
      const close = vi.fn((cb: () => void) => cb());
      const server = { httpServer, close };

      await adapter.close(server as any);

      expect(close).toHaveBeenCalledTimes(1);
    });

    it('does not close the shared HTTP server: 1c1(T), 1c2(T)', async () => {
      const httpServer = { marker: 'http' };
      const adapter = new IoAdapter(httpServer);
      adapter.forceCloseConnections = true;
      const close = vi.fn();

      await adapter.close({ httpServer, close } as any);

      expect(close).not.toHaveBeenCalled();
    });

    it('closes another server even when forceCloseConnections is true: 1c1(T), 1c2(F)', async () => {
      const adapter = new IoAdapter({ marker: 'http' });
      adapter.forceCloseConnections = true;
      const close = vi.fn((cb: () => void) => cb());

      await adapter.close({ httpServer: { other: true }, close } as any);

      expect(close).toHaveBeenCalledTimes(1);
    });

    it('does nothing when the server has no close function', async () => {
      const adapter = new IoAdapter();
      adapter.forceCloseConnections = true;

      await expect(
        adapter.close({ httpServer: {} } as any),
      ).resolves.toBeUndefined();
    });
  });
});
