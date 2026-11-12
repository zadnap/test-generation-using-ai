import { EventEmitter, once } from 'events';
import { STATUS_CODES, Server, createServer } from 'http';
import {
  isObservable,
  lastValueFrom,
  of,
  Subject,
  throwError,
  toArray,
} from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { WebSocket, WebSocketServer } from 'ws';
import { WsAdapter } from '../../../../packages/platform-ws/adapters/ws-adapter.js';

/**
 * C3 analysis of `WsAdapter` (decision nodes after splitting atomic
 * conditions, short-circuit respected).
 *
 * constructor:
 *   D1 `options?.messageParser`                              -> 1(T)/1(F)
 *   D2 `options?.maxConcurrentMessages ?? DEFAULT`           -> 2(T)/2(F)
 *   D3 `options?.maxSendBufferSize ?? DEFAULT`               -> 3(T)/3(F)
 *
 * create:
 *   D1 `wsOptions?.namespace`                                -> 1(T)/1(F)
 *   D2 `port === 0 && this.httpServer`                       -> 2c1(T/F) 2c2(T/F)
 *   D3 `server`                                              -> 3(T)/3(F)
 *   D4 `path && port !== 0`                                  -> 4c1(T/F) 4c2(T/F)
 *
 * bindMessageHandlers / updatePaused:
 *   D1 `isBacklogged || (pendingReplies > 0 && buffered > HIGH)` -> 1c1(T/F) 1c2(T/F) 1c3(T/F)
 *   D2 `shouldPause === isPaused`                            -> 2(T)/2(F)
 *   D3 `isPaused`                                            -> 3(T)/3(F)   (pause vs resume)
 *   D4 `client.readyState === OPEN` (message filter)         -> 4(T)/4(F)
 *   D5 `ensureSendBufferWithinLimit(client)` (filter)        -> 5(T)/5(F)
 *   D6 `!isNil(result)`                                      -> 6(T)/6(F)
 *   D7 `client.readyState !== OPEN` (onMessage guard)        -> 7(T)/7(F)
 *   D8 `JSON.stringify` throws                               -> 8(T)/8(F)
 *   D9 `ensureSendBufferWithinLimit(client)` (after send)    -> 9(T)/9(F)
 *
 * bindMessageHandler:
 *   D1 `messageParser` throws                                -> 1(T)/1(F)
 *   D2 `this.messageParser !== defaultMessageParser`         -> 2(T)/2(F)
 *   D3 `!message`                                            -> 3(T)/3(F)
 *   D4 `!messageHandler`                                     -> 4(T)/4(F)
 *   D5 `callback`/`transform` throws                         -> 5(T)/5(F)
 *
 * ensureSendBufferWithinLimit:
 *   D1 `!maxSendBufferSize || !(bufferedAmount > max)`       -> 1c1(T/F) 1c2(T/F)
 *   D2 `client.readyState === OPEN`                          -> 2(T)/2(F)
 *
 * close: D1 `server.clients` -> 1(T)/1(F)
 * dispose: D1 `port !== 0` -> 1(T)/1(F)
 * ensureHttpServerExists:
 *   D1 `httpServersRegistry.has(port)`                       -> 1(T)/1(F)
 *   D2 `pathname === wsServer.path` (inside for..of)         -> 2(T)/2(F)
 *   D3 `!isRequestDelegated`                                 -> 3(T)/3(F)
 */

const collect = (source: any) => lastValueFrom(source.pipe(toArray()));
const frame = (payload: unknown) => ({ data: JSON.stringify(payload) });

const handlersFor = (event: string, callback: (...args: any[]) => any) =>
  new Map([
    [
      event,
      {
        message: event,
        methodName: event,
        callback,
        isAckHandledManually: false,
      },
    ],
  ]) as any;

const silenceError = (adapter: any) =>
  vi.spyOn(adapter['logger'], 'error').mockImplementation(() => undefined);
const silenceWarn = (adapter: any) =>
  vi.spyOn(adapter['logger'], 'warn').mockImplementation(() => undefined);

const fakeHttpServer = () => {
  const server: any = new EventEmitter();
  server.close = vi.fn((callback?: (error?: Error) => void) => callback?.());
  server.listen = vi.fn();
  return server;
};

