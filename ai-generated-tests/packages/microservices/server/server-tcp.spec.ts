import { EventEmitter } from 'events';
import { Socket as NetSocket } from 'net';
import { lastValueFrom, Observable, of, Subject, EMPTY } from 'rxjs';
import { NO_MESSAGE_HANDLER } from '../../../../packages/microservices/constants.js';
import { TcpContext } from '../../../../packages/microservices/ctx-host/tcp.context.js';
import { InvalidPacketIdException } from '../../../../packages/microservices/errors/invalid-packet-id.exception.js';
import { InvalidTcpDataReceptionException } from '../../../../packages/microservices/errors/invalid-tcp-data-reception.exception.js';
import { JsonSocket } from '../../../../packages/microservices/helpers/json-socket.js';
import { ServerTCP } from '../../../../packages/microservices/server/server-tcp.js';

class TestServerTCP extends ServerTCP {
  constructor(options: any = {}) {
    super(options);
  }

  public callInit() {
    this.init();
  }

  public callRegisterListeningListener(socket: any) {
    this.registerListeningListener(socket);
  }

  public callRegisterErrorListener(socket: any) {
    this.registerErrorListener(socket);
  }

  public callRegisterCloseListener(socket: any) {
    this.registerCloseListener(socket);
  }

  public callTrackOpenSocket(socket: any) {
    this.trackOpenSocket(socket);
  }

  public callCloseOpenSockets() {
    this.closeOpenSockets();
  }

  public callTrackDisconnect(socket: any) {
    this.trackDisconnect(socket);
  }

  public callEndOnDisconnect(
    result: unknown,
    context: TcpContext,
    socket: any,
  ) {
    return this.endOnDisconnect(result, context, socket);
  }

  public callGetSocketInstance(socket: any) {
    return this.getSocketInstance(socket);
  }
}

const createFakeNetServer = (options: { autoListen?: boolean } = {}) => {
  const fake: any = new EventEmitter();
  fake.listening = false;
  fake.close = vi.fn();
  fake.listen = vi.fn((_port: number, _host: string, callback?: () => void) => {
    if (options.autoListen !== false) {
      fake.listening = true;
      callback?.();
    }
  });
  return fake;
};

const createFakeTcpSocket = () => {
  const emitter = new EventEmitter();
  const socket: any = {
    sendMessage: vi.fn(),
    on: vi.fn((event: string, callback: (...args: any[]) => void) => {
      emitter.on(event, callback);
      return socket;
    }),
    once: vi.fn((event: string, callback: (...args: any[]) => void) => {
      emitter.once(event, callback);
      return socket;
    }),
    emitter,
  };
  return socket;
};

