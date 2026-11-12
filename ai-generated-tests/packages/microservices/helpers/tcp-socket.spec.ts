import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import { InvalidJSONFormatException } from '../../../../packages/microservices/errors/invalid-json-format.exception.js';
import { NetSocketClosedException } from '../../../../packages/microservices/errors/net-socket-closed.exception.js';
import { TcpSocket } from '../../../../packages/microservices/helpers/tcp-socket.js';

/**
 * C3 decisions of TcpSocket:
 * constructor: registers listeners for 'data', 'connect', 'close', 'error';
 *   the connect/close/error listeners toggle isClosed (T/F per event).
 * sendMessage
 * D1: this.isClosed                         -> T (callback path) / F (handleSend)
 * D2: callback && callback(...)             -> T (called) / F (no callback given)
 * onData
 * D3: handleData throws (catch)             -> T (handleDataError) / F
 * handleDataError
 * D4: { destroy = false } = {}              -> destroy true / false / omitted
 * emitMessage
 * D5: JSON.parse throws (catch)             -> T (InvalidJSONFormatException) / F
 * D6: message = message || {}               -> T (falsy parsed, e.g. null) / F
 *
 * No infeasible paths: every branch is reachable with an EventEmitter-based
 * socket stub, no real net.Socket or listening port is involved.
 */

class TestTcpSocket extends TcpSocket {
  public readonly sentMessages: any[] = [];
  public readonly handledData: Array<Buffer | string> = [];
  public lastSendCallback: ((err?: any) => void) | undefined;
  public throwOnData = false;

  protected handleSend(message: any, callback?: (err?: any) => void) {
    this.sentMessages.push(message);
    this.lastSendCallback = callback;
  }

  protected handleData(data: Buffer | string) {
    if (this.throwOnData) {
      throw new Error('framing error');
    }
    this.handledData.push(data);
  }

  public emitMessagePublic(data: string) {
    this.emitMessage(data);
  }

  public handleDataErrorPublic(e: any, options?: { destroy?: boolean }) {
    this.handleDataError(e, options);
  }
}

function makeSocketStub() {
  const emitter = new EventEmitter();
  return Object.assign(emitter, {
    connect: vi.fn(),
    end: vi.fn(),
    destroy: vi.fn(),
  });
}

describe('TcpSocket constructor', () => {
  it('registers data/connect/close/error listeners on the underlying socket', () => {
    const socket = makeSocketStub();
    new TestTcpSocket(socket as any);

    expect(socket.listenerCount('data')).toBe(1);
    expect(socket.listenerCount('connect')).toBe(1);
    expect(socket.listenerCount('close')).toBe(1);
    expect(socket.listenerCount('error')).toBe(1);
  });

  it('exposes the underlying socket through netSocket', () => {
    const socket = makeSocketStub();
    const tcpSocket = new TestTcpSocket(socket as any);

    expect(tcpSocket.netSocket).toBe(socket);
  });

  it('a close event marks the socket closed; a connect event reopens it', () => {
    const socket = makeSocketStub();
    const tcpSocket = new TestTcpSocket(socket as any);
    const callback = vi.fn();

    socket.emit('close');
    tcpSocket.sendMessage({ n: 1 }, callback);
    expect(callback).toHaveBeenCalledWith(expect.any(NetSocketClosedException));
    expect(tcpSocket.sentMessages).toEqual([]);

    socket.emit('connect');
    tcpSocket.sendMessage({ n: 2 });
    expect(tcpSocket.sentMessages).toEqual([{ n: 2 }]);
  });

  it('an error event marks the socket closed', () => {
    const socket = makeSocketStub();
    const tcpSocket = new TestTcpSocket(socket as any);
    const callback = vi.fn();

    socket.emit('error', new Error('boom'));
    tcpSocket.sendMessage({ n: 1 }, callback);

    expect(callback).toHaveBeenCalledWith(expect.any(NetSocketClosedException));
  });

  it('data events are forwarded to handleData', () => {
    const socket = makeSocketStub();
    const tcpSocket = new TestTcpSocket(socket as any);
    const payload = Buffer.from('abc');

    socket.emit('data', payload);

    expect(tcpSocket.handledData).toEqual([payload]);
  });
});

describe('TcpSocket.connect', () => {
  it('delegates to socket.connect and returns this', () => {
    const socket = makeSocketStub();
    const tcpSocket = new TestTcpSocket(socket as any);

    expect(tcpSocket.connect(1234, 'localhost')).toBe(tcpSocket);
    expect(socket.connect).toHaveBeenCalledWith(1234, 'localhost');
  });
});

describe('TcpSocket.on / once / end', () => {
  it('on delegates and returns this', () => {
    const socket = makeSocketStub();
    const tcpSocket = new TestTcpSocket(socket as any);
    const listener = vi.fn();

    expect(tcpSocket.on('custom', listener)).toBe(tcpSocket);
    socket.emit('custom', 'x');
    expect(listener).toHaveBeenCalledWith('x');
  });

  it('once delegates and returns this', () => {
    const socket = makeSocketStub();
    const onceSpy = vi.spyOn(socket, 'once');
    const tcpSocket = new TestTcpSocket(socket as any);
    const listener = vi.fn();

    expect(tcpSocket.once('custom', listener)).toBe(tcpSocket);
    expect(onceSpy).toHaveBeenCalledWith('custom', listener);
  });

  it('end delegates to socket.end and returns this', () => {
    const socket = makeSocketStub();
    const tcpSocket = new TestTcpSocket(socket as any);

    expect(tcpSocket.end()).toBe(tcpSocket);
    expect(socket.end).toHaveBeenCalledOnce();
  });
});