const fakeSocket = () => ({
  destroy: vi.fn(),
  end: vi.fn(),
  on: vi.fn(),
  once: vi.fn(),
});

const openClient = () => {
  const client: any = new EventEmitter();
  client.readyState = 1; // OPEN
  client.bufferedAmount = 0;
  client.sendCallbacks = [] as Array<() => void>;
  client.send = vi.fn((_payload: string, callback: () => void) =>
    client.sendCallbacks.push(callback),
  );
  client.pause = vi.fn();
  client.resume = vi.fn();
  client.terminate = vi.fn(() => (client.readyState = 2)); // CLOSING
  return client;
};

const bindHandlers = (
  adapter: WsAdapter,
  client: any,
  callback: (...args: any[]) => any,
  transform: (data: any) => any = data =>
    isObservable(data) ? data : of(data),
) =>
  adapter.bindMessageHandlers(
    client,
    [
      {
        message: 'event',
        methodName: 'event',
        callback,
        isAckHandledManually: false,
      },
    ],
    transform as any,
  );

describe('WsAdapter (C3)', () => {
  describe('constructor (D1, D2, D3)', () => {
    it('uses the defaults when no options are given: D1(F), D2(T), D3(T)', () => {
      const adapter = new WsAdapter();

      expect(adapter['maxConcurrentMessages']).toBe(1000);
      expect(adapter['maxSendBufferSize']).toBe(128 * 1024 * 1024);
    });

    it('installs every option when given: D1(T), D2(F), D3(F)', async () => {
      const parser = vi.fn(() => ({ event: 'custom', data: 7 }));
      const adapter = new WsAdapter(undefined, {
        messageParser: parser,
        maxConcurrentMessages: 3,
        maxSendBufferSize: 2048,
      });
      const callback = vi.fn().mockReturnValue('reply');

      await collect(
        adapter.bindMessageHandler(
          { data: 'raw' },
          handlersFor('custom', callback),
          data => of(data),
        ),
      );

      expect(parser).toHaveBeenCalledWith('raw');
      expect(callback).toHaveBeenCalledWith(7, 'custom');
      expect(adapter['maxConcurrentMessages']).toBe(3);
      expect(adapter['maxSendBufferSize']).toBe(2048);
    });
  });

  describe('create (D1 - D4)', () => {
    it('rejects the namespace option: D1(T)', () => {
      const adapter = new WsAdapter(fakeHttpServer());
      const logError = silenceError(adapter);

      expect(() => adapter.create(0, { namespace: '/chat' })).toThrow(
        /does not support namespaces/,
      );
      expect(logError).toHaveBeenCalledTimes(1);
    });

    it('creates a noServer ws server over the http server of the app: D1(F), D2c1(T), D2c2(T), D3(F), D4c1(T), D4c2(F)', () => {
      const httpServer = fakeHttpServer();
      const adapter = new WsAdapter(httpServer);

      const server: any = adapter.create(0, { path: '/live/' });

      expect(server).toBeInstanceOf(WebSocketServer);
      expect(server.path).toBe('/live');
      expect(httpServer.listenerCount('upgrade')).toBe(1);
      expect(httpServer.listen).not.toHaveBeenCalled();
      expect(adapter['httpServersRegistry'].get(0)).toBe(httpServer);
      expect(adapter['wsServersRegistry'].get(0)).toEqual([server]);
    });

    it('returns the server supplied by the caller: D2c2(F), D3(T)', () => {
      const adapter = new WsAdapter();
      const server = { custom: true };

      expect(adapter.create(0, { server })).toBe(server);
    });

    it('creates its own ws server for port 0 without path: D2c2(F), D3(F), D4c1(F)', async () => {
      const adapter = new WsAdapter();
      const server = adapter.create(0);

      await once(server, 'listening');
      expect((server.address() as any).port).toBeGreaterThan(0);

      await adapter.close(server);
      await adapter.dispose();
    });

    it('creates its own ws server for port 0 with a path: D4c1(T), D4c2(F)', async () => {
      const adapter = new WsAdapter();
      const server = adapter.create(0, { path: '/chat' });

      await once(server, 'listening');
      const port = (server.address() as any).port;
      const client = new WebSocket(`ws://127.0.0.1:${port}/chat`);
      try {
        await once(client, 'open');
      } finally {
        client.terminate();
        await adapter.close(server);
        await adapter.dispose();
      }
    });

    it('shares one http server between paths on a port above 0: D2c1(F), D4c1(T), D4c2(T)', () => {
      const httpServer = fakeHttpServer();
      const adapter = new WsAdapter(httpServer);
      const port = 43210;
      // pre-register the port so the adapter must reuse it (D1(T) of
      // ensureHttpServerExists) instead of opening a real socket
      adapter['ensureHttpServerExists'](port, httpServer);

      const first: any = adapter.create(port, { path: '/a' });
      const second: any = adapter.create(port, { path: '/b' });

      expect(first).toBeInstanceOf(WebSocketServer);
      expect(second).toBeInstanceOf(WebSocketServer);
      expect(first).not.toBe(second);
      expect(httpServer.listen).not.toHaveBeenCalled();
      expect(adapter['wsServersRegistry'].get(port)).toEqual([first, second]);
      expect(first.path).toBe('/a');
      expect(second.path).toBe('/b');
    });
  });

  describe('bindMessageHandler (D1 - D5)', () => {
    it('parses a frame and forwards it to the registered handler: D1(F), D3(F), D4(F), D5(F)', async () => {
      const adapter = new WsAdapter();
      const callback = vi.fn().mockReturnValue('reply');

      const result = await collect(
        adapter.bindMessageHandler(
          frame({ event: 'event', data: { a: 1 } }),
          handlersFor('event', callback),
          data => of(data),
        ),
      );

      expect(callback).toHaveBeenCalledWith({ a: 1 }, 'event');
      expect(result).toEqual(['reply']);
    });

    it('drops a malformed frame silently with the default parser: D1(T), D2(F)', async () => {
      const adapter = new WsAdapter();
      const logError = silenceError(adapter);

      const result = await collect(
        adapter.bindMessageHandler({ data: 'not json' }, new Map(), data =>
          of(data),
        ),
      );

      expect(result).toEqual([]);
      expect(logError).not.toHaveBeenCalled();
    });

    it('reports a throwing custom parser: D1(T), D2(T)', async () => {
      const adapter = new WsAdapter(undefined, {
        messageParser: () => {
          throw new Error('parser blew up');
        },
      });
      const logError = silenceError(adapter);

      const result = await collect(
        adapter.bindMessageHandler({ data: 'raw' }, new Map(), data =>
          of(data),
        ),
      );

      expect(result).toEqual([]);
      expect(logError).toHaveBeenCalledTimes(1);
    });

    it('drops the frame when the parser returns nothing: D3(T)', async () => {
      const adapter = new WsAdapter(undefined, {
        messageParser: () => undefined,
      });
      const callback = vi.fn();

      const result = await collect(
        adapter.bindMessageHandler(
          { data: 'raw' },
          handlersFor('event', callback),
          data => of(data),
        ),
      );

      expect(result).toEqual([]);
      expect(callback).not.toHaveBeenCalled();
    });

    it('drops an event that no handler is registered for: D4(T)', async () => {
      const adapter = new WsAdapter();
      const callback = vi.fn();

      const result = await collect(
        adapter.bindMessageHandler(
          frame({ event: 'unknown', data: {} }),
          handlersFor('event', callback),
          data => of(data),
        ),
      );

      expect(result).toEqual([]);
      expect(callback).not.toHaveBeenCalled();
    });

    it('swallows a handler that throws synchronously: D5(T)', async () => {
      const adapter = new WsAdapter();

      const result = await collect(
        adapter.bindMessageHandler(
          frame({ event: 'event', data: {} }),
          handlersFor('event', () => {
            throw new Error('handler blew up');
          }),
          data => of(data),
        ),
      );

      expect(result).toEqual([]);
    });

    it('swallows a transform that throws synchronously: D5(T)', async () => {
      const adapter = new WsAdapter();

      const result = await collect(
        adapter.bindMessageHandler(
          frame({ event: 'event', data: {} }),
          handlersFor('event', () => 'value'),
          () => {
            throw new Error('transform blew up');
          },
        ),
      );

      expect(result).toEqual([]);
    });

    it('uses a parser installed through setMessageParser', async () => {
      const adapter = new WsAdapter();
      const parser = vi.fn(() => ({ event: 'custom', data: 42 }));
      const callback = vi.fn().mockReturnValue('reply');

      adapter.setMessageParser(parser);

      const result = await collect(
        adapter.bindMessageHandler(
          { data: 'raw' },
          handlersFor('custom', callback),
          data => of(data),
        ),
      );

      expect(parser).toHaveBeenCalledWith('raw');
      expect(callback).toHaveBeenCalledWith(42, 'custom');
      expect(result).toEqual(['reply']);
    });
  });

  describe('bindMessageHandlers flow control (D1 - D9)', () => {
    it('walks every pause/resume transition: D1c1(T/F), D1c2(T/F), D1c3(T/F), D2(T/F), D3(T/F)', () => {
      const client = openClient();
      const adapter = new WsAdapter(undefined, { maxConcurrentMessages: 1 });
      const inners: Subject<string>[] = [];
      bindHandlers(adapter, client, () => {
        const inner = new Subject<string>();
        inners.push(inner);
        return inner;
      });

      // first message starts right away: nothing waits (D1c1 F), no reply yet
      client.emit('message', frame({ event: 'event' }));
      expect(client.pause).not.toHaveBeenCalled();

      // second message waits for its turn: isBacklogged(T) -> pause
      client.emit('message', frame({ event: 'event' }));
      expect(client.pause).toHaveBeenCalledTimes(1);

      // a reply is sent while the second message still waits: the backlog
      // keeps shouldPause true and isPaused is already true -> D2(T)
      inners[0].next('a');
      expect(client.send).toHaveBeenCalledTimes(1);
      expect(client.resume).not.toHaveBeenCalled();

      // the first inner completes, the queued message starts and the backlog
      // clears: pendingReplies is 1 but the buffer is empty -> resume
      inners[0].complete();
      expect(inners).toHaveLength(2);
      expect(client.pause).toHaveBeenCalledTimes(1);
      expect(client.resume).toHaveBeenCalledTimes(1);

      // reply acknowledged: pendingReplies === 0 -> D1c2(F)
      client.sendCallbacks[0]();
      expect(client.pause).toHaveBeenCalledTimes(1);
      expect(client.resume).toHaveBeenCalledTimes(1);

      // client stops reading, a reply is pending: D1c3(T) -> pause again
      client.bufferedAmount = 2 * 1024 * 1024;
      inners[1].next('b');
      expect(client.pause).toHaveBeenCalledTimes(2);

      // the reply is flushed -> resume
      client.bufferedAmount = 0;
      client.sendCallbacks[1]();
      expect(client.resume).toHaveBeenCalledTimes(2);
    });

    it('does not require pause/resume on the client (optional calls)', () => {
      const client: any = new EventEmitter();
      client.readyState = 1;
      client.send = vi.fn();
      const adapter = new WsAdapter(undefined, { maxConcurrentMessages: 1 });
      const inners: Subject<string>[] = [];
      bindHandlers(adapter, client, () => {
        const inner = new Subject<string>();
        inners.push(inner);
        return inner;
      });

      client.emit('message', frame({ event: 'event' }));
      client.emit('message', frame({ event: 'event' })); // pause?.() skipped
      inners[0].complete(); // resume?.() skipped

      expect(inners).toHaveLength(2);
    });

    it('drops a message received while the client is not open: D4(F)', () => {
      const client = openClient();
      const callback = vi.fn();
      const adapter = new WsAdapter();
      bindHandlers(adapter, client, callback);

      client.readyState = 2; // CLOSING
      client.emit('message', frame({ event: 'event' }));

      expect(callback).not.toHaveBeenCalled();
    });

    it('drops a message once more than maxSendBufferSize is queued: D5(F)', () => {
      const client = openClient();
      const callback = vi.fn();
      const adapter = new WsAdapter(undefined, { maxSendBufferSize: 100 });
      silenceWarn(adapter);
      bindHandlers(adapter, client, callback);

      client.bufferedAmount = 101;
      client.emit('message', frame({ event: 'event' }));

      expect(callback).not.toHaveBeenCalled();
      expect(client.terminate).toHaveBeenCalledTimes(1);
    });

    it('sends nothing for a handler that emits nothing: D6(F)', () => {
      const client = openClient();
      const adapter = new WsAdapter();
      bindHandlers(adapter, client, () => undefined);

      client.emit('message', frame({ event: 'event' }));

      expect(client.send).not.toHaveBeenCalled();
    });

    it('logs an error raised by the handler observable and keeps the stream alive', () => {
      const client = openClient();
      const adapter = new WsAdapter();
      const logError = silenceError(adapter);
      let calls = 0;
      bindHandlers(
        adapter,
        client,
        () => (++calls === 1 ? throwError(() => new Error('boom')) : of('ok')),
        data => data,
      );

      client.emit('message', frame({ event: 'event' }));
      client.emit('message', frame({ event: 'event' }));

      expect(logError).toHaveBeenCalledTimes(1);
      expect(client.send).toHaveBeenCalledTimes(1);
      expect(client.send).toHaveBeenCalledWith('"ok"', expect.any(Function));
    });

    it('does not send a response when the client closed while the handler ran: D7(T)', () => {
      const client = openClient();
      const adapter = new WsAdapter();
      bindHandlers(adapter, client, () => {
        client.readyState = 2; // CLOSING
        return 'reply';
      });

      client.emit('message', frame({ event: 'event' }));

      expect(client.send).not.toHaveBeenCalled();
    });

    it('logs an unserializable response and keeps the stream alive: D8(T)', () => {
      const client = openClient();
      const adapter = new WsAdapter();
      const logError = silenceError(adapter);
      const circular: any = {};
      circular.self = circular;
      let calls = 0;
      bindHandlers(adapter, client, () => (++calls === 1 ? circular : 'ok'));

      client.emit('message', frame({ event: 'event' }));
      client.emit('message', frame({ event: 'event' }));

      expect(logError).toHaveBeenCalledTimes(1);
      expect(logError.mock.calls[0][0]).toBeInstanceOf(TypeError);
      expect(client.send).toHaveBeenCalledTimes(1);
    });

    it('skips the flow-control update when the send buffer is exceeded: D9(F)', () => {
      const client = openClient();
      const adapter = new WsAdapter(undefined, { maxSendBufferSize: 100 });
      silenceWarn(adapter);
      client.send = vi.fn((payload: string, callback: () => void) => {
        client.bufferedAmount += payload.length;
        client.sendCallbacks.push(callback);
      });
      bindHandlers(adapter, client, () => 'x'.repeat(200));

      client.emit('message', frame({ event: 'event' }));

      expect(client.send).toHaveBeenCalledTimes(1);
      expect(client.terminate).toHaveBeenCalledTimes(1);
      // the callback is still registered, so a later flush keeps working
      client.sendCallbacks[0]();
      expect(client.pause).not.toHaveBeenCalled();
    });

    it('stops handling messages after the client closed', () => {
      const client = openClient();
      const adapter = new WsAdapter();
      const callback = vi.fn().mockReturnValue('reply');
      bindHandlers(adapter, client, callback);

      client.emit('message', frame({ event: 'event' }));
      expect(callback).toHaveBeenCalledTimes(1);

      client.emit('close');
      client.emit('message', frame({ event: 'event' }));
      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe('ensureSendBufferWithinLimit (D1, D2)', () => {
    it.each([
      ['the limit is disabled', 0, 10_000, true],
      ['the buffer equals the limit', 100, 100, true],
      ['the buffer is below the limit', 100, 50, true],
    ])(
      'keeps the client when %s: D1c1(T/F), D1c2(T)',
      (_label, maxSendBufferSize, bufferedAmount, expected) => {
        const adapter = new WsAdapter(undefined, { maxSendBufferSize });
        const client = openClient();
        client.bufferedAmount = bufferedAmount;

        expect(adapter['ensureSendBufferWithinLimit'](client)).toBe(expected);
        expect(client.terminate).not.toHaveBeenCalled();
      },
    );

    it('terminates an open client above the limit: D1c1(F), D1c2(F), D2(T)', () => {
      const adapter = new WsAdapter(undefined, { maxSendBufferSize: 100 });
      const logWarn = silenceWarn(adapter);
      const client = openClient();
      client.bufferedAmount = 101;

      expect(adapter['ensureSendBufferWithinLimit'](client)).toBe(false);
      expect(logWarn).toHaveBeenCalledTimes(1);
      expect(client.terminate).toHaveBeenCalledTimes(1);
    });

    it('does not terminate a client that is already closing: D2(F)', () => {
      const adapter = new WsAdapter(undefined, { maxSendBufferSize: 100 });
      const logWarn = silenceWarn(adapter);
      const client = openClient();
      client.bufferedAmount = 101;
      client.readyState = 2; // CLOSING

      expect(adapter['ensureSendBufferWithinLimit'](client)).toBe(false);
      expect(logWarn).not.toHaveBeenCalled();
      expect(client.terminate).not.toHaveBeenCalled();
    });

    it('allows up to 128 MB by default: D1c1(F), D1c2(T/F)', () => {
      const adapter = new WsAdapter();
      silenceWarn(adapter);
      const client = openClient();

      client.bufferedAmount = 128 * 1024 * 1024;
      expect(adapter['ensureSendBufferWithinLimit'](client)).toBe(true);

      client.bufferedAmount++;
      expect(adapter['ensureSendBufferWithinLimit'](client)).toBe(false);
      expect(client.terminate).toHaveBeenCalledTimes(1);
    });
  });

  describe('bindErrorHandler', () => {
    it('logs errors of connections and of the server itself', () => {
      const adapter = new WsAdapter();
      const logError = silenceError(adapter);
      const server = new EventEmitter();
      const ws = new EventEmitter();

      expect(adapter.bindErrorHandler(server)).toBe(server);

      server.emit('connection', ws);
      const clientError = new Error('ws blew up');
      ws.emit('error', clientError);
      const serverError = new Error('server blew up');
      server.emit('error', serverError);

      expect(logError).toHaveBeenCalledWith(clientError);
      expect(logError).toHaveBeenCalledWith(serverError);
      expect(logError).toHaveBeenCalledTimes(2);
    });
  });

  describe('bindClientDisconnect (D1)', () => {
    it('uses once() when the client provides it: D1(T)', () => {
      const adapter = new WsAdapter();
      const client = new EventEmitter();
      const callback = vi.fn();

      adapter.bindClientDisconnect(client, callback);
      client.emit('close');
      client.emit('close');

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('falls back to on() otherwise: D1(F)', () => {
      const adapter = new WsAdapter();
      const callback = vi.fn();
      const client = { on: vi.fn(), emit: vi.fn() };

      adapter.bindClientDisconnect(client, callback);

      expect(client.on).toHaveBeenCalledWith('close', callback);
    });
  });

  describe('close (D1)', () => {
    it('terminates every connected client: D1(T)', async () => {
      const adapter = new WsAdapter();
      const clients = [{ terminate: vi.fn() }, { terminate: vi.fn() }];
      const server = {
        clients: new Set(clients),
        close: (callback: () => void) => callback(),
      };

      await adapter.close(server);

      for (const client of clients) {
        expect(client.terminate).toHaveBeenCalledTimes(1);
      }
    });

    it('closes a server without clients: D1(F)', async () => {
      const adapter = new WsAdapter();
      const close = vi.fn((callback: () => void) => callback());
      const server = { close };

      await expect(adapter.close(server)).resolves.toBeUndefined();
      expect(close).toHaveBeenCalledTimes(1);
    });

    it('rejects when the server reports an error', async () => {
      const adapter = new WsAdapter();
      const server = {
        close: (callback: (error?: Error) => void) =>
          callback(new Error('close failed')),
      };

      await expect(adapter.close(server)).rejects.toThrow('close failed');
    });
  });

  describe('dispose (D1)', () => {
    it('closes the servers it created for ports above 0 and removes every listener', async () => {
      const httpServer = fakeHttpServer();
      const sharedServer = fakeHttpServer();
      const adapter = new WsAdapter(httpServer);
      adapter.create(0, { path: '/live' }); // D1(F): port 0 is left open
      adapter['ensureHttpServerExists'](43211, sharedServer); // D1(T)

      await adapter.dispose();

      expect(sharedServer.close).toHaveBeenCalledTimes(1);
      expect(httpServer.close).not.toHaveBeenCalled();
      expect(httpServer.listenerCount('upgrade')).toBe(0);
      expect(sharedServer.listenerCount('upgrade')).toBe(0);
      expect(adapter['httpServersRegistry'].size).toBe(0);
      expect(adapter['wsServersRegistry'].size).toBe(0);
      expect(adapter['upgradeListenersRegistry'].size).toBe(0);
    });
  });

  describe('ensureHttpServerExists (D1) and the upgrade listener (D2, D3)', () => {
    it('creates an http server and answers non-upgrade requests with 426: D1(F) then D1(T)', () => {
      const adapter = new WsAdapter();
      const server = adapter['ensureHttpServerExists'](0) as Server;

      expect(server).toBeInstanceOf(Server);

      const writeHead = vi.fn();
      const end = vi.fn();
      server.emit('request', {} as any, { writeHead, end } as any);

      expect(writeHead).toHaveBeenCalledWith(426, {
        'Content-Length': STATUS_CODES[426]!.length,
        'Content-Type': 'text/plain',
      });
      expect(end).toHaveBeenCalledWith(STATUS_CODES[426]);

      // the port is registered now, so nothing new is created
      expect(adapter['ensureHttpServerExists'](0)).toBeUndefined();
    });

    it('delegates a matching path to the ws server: D2(T), D3(F)', () => {
      const httpServer = fakeHttpServer();
      const adapter = new WsAdapter(httpServer);
      adapter['ensureHttpServerExists'](0, httpServer);
      const upgrade = vi.fn((_req, _socket, _head, callback) =>
        callback('upgraded'),
      );
      const wsServer = { path: '/live', handleUpgrade: upgrade, emit: vi.fn() };
      adapter['addWsServerToRegistry'](wsServer, 0, '/live');
      const socket = fakeSocket();

      httpServer.emit(
        'upgrade',
        { url: '/live', headers: { host: 'localhost' } },
        socket,
        Buffer.alloc(0),
      );

      expect(upgrade).toHaveBeenCalledTimes(1);
      expect(wsServer.emit).toHaveBeenCalledWith(
        'connection',
        'upgraded',
        expect.anything(),
      );
      expect(socket.destroy).not.toHaveBeenCalled();
    });

    it('destroys the socket of a request that matches no path: D2(F), D3(T)', () => {
      const httpServer = fakeHttpServer();
      const adapter = new WsAdapter(httpServer);
      adapter['ensureHttpServerExists'](0, httpServer);
      adapter['addWsServerToRegistry'](
        { path: '/live', handleUpgrade: vi.fn(), emit: vi.fn() },
        0,
        '/live',
      );
      const socket = fakeSocket();

      httpServer.emit(
        'upgrade',
        { url: '/other', headers: { host: 'localhost' } },
        socket,
        Buffer.alloc(0),
      );

      expect(socket.destroy).toHaveBeenCalledTimes(1);
    });

    it('destroys the socket when the port has no ws server at all', () => {
      const httpServer = fakeHttpServer();
      const adapter = new WsAdapter(httpServer);
      adapter['ensureHttpServerExists'](0, httpServer);
      adapter['wsServersRegistry'].set(0, []);
      const socket = fakeSocket();

      httpServer.emit(
        'upgrade',
        { url: '/live', headers: { host: 'localhost' } },
        socket,
        Buffer.alloc(0),
      );

      expect(socket.destroy).toHaveBeenCalledTimes(1);
    });

    it('closes the socket when the request URL cannot be parsed', () => {
      const httpServer = fakeHttpServer();
      const adapter = new WsAdapter(httpServer);
      adapter['ensureHttpServerExists'](0, httpServer);
      const socket = fakeSocket();

      httpServer.emit(
        'upgrade',
        { url: '/live', headers: { host: 'a b' } },
        socket,
        Buffer.alloc(0),
      );

      expect(socket.end).toHaveBeenCalledWith(
        expect.stringMatching(/^HTTP\/1\.1 400/),
      );
      expect(socket.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(socket.once).toHaveBeenCalledWith('finish', expect.any(Function));

      // a client reset raises 'error' and a half-closed socket raises 'finish'
      socket.on.mock.calls[0][1]();
      socket.once.mock.calls[0][1]();
      expect(socket.destroy).toHaveBeenCalledTimes(2);
    });
  });
});