describe('ServerTCP', () => {
  let server: TestServerTCP;
  let untypedServer: any;
  const flush = () => new Promise<void>(resolve => setImmediate(resolve));

  beforeEach(() => {
    vi.restoreAllMocks();
    server = new TestServerTCP({});
    untypedServer = server as any;
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  // D1: options.port/host/... present vs default in constructor
  describe('constructor', () => {
    it('should apply the documented defaults', () => {
      expect(untypedServer.port).toBe(3000);
      expect(untypedServer.host).toBe('localhost');
      expect(untypedServer.socketClass).toBe(JsonSocket);
      expect(untypedServer.tlsOptions).toBeUndefined();
      expect(untypedServer.maxBufferSize).toBeUndefined();
      expect(untypedServer.incompleteMessageTimeout).toBeUndefined();
      expect(untypedServer.messageReceiveTimeout).toBeUndefined();
      expect(untypedServer.maxSendBufferSize).toBeUndefined();
      expect(untypedServer.drainTimeout).toBeUndefined();
      expect(untypedServer.transportId).toBe(0);
    });

    it('should keep every provided option', () => {
      const tlsOptions = {};
      const custom = new TestServerTCP({
        port: 1111,
        host: 'example.test',
        socketClass: JsonSocket,
        tlsOptions,
        maxBufferSize: 1,
        incompleteMessageTimeout: 2,
        messageReceiveTimeout: 3,
        maxSendBufferSize: 4,
        drainTimeout: 5,
      });

      expect((custom as any).port).toBe(1111);
      expect((custom as any).host).toBe('example.test');
      expect((custom as any).tlsOptions).toBe(tlsOptions);
      expect((custom as any).maxBufferSize).toBe(1);
      expect((custom as any).incompleteMessageTimeout).toBe(2);
      expect((custom as any).messageReceiveTimeout).toBe(3);
      expect((custom as any).maxSendBufferSize).toBe(4);
      expect((custom as any).drainTimeout).toBe(5);
    });
  });

  // D1: tlsOptions truthy in init
  // D2: pendingEventListeners processed in init
  describe('init', () => {
    it('should register the internal listeners on a plain net server', () => {
      expect(untypedServer.server.listenerCount('listening')).toBe(1);
      expect(untypedServer.server.listenerCount('error')).toBe(1);
      expect(untypedServer.server.listenerCount('close')).toBe(1);
    });

    it('should create a TLS server when tlsOptions are given', () => {
      const tlsServer = new TestServerTCP({ tlsOptions: {} });

      expect((tlsServer as any).server.listenerCount('listening')).toBe(1);
      // tls.Server adds its own connection listener and the server tracks raw
      // connections for shutdown during the handshake as well
      expect(
        (tlsServer as any).server.listenerCount('connection'),
      ).toBeGreaterThanOrEqual(1);
      expect(typeof (tlsServer as any).server.setSecureContext).toBe(
        'function',
      );
    });

    it('should apply listeners registered before init and clear the queue', () => {
      untypedServer.server = undefined;
      const callback = vi.fn();
      server.on('drain' as any, callback);

      server.callInit();

      expect(untypedServer.pendingEventListeners).toEqual([]);
      expect(untypedServer.server.listenerCount('drain')).toBe(1);
    });
  });

  // D1: retryTimer truthy on listen
  // D2: listen error before the callback settled
  // D3: error after the callback settled
  describe('listen', () => {
    let fakeServer: any;
    let statuses: string[];

    beforeEach(() => {
      fakeServer = createFakeNetServer();
      untypedServer.server = fakeServer;
      statuses = [];
      server.status.subscribe(status => statuses.push(status));
    });

    it('should listen on the configured port and host and settle the callback', () => {
      const callback = vi.fn();

      server.listen(callback);

      expect(fakeServer.listen).toHaveBeenCalledWith(
        3000,
        'localhost',
        expect.any(Function),
      );
      expect(callback).toHaveBeenCalledExactlyOnceWith();
      expect(statuses).toEqual([]);
    });

    it('should tolerate a missing callback', () => {
      expect(() => server.listen(undefined as any)).not.toThrow();
      expect(fakeServer.listen).toHaveBeenCalledOnce();
    });

    it('should tolerate a missing callback on a listen error', () => {
      fakeServer.listen = vi.fn();
      expect(() => server.listen(undefined as any)).not.toThrow();

      expect(() =>
        fakeServer.emit('error', new Error('listen failed')),
      ).not.toThrow();
    });

    it('should reset retry state and drop a stale retry timer', () => {
      untypedServer.retryAttemptsCount = 5;
      untypedServer.isManuallyTerminated = true;
      const staleTimer = setTimeout(() => {}, 10_000);
      untypedServer.retryTimer = staleTimer;

      server.listen(() => {});

      expect(untypedServer.retryAttemptsCount).toBe(0);
      expect(untypedServer.isManuallyTerminated).toBe(false);
      expect(untypedServer.retryTimer).toBeUndefined();
    });

    it('should pass a listen error to the callback and report disconnected', () => {
      const callback = vi.fn();
      const error = Object.assign(new Error('listen failed'), {
        code: 'EADDRINUSE',
      });
      fakeServer.listen = vi.fn();

      server.listen(callback);
      fakeServer.emit('error', error);

      expect(callback).toHaveBeenCalledExactlyOnceWith(error);
      expect(statuses).toEqual(['disconnected']);
    });

    it('should ignore an error that arrives after the callback settled', () => {
      const callback = vi.fn();
      server.listen(callback);

      fakeServer.emit(
        'error',
        Object.assign(new Error('late'), { code: 'EACCES' }),
      );

      expect(callback).toHaveBeenCalledTimes(1);
      expect(statuses).toEqual([]);
    });
  });

  // D1: retryTimer truthy on close
  describe('close', () => {
    it('should close the server, destroy open sockets and clear pending listeners', () => {
      const fakeServer = createFakeNetServer();
      untypedServer.server = fakeServer;
      const first = { destroy: vi.fn() };
      const second = { destroy: vi.fn() };
      untypedServer.openSockets.add(first).add(second);
      untypedServer.pendingEventListeners.push({
        event: 'drain',
        callback: vi.fn(),
      });

      server.close();

      expect(untypedServer.isManuallyTerminated).toBe(true);
      expect(fakeServer.close).toHaveBeenCalledOnce();
      expect(first.destroy).toHaveBeenCalledOnce();
      expect(second.destroy).toHaveBeenCalledOnce();
      expect(untypedServer.openSockets.size).toBe(0);
      expect(untypedServer.pendingEventListeners).toEqual([]);
    });

    it('should clear a pending retry timer', () => {
      untypedServer.server = createFakeNetServer();
      untypedServer.retryTimer = setTimeout(() => {}, 10_000);

      server.close();

      expect(untypedServer.retryTimer).toBeUndefined();
    });
  });

  // D1: readSocket 'message' rejection is caught
  // D2: readSocket 'error' wraps the error
  describe('bindHandler', () => {
    it('should register message, error and close listeners', () => {
      const readSocket = createFakeTcpSocket();
      vi.spyOn(untypedServer, 'getSocketInstance').mockReturnValue(readSocket);

      server.bindHandler(null as any);

      const events = readSocket.on.mock.calls.map(([event]: [string]) => event);
      expect(events).toEqual(
        expect.arrayContaining(['message', 'error', 'close']),
      );
    });

    it('should dispatch a message to handleMessage', async () => {
      const readSocket = createFakeTcpSocket();
      vi.spyOn(untypedServer, 'getSocketInstance').mockReturnValue(readSocket);
      const handleMessageSpy = vi
        .spyOn(server, 'handleMessage')
        .mockResolvedValue(undefined);
      server.bindHandler(null as any);

      readSocket.emitter.emit('message', { pattern: 'p', data: 1 });
      await flush();

      expect(handleMessageSpy).toHaveBeenCalledWith(readSocket, {
        pattern: 'p',
        data: 1,
      });
    });

    it('should route handleMessage rejections to handleError', async () => {
      const readSocket = createFakeTcpSocket();
      const error = new Error('unexpected');
      vi.spyOn(untypedServer, 'getSocketInstance').mockReturnValue(readSocket);
      vi.spyOn(server, 'handleMessage').mockRejectedValue(error);
      const handleErrorSpy = vi
        .spyOn(untypedServer, 'handleError')
        .mockImplementation(() => {});
      server.bindHandler(null as any);

      readSocket.emitter.emit('message', {});
      await flush();

      expect(handleErrorSpy).toHaveBeenCalledWith(error);
    });

    it('should wrap socket errors in InvalidTcpDataReceptionException', () => {
      const readSocket = createFakeTcpSocket();
      vi.spyOn(untypedServer, 'getSocketInstance').mockReturnValue(readSocket);
      const handleErrorSpy = vi
        .spyOn(untypedServer, 'handleError')
        .mockImplementation(() => {});
      server.bindHandler(null as any);

      readSocket.emitter.emit('error', 'bad frame');

      expect(handleErrorSpy).toHaveBeenCalledOnce();
      expect(handleErrorSpy.mock.calls[0][0]).toBeInstanceOf(
        InvalidTcpDataReceptionException,
      );
    });
  });

  // D1: packet.id is undefined
  // D2: handler lookup miss
  // D3: event-handler deprecation warning
  // D4: handler rejects inside produce
  // D5: response serialization failure inside respond
  describe('handleMessage', () => {
    let socket: any;
    let endHook: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      socket = { sendMessage: vi.fn() };
      endHook = vi.fn();
      untypedServer.onProcessingEndHook = endHook;
    });

    it('should dispatch a packet without an id as an event', async () => {
      const handler = vi.fn(async () => null);
      server.addHandler('event', handler);

      await server.handleMessage(socket, { pattern: 'event', data: 'payload' });

      expect(handler).toHaveBeenCalledWith('payload', expect.any(TcpContext));
      expect(socket.sendMessage).not.toHaveBeenCalled();
      expect(endHook).toHaveBeenCalledOnce();
    });

    it('should reply NO_MESSAGE_HANDLER when no handler matches', async () => {
      await server.handleMessage(socket, {
        pattern: 'missing',
        data: null,
        id: '3',
      });

      expect(socket.sendMessage).toHaveBeenCalledWith({
        id: '3',
        status: 'error',
        err: NO_MESSAGE_HANDLER,
      });
    });

    it('should reply with a plain handler value, copying the id', async () => {
      server.addHandler('request', async () => 'answer');

      await server.handleMessage(socket, {
        pattern: 'request',
        data: null,
        id: 7,
      });
      await flush();

      expect(socket.sendMessage).toHaveBeenCalledExactlyOnceWith({
        id: 7,
        response: 'answer',
        isDisposed: true,
      });
      expect(endHook).toHaveBeenCalledOnce();
    });

    it('should reply every value of an observable result', async () => {
      server.addHandler('request', async () => of('first', 'second'));

      await server.handleMessage(socket, {
        pattern: 'request',
        data: null,
        id: '3',
      });
      await flush();

      expect(socket.sendMessage.mock.calls).toEqual([
        [{ id: '3', response: 'first' }],
        [{ id: '3', response: 'second', isDisposed: true }],
      ]);
    });

    it('should reply only with the completion for an empty response stream', async () => {
      server.addHandler('request', async () => EMPTY);

      await server.handleMessage(socket, {
        pattern: 'request',
        data: null,
        id: '3',
      });
      await flush();

      expect(socket.sendMessage).toHaveBeenCalledExactlyOnceWith({
        id: '3',
        isDisposed: true,
      });
      expect(endHook).toHaveBeenCalledOnce();
    });

    it('should reply with an error packet when the handler rejects', async () => {
      server.addHandler('request', async () => {
        throw new Error('handler failed');
      });

      await expect(
        server.handleMessage(socket, {
          pattern: 'request',
          data: null,
          id: '3',
        }),
      ).rejects.toThrow('handler failed');
      await flush();

      expect(socket.sendMessage).toHaveBeenCalledExactlyOnceWith({
        err: { status: 'error', message: 'Internal server error' },
        isDisposed: true,
        id: '3',
      });
      expect(endHook).toHaveBeenCalledOnce();
    });

    it('should reject an invalid packet id before running the handler', async () => {
      const handler = vi.fn(async () => 'answer');
      server.addHandler('request', handler);

      const error = await server
        .handleMessage(socket, {
          pattern: 'request',
          data: null,
          id: 'a'.repeat(257),
        })
        .catch(err => err);

      expect(error).toBeInstanceOf(InvalidPacketIdException);
      expect(handler).not.toHaveBeenCalled();
      expect(socket.sendMessage).not.toHaveBeenCalled();
    });

    it('should warn once when an event handler replies', async () => {
      const warnSpy = vi
        .spyOn(untypedServer.logger, 'warn')
        .mockImplementation(() => {});
      server.addHandler('request', async () => 'answer', true);

      await server.handleMessage(socket, {
        pattern: 'request',
        data: null,
        id: 1,
      });
      await server.handleMessage(socket, {
        pattern: 'request',
        data: null,
        id: 2,
      });
      await flush();

      expect(warnSpy).toHaveBeenCalledOnce();
      expect(socket.sendMessage).toHaveBeenCalledTimes(2);
    });

    it('should queue the fallback error when serializing a reply throws', async () => {
      const errorSpy = vi
        .spyOn(untypedServer.logger, 'error')
        .mockImplementation(() => {});
      server.addHandler('request', async () => 'answer');
      vi.spyOn(untypedServer.serializer, 'serialize').mockImplementationOnce(
        () => {
          throw new Error('serialize failed');
        },
      );

      await server.handleMessage(socket, {
        pattern: 'request',
        data: null,
        id: '3',
      });
      await flush();

      expect(errorSpy).toHaveBeenCalledOnce();
      expect(socket.sendMessage).toHaveBeenCalledExactlyOnceWith({
        err: { status: 'error', message: 'Internal server error' },
        isDisposed: true,
        id: '3',
      });
    });

    it('should expose the packet metadata on the TcpContext', async () => {
      const handler = vi.fn(async () => null);
      server.addHandler('request', handler);
      const metadata = { traceId: 'trace-1' };

      await server.handleMessage(socket, {
        pattern: 'request',
        data: null,
        id: 1,
        metadata,
      });
      await flush();

      const context: TcpContext = handler.mock.calls[0][1];
      expect(context.getPattern()).toBe('request');
      expect(context.getMetadata()).toEqual(metadata);
    });

    it('should look up an unserializable pattern without throwing', async () => {
      const circular: any = {};
      circular.self = circular;

      await server.handleMessage(socket, {
        pattern: circular,
        data: null,
        id: 9,
      });

      expect(socket.sendMessage).toHaveBeenCalledWith({
        id: 9,
        status: 'error',
        err: NO_MESSAGE_HANDLER,
      });
    });
  });

  // D1: retryTimer already armed
  // D2: isManuallyTerminated
  // D3: server.listening
  // D4: retryAttempts falsy
  // D5: retryAttemptsCount >= retryAttempts
  // D6: timer callback: !isManuallyTerminated && !server.listening (both operands)
  describe('handleClose', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.clearAllTimers();
      vi.useRealTimers();
    });

    it('should arm a retry and coalesce close events while it is pending', () => {
      untypedServer.options = { retryAttempts: 2, retryDelay: 10 };
      const fakeServer = createFakeNetServer({ autoListen: false });
      untypedServer.server = fakeServer;

      const timer = server.handleClose();
      expect(timer).toBeDefined();
      expect(server.handleClose()).toBe(timer);

      vi.advanceTimersByTime(10);

      expect(fakeServer.listen).toHaveBeenCalledOnce();
      expect(untypedServer.retryTimer).toBeUndefined();
      expect(untypedServer.retryAttemptsCount).toBe(1);
    });

    it('should not arm a retry after a manual close', () => {
      untypedServer.options = { retryAttempts: 2 };
      untypedServer.server = createFakeNetServer({ autoListen: false });
      untypedServer.isManuallyTerminated = true;

      expect(server.handleClose()).toBeUndefined();
    });

    it('should not arm a retry while the server is listening', () => {
      untypedServer.options = { retryAttempts: 2 };
      const fakeServer = createFakeNetServer({ autoListen: false });
      fakeServer.listening = true;
      untypedServer.server = fakeServer;

      expect(server.handleClose()).toBeUndefined();
    });

    it('should not arm a retry when retryAttempts is not configured', () => {
      untypedServer.options = {};
      untypedServer.server = createFakeNetServer({ autoListen: false });

      expect(server.handleClose()).toBeUndefined();
    });

    it('should not arm a retry once the attempts are exhausted', () => {
      untypedServer.options = { retryAttempts: 2 };
      untypedServer.server = createFakeNetServer({ autoListen: false });
      untypedServer.retryAttemptsCount = 2;

      expect(server.handleClose()).toBeUndefined();
    });

    it('should use a zero delay when retryDelay is missing', () => {
      untypedServer.options = { retryAttempts: 1 };
      const fakeServer = createFakeNetServer({ autoListen: false });
      untypedServer.server = fakeServer;

      server.handleClose();
      vi.advanceTimersByTime(0);

      expect(fakeServer.listen).toHaveBeenCalledOnce();
    });

    it('should not listen from the retry once the server listens again', () => {
      untypedServer.options = { retryAttempts: 2, retryDelay: 10 };
      const fakeServer = createFakeNetServer({ autoListen: false });
      untypedServer.server = fakeServer;

      server.handleClose();
      fakeServer.listening = true;
      vi.advanceTimersByTime(10);

      expect(fakeServer.listen).not.toHaveBeenCalled();
    });

    it('should not listen from the retry after a manual close', () => {
      untypedServer.options = { retryAttempts: 2, retryDelay: 10 };
      const fakeServer = createFakeNetServer({ autoListen: false });
      untypedServer.server = fakeServer;

      server.handleClose();
      untypedServer.isManuallyTerminated = true;
      vi.advanceTimersByTime(10);

      expect(fakeServer.listen).not.toHaveBeenCalled();
    });

    it('should return the armed timer without re-arming', () => {
      untypedServer.options = { retryAttempts: 2, retryDelay: 10 };
      untypedServer.server = createFakeNetServer({ autoListen: false });

      const timer = server.handleClose();

      expect(server.handleClose()).toBe(timer);
      expect(untypedServer.retryTimer).toBe(timer);
    });
  });

  // D1: this.server falsy
  describe('unwrap', () => {
    it('should return the underlying server when initialized', () => {
      const fakeServer = createFakeNetServer();
      untypedServer.server = fakeServer;

      expect(server.unwrap()).toBe(fakeServer);
    });

    it('should throw when the server is not initialized', () => {
      untypedServer.server = undefined;

      expect(() => server.unwrap()).toThrow(/Not initialized/);
    });
  });

  // D1: this.server truthy when registering
  describe('on', () => {
    it('should register directly when the server exists', () => {
      const fakeServer = createFakeNetServer();
      untypedServer.server = fakeServer;
      const callback = vi.fn();

      server.on('end' as any, callback);

      expect(fakeServer.listenerCount('end')).toBe(1);
    });

    it('should queue listeners until init when the server does not exist', () => {
      untypedServer.server = undefined;
      const callback = vi.fn();

      server.on('end' as any, callback);

      expect(untypedServer.pendingEventListeners).toEqual([
        { event: 'end', callback },
      ]);
    });
  });

  // D0: emits connected on 'listening'
  describe('registerListeningListener', () => {
    it('should publish the connected status', () => {
      const statuses: string[] = [];
      server.status.subscribe(status => statuses.push(status));
      const fakeServer = new EventEmitter();

      server.callRegisterListeningListener(fakeServer);
      fakeServer.emit('listening');

      expect(statuses).toEqual(['connected']);
    });
  });

  // D1: error.code === ECONNREFUSED
  describe('registerErrorListener', () => {
    it.each([
      ['ECONNREFUSED', 'ECONNREFUSED', ['disconnected']],
      ['another code', 'EADDRINUSE', []],
    ])('should handle an error with %s', (_label, code, expectedStatuses) => {
      const errorSpy = vi
        .spyOn(untypedServer.logger, 'error')
        .mockImplementation(() => {});
      const statuses: string[] = [];
      server.status.subscribe(status => statuses.push(status));
      const fakeServer = new EventEmitter();
      server.callRegisterErrorListener(fakeServer);
      const error = Object.assign(new Error('boom'), { code });

      fakeServer.emit('error', error);

      expect(errorSpy).toHaveBeenCalledWith(error);
      expect(statuses).toEqual(expectedStatuses);
    });

    it('should handle an error without a code', () => {
      const errorSpy = vi
        .spyOn(untypedServer.logger, 'error')
        .mockImplementation(() => {});
      const fakeServer = new EventEmitter();
      server.callRegisterErrorListener(fakeServer);
      const error = new Error('boom');

      fakeServer.emit('error', error);

      expect(errorSpy).toHaveBeenCalledWith(error);
    });
  });

  // D0: publishes disconnected and calls handleClose
  describe('registerCloseListener', () => {
    it('should publish disconnected and delegate to handleClose', () => {
      const handleCloseSpy = vi
        .spyOn(server, 'handleClose')
        .mockReturnValue(undefined);
      const statuses: string[] = [];
      server.status.subscribe(status => statuses.push(status));
      const fakeServer = new EventEmitter();
      server.callRegisterCloseListener(fakeServer);

      fakeServer.emit('close');

      expect(statuses).toEqual(['disconnected']);
      expect(handleCloseSpy).toHaveBeenCalledOnce();
    });
  });

  // D1: socket falsy
  describe('trackOpenSocket', () => {
    it('should ignore a missing socket', () => {
      expect(() => server.callTrackOpenSocket(undefined)).not.toThrow();
      expect(untypedServer.openSockets.size).toBe(0);
    });

    it('should track a socket and drop it on close', () => {
      const listeners: Record<string, () => void> = {};
      const socket = {
        on: vi.fn(
          (event: string, callback: () => void) =>
            (listeners[event] = callback),
        ),
        destroy: vi.fn(),
      };

      server.callTrackOpenSocket(socket);

      expect(untypedServer.openSockets.has(socket)).toBe(true);
      listeners.close();
      expect(untypedServer.openSockets.has(socket)).toBe(false);
    });
  });

  describe('closeOpenSockets', () => {
    // D0: one iteration per tracked socket
    it('should destroy and clear every tracked socket', () => {
      const sockets = [{ destroy: vi.fn() }, { destroy: vi.fn() }];
      sockets.forEach(socket => untypedServer.openSockets.add(socket));

      server.callCloseOpenSockets();

      expect(sockets[0].destroy).toHaveBeenCalledOnce();
      expect(sockets[1].destroy).toHaveBeenCalledOnce();
      expect(untypedServer.openSockets.size).toBe(0);
    });
  });

  // D0: close and error both signal the notifier
  describe('trackDisconnect', () => {
    it.each(['close', 'error'])('should emit once on "%s"', event => {
      const socket = createFakeTcpSocket();
      const values: unknown[] = [];
      server.callTrackDisconnect(socket);
      untypedServer.disconnectNotifiers
        .get(socket)
        .subscribe((value: unknown) => values.push(value));

      socket.emitter.emit(event);

      expect(values).toEqual([undefined]);
    });
  });

  // D1: !isObservable(result)
  // D2: !disconnect$ (no notifier for the socket)
  describe('endOnDisconnect', () => {
    it('should return the transformed value and ignore disconnects for a plain result', async () => {
      const socket = createFakeTcpSocket();
      server.callTrackDisconnect(socket);
      const context = new TcpContext([socket, 'p']);

      const stream$ = server.callEndOnDisconnect('value', context, socket);
      socket.emitter.emit('close');

      await expect(lastValueFrom(stream$)).resolves.toBe('value');
    });

    it('should return the observable unchanged when the socket has no notifier', () => {
      const socket = createFakeTcpSocket();
      const source = new Subject<string>();
      const context = new TcpContext([socket, 'p']);

      const stream$ = server.callEndOnDisconnect(source, context, socket);

      expect(stream$).toBe(source);
    });

    it('should end an observable result when the peer disconnects', () => {
      const socket = createFakeTcpSocket();
      server.callTrackDisconnect(socket);
      const context = new TcpContext([socket, 'p']);
      const stream$: Observable<string> = server.callEndOnDisconnect(
        of('a', 'b'),
        context,
        socket,
      );
      const values: string[] = [];
      let completed = false;

      stream$.subscribe({
        next: value => values.push(value),
        complete: () => (completed = true),
      });
      expect(completed).toBe(true);

      const late = server.callEndOnDisconnect(
        new Subject<string>(),
        context,
        socket,
      );
      let lateCompleted = false;
      late.subscribe({ complete: () => (lateCompleted = true) });
      socket.emitter.emit('close');

      expect(values).toEqual(['a', 'b']);
      expect(lateCompleted).toBe(true);
    });

    it('should not end a plain result after the peer disconnects', async () => {
      const socket = createFakeTcpSocket();
      server.callTrackDisconnect(socket);
      const context = new TcpContext([socket, 'p']);

      const stream$ = server.callEndOnDisconnect(
        Promise.resolve('value'),
        context,
        socket,
      );
      await expect(lastValueFrom(stream$)).resolves.toBe('value');
    });
  });

  // D1: any framing option defined
  // D2: socketClass is JsonSocket
  describe('getSocketInstance', () => {
    it('should create a JsonSocket with default options', () => {
      const socket = server.callGetSocketInstance(new NetSocket());

      expect(socket).toBeInstanceOf(JsonSocket);
      expect((socket as any).maxBufferSize).toBe(134_217_728);
    });

    it('should pass the framing options to JsonSocket', () => {
      const custom = new TestServerTCP({
        maxBufferSize: 5000,
        drainTimeout: 6000,
      });
      const socket = custom.callGetSocketInstance(new NetSocket());

      expect(socket).toBeInstanceOf(JsonSocket);
      expect((socket as any).maxBufferSize).toBe(5000);
      expect((socket as any).drainTimeout).toBe(6000);
    });

    it('should not pass framing options to a custom socket class', () => {
      class CustomSocket {
        constructor(public readonly socket: NetSocket) {}
      }
      const custom = new TestServerTCP({
        socketClass: CustomSocket,
        maxBufferSize: 5000,
      });
      const netSocket = new NetSocket();

      const socket = custom.callGetSocketInstance(netSocket);

      expect(socket).toBeInstanceOf(CustomSocket);
      expect((socket as any).maxBufferSize).toBeUndefined();
      expect((socket as any).socket).toBe(netSocket);
    });

    it('should create a custom socket class without framing options', () => {
      class CustomSocket {
        constructor(public readonly socket: NetSocket) {}
      }
      const custom = new TestServerTCP({ socketClass: CustomSocket });

      expect(custom.callGetSocketInstance(new NetSocket())).toBeInstanceOf(
        CustomSocket,
      );
    });
  });
});