describe('TcpSocket.sendMessage', () => {
  // D1 F
  it('D1(F) - an open socket forwards the message and callback to handleSend', () => {
    const socket = makeSocketStub();
    const tcpSocket = new TestTcpSocket(socket as any);
    const callback = vi.fn();

    tcpSocket.sendMessage({ a: 1 }, callback);

    expect(tcpSocket.sentMessages).toEqual([{ a: 1 }]);
    expect(tcpSocket.lastSendCallback).toBe(callback);
  });

  // D1 T, D2 T
  it('D1(T) D2(T) - a closed socket reports NetSocketClosedException to the callback', () => {
    const socket = makeSocketStub();
    const tcpSocket = new TestTcpSocket(socket as any);
    const callback = vi.fn();
    socket.emit('close');

    tcpSocket.sendMessage({ a: 1 }, callback);

    expect(callback).toHaveBeenCalledOnce();
    expect(callback.mock.calls[0][0]).toBeInstanceOf(NetSocketClosedException);
    expect(tcpSocket.sentMessages).toEqual([]);
  });

  // D1 T, D2 F
  it('D1(T) D2(F) - a closed socket without callback does nothing and does not throw', () => {
    const socket = makeSocketStub();
    const tcpSocket = new TestTcpSocket(socket as any);
    socket.emit('close');

    expect(() => tcpSocket.sendMessage({ a: 1 })).not.toThrow();
    expect(tcpSocket.sentMessages).toEqual([]);
  });
});

describe('TcpSocket.onData', () => {
  // D3 F
  it('D3(F) - a successful handleData does not touch the socket', () => {
    const socket = makeSocketStub();
    const tcpSocket = new TestTcpSocket(socket as any);

    socket.emit('data', 'raw');

    expect(tcpSocket.handledData).toEqual(['raw']);
    expect(socket.end).not.toHaveBeenCalled();
    expect(socket.destroy).not.toHaveBeenCalled();
  });

  // D3 T
  it('D3(T) - a thrown handleData error is surfaced and ends the socket', () => {
    const socket = makeSocketStub();
    const tcpSocket = new TestTcpSocket(socket as any);
    const errors: unknown[] = [];
    socket.on('error', (e: unknown) => errors.push(e));
    tcpSocket.throwOnData = true;

    socket.emit('data', 'raw');

    expect(errors).toEqual(['framing error']);
    expect(socket.end).toHaveBeenCalledOnce();
    expect(socket.destroy).not.toHaveBeenCalled();
  });
});

describe('TcpSocket.handleDataError', () => {
  // D4 omitted -> default false
  it('D4(omitted) - emits the error message and ends the socket', () => {
    const socket = makeSocketStub();
    const tcpSocket = new TestTcpSocket(socket as any);
    const errors: unknown[] = [];
    socket.on('error', (e: unknown) => errors.push(e));

    tcpSocket.handleDataErrorPublic(new Error('bad frame'));

    expect(errors).toEqual(['bad frame']);
    expect(socket.end).toHaveBeenCalledOnce();
    expect(socket.destroy).not.toHaveBeenCalled();
  });

  // D4 false
  it('D4(destroy=F) - ends the socket', () => {
    const socket = makeSocketStub();
    const tcpSocket = new TestTcpSocket(socket as any);

    tcpSocket.handleDataErrorPublic(new Error('bad frame'), { destroy: false });

    expect(socket.end).toHaveBeenCalledOnce();
    expect(socket.destroy).not.toHaveBeenCalled();
  });

  // D4 true
  it('D4(destroy=T) - destroys the socket instead of ending it', () => {
    const socket = makeSocketStub();
    const tcpSocket = new TestTcpSocket(socket as any);

    tcpSocket.handleDataErrorPublic(new Error('bad frame'), { destroy: true });

    expect(socket.destroy).toHaveBeenCalledOnce();
    expect(socket.end).not.toHaveBeenCalled();
  });
});

describe('TcpSocket.emitMessage', () => {
  // D5 F, D6 F
  it('D5(F) D6(F) - a JSON object is emitted on the message event', () => {
    const socket = makeSocketStub();
    const tcpSocket = new TestTcpSocket(socket as any);
    const messages: unknown[] = [];
    socket.on('message', (m: unknown) => messages.push(m));

    tcpSocket.emitMessagePublic('{"a":1}');

    expect(messages).toEqual([{ a: 1 }]);
  });

  // D6 T
  it('D6(T) - a parsed null becomes an empty object', () => {
    const socket = makeSocketStub();
    const tcpSocket = new TestTcpSocket(socket as any);
    const messages: unknown[] = [];
    socket.on('message', (m: unknown) => messages.push(m));

    tcpSocket.emitMessagePublic('null');

    expect(messages).toEqual([{}]);
  });

  // D5 T
  it('D5(T) - invalid JSON throws InvalidJSONFormatException', () => {
    const socket = makeSocketStub();
    const tcpSocket = new TestTcpSocket(socket as any);

    expect(() => tcpSocket.emitMessagePublic('{oops')).toThrow(
      InvalidJSONFormatException,
    );
  });
});
