import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CorruptedPacketLengthException } from '../../../../packages/microservices/errors/corrupted-packet-length.exception.js';
import { DrainTimeoutException } from '../../../../packages/microservices/errors/drain-timeout.exception.js';
import { IncompleteMessageTimeoutException } from '../../../../packages/microservices/errors/incomplete-message-timeout.exception.js';
import { MaxPacketLengthExceededException } from '../../../../packages/microservices/errors/max-packet-length-exceeded.exception.js';
import { MaxSendBufferSizeExceededException } from '../../../../packages/microservices/errors/max-send-buffer-size-exceeded.exception.js';
import { MessageReceiveTimeoutException } from '../../../../packages/microservices/errors/message-receive-timeout.exception.js';
import { JsonSocket } from '../../../../packages/microservices/helpers/json-socket.js';

/**
 * C3 decisions of JsonSocket:
 * constructor
 * D1: options?.x ?? DEFAULT for maxBufferSize/incompleteMessageTimeout/
 *     messageReceiveTimeout/maxSendBufferSize/drainTimeout -> T (configured) / F (default)
 * D2: options?.pauseOnBackpressure ?? true -> T / F
 * handleSend
 * D3: flushed === false && pauseOnBackpressure -> 3c1 T/F, 3c2 T/F
 * assertSendBufferWithinLimit
 * D4: !maxSendBufferSize || !(bufferedBytes > maxSendBufferSize)
 *     4c1 !maxSendBufferSize          -> T (disabled) / F
 *     4c2 !(bufferedBytes > max)      -> T (within limit) / F (over limit)
 * processBuffer
 * D5: isBackpressured                 -> T (break) / F
 * D6: buffer.length > maxBufferSize   -> T (throw) / F
 * D7: contentLength === null          -> T / F
 * D8: i === -1                        -> T (no delimiter) / F
 * D9: buffer.length > MAX_CONTENT_LENGTH_SIZE (32) -> T (corrupted) / F (wait)
 * D10: isNaN(contentLength) || contentLength < 0
 *      10c1 isNaN -> T / F ; 10c2 < 0 -> T / F
 * D11: contentLength > maxBufferSize  -> T (destroy) / F
 * D12: contentLength !== null         -> only T is reachable (see infeasible note)
 * D13: length === contentLength       -> T / F
 * D14: length > contentLength         -> T (loop continue) / F (incomplete, break)
 * handleData bonus
 * D15: Buffer.isBuffer(dataRaw)       -> T / F
 * applyBackpressure
 * D16: isBackpressured                -> T (re-entrant no-op) / F
 * releaseBackpressure
 * D17: messageReceiveDeadline !== null && backpressuredAt !== null -> 17c1 T/F, 17c2 T/F
 * armDrainTimer / clearDrainTimer
 * D18: !drainTimeout                  -> T (disabled) / F
 * D19: !drainTimer                    -> T (nothing to clear) / F
 * handleDrainTimeout
 * D20: getDrainedLength() > drainedLength -> T (re-arm) / F (destroy)
 * refreshIncompleteMessageTimer
 * D21: hasIncompleteMessage = buffer.length > 0 || contentLength !== null
 *      21c1 buffer.length > 0 -> T / F ; 21c2 contentLength !== null -> T / F
 * D22: !hasIncompleteMessage          -> T / F
 * D23: isBackpressured                -> T / F
 * D24: messageReceiveTimeout && messageReceiveDeadline === null
 *      24c1 timeout truthy -> T / F ; 24c2 deadline null -> T / F
 * D25: messageReceiveTimeout || Infinity (idleTimeout)  -> T / F
 * D26: messageReceiveDeadline === null ? Infinity : ... -> T / F
 * D27: idleTimeout === Infinity && remainingTime === Infinity
 *      27c1 T/F ; 27c2 T/F
 * D28: remainingTime <= idleTimeout   -> T (deadline timer) / F (idle timer)
 * clearIncompleteMessageTimer
 * D29: !incompleteMessageTimer        -> T (nothing) / F (cleared)
 *
 * Infeasible path:
 * D12 false cannot be reached: after the `contentLength === null` block either
 * the loop breaks (no delimiter / incomplete) or contentLength was just set, so
 * at the D12 check it is always non-null. It is a defensive re-check.
 */

function makeSocketStub() {
  const emitter = new EventEmitter();
  return Object.assign(emitter, {
    write: vi.fn(() => true),
    end: vi.fn(),
    connect: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    destroy: vi.fn(),
    writableLength: 0,
  });
}

function frame(value: unknown): string {
  const json = JSON.stringify(value);
  return `${json.length}#${json}`;
}

describe('JsonSocket', () => {
  let socket: any;
  let jsonSocket: JsonSocket;
  let messages: unknown[];
  let internals: any;

  beforeEach(() => {
    vi.useFakeTimers();
    socket = makeSocketStub();
    jsonSocket = new JsonSocket(socket);
    internals = jsonSocket as any;
    messages = [];
    socket.on('message', (message: unknown) => messages.push(message));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('constructor', () => {
    it('D1(F) - defaults are applied when no options are given', () => {
      expect(internals.maxBufferSize).toBe(128 * 1024 * 1024);
      expect(internals.incompleteMessageTimeout).toBe(30_000);
      expect(internals.messageReceiveTimeout).toBe(300_000);
      expect(internals.maxSendBufferSize).toBe(128 * 1024 * 1024);
      expect(internals.drainTimeout).toBe(30_000);
      expect(internals.pauseOnBackpressure).toBe(true);
    });

    it('D1(T) D2(T) - configured values replace every default', () => {
      const configured = new JsonSocket(makeSocketStub(), {
        maxBufferSize: 1,
        incompleteMessageTimeout: 2,
        messageReceiveTimeout: 3,
        maxSendBufferSize: 4,
        drainTimeout: 5,
        pauseOnBackpressure: true,
      }) as any;

      expect(configured.maxBufferSize).toBe(1);
      expect(configured.incompleteMessageTimeout).toBe(2);
      expect(configured.messageReceiveTimeout).toBe(3);
      expect(configured.maxSendBufferSize).toBe(4);
      expect(configured.drainTimeout).toBe(5);
      expect(configured.pauseOnBackpressure).toBe(true);
    });

    it('D2(F) - pauseOnBackpressure can be turned off', () => {
      const configured = new JsonSocket(makeSocketStub(), {
        pauseOnBackpressure: false,
      }) as any;

      expect(configured.pauseOnBackpressure).toBe(false);
    });

    it('a close event clears both timers', () => {
      internals.handleData('100#partial');
      expect(internals.incompleteMessageTimer).not.toBeNull();
      socket.emit('close');
      expect(internals.incompleteMessageTimer).toBeNull();

      socket.emit('connect');
      socket.write.mockReturnValue(false);
      jsonSocket.sendMessage({ n: 1 });
      expect(internals.drainTimer).not.toBeNull();

      socket.emit('close');

      expect(internals.incompleteMessageTimer).toBeNull();
      expect(internals.drainTimer).toBeNull();
    });
  });

  describe('handleSend', () => {
    it('writes the framed message as utf-8 and forwards the callback', () => {
      const callback = vi.fn();

      jsonSocket.sendMessage({ a: 1 }, callback);

      expect(socket.write).toHaveBeenCalledWith(
        frame({ a: 1 }),
        'utf-8',
        callback,
      );
      expect(internals.writtenLength).toBe(frame({ a: 1 }).length);
    });

    // D3 c1(F)
    it('D3 c1(F) - a flushed write does not pause reading', () => {
      socket.write.mockReturnValue(true);

      jsonSocket.sendMessage({ a: 1 });

      expect(socket.pause).not.toHaveBeenCalled();
      expect(internals.isBackpressured).toBe(false);
    });

    // D3 c1(T) c2(T)
    it('D3 c1(T) c2(T) - an unflushed write pauses reading and arms the drain timer', () => {
      const onceSpy = vi.spyOn(socket, 'once');
      socket.write.mockReturnValue(false);

      jsonSocket.sendMessage({ a: 1 });

      expect(socket.pause).toHaveBeenCalledOnce();
      expect(internals.isBackpressured).toBe(true);
      expect(internals.drainTimer).not.toBeNull();
      expect(onceSpy).toHaveBeenCalledWith('drain', expect.any(Function));
    });

    // D3 c1(T) c2(F)
    it('D3 c2(F) - an unflushed write does not pause when pauseOnBackpressure is false', () => {
      const off = new JsonSocket(socket, { pauseOnBackpressure: false }) as any;
      socket.write.mockReturnValue(false);

      off.handleSend({ a: 1 });

      expect(socket.pause).not.toHaveBeenCalled();
      expect(off.isBackpressured).toBe(false);
    });

    // D4 c1(T)
    it('D4 c1(T) - maxSendBufferSize 0 disables the limit', () => {
      socket.write.mockImplementation((data: string) => {
        socket.writableLength = 10_000;
        void data;
        return false;
      });
      const limited = new JsonSocket(socket, { maxSendBufferSize: 0 });

      limited.sendMessage({ a: 1 });

      expect(socket.destroy).not.toHaveBeenCalled();
    });

    // D4 c1(F) c2(T)
    it('D4 c2(T) - a buffered size within the limit is left alone', () => {
      socket.write.mockImplementation(() => {
        socket.writableLength = 512;
        return false;
      });
      const limited = new JsonSocket(socket, { maxSendBufferSize: 1024 });

      limited.sendMessage({ a: 1 });

      expect(socket.destroy).not.toHaveBeenCalled();
    });

    // D4 c1(F) c2(F)
    it('D4 c2(F) - exceeding maxSendBufferSize destroys the socket and reports it', () => {
      const errors: unknown[] = [];
      socket.on('error', (error: unknown) => errors.push(error));
      socket.write.mockImplementation(() => {
        socket.writableLength = 2048;
        return false;
      });
      const limited = new JsonSocket(socket, { maxSendBufferSize: 1024 });

      limited.sendMessage({ a: 1 });

      expect(socket.destroy).toHaveBeenCalledOnce();
      expect(errors).toEqual([
        new MaxSendBufferSizeExceededException(2048, 1024).message,
      ]);
    });
  });

  describe('handleData', () => {
    // D15 T
    it('D15(T) - Buffer input goes through the StringDecoder', () => {
      const payload = frame({ n: 1 });

      internals.handleData(Buffer.from(payload));

      expect(messages).toEqual([{ n: 1 }]);
    });

    // D15 F
    it('D15(F) - string input is appended as is', () => {
      internals.handleData(frame({ n: 2 }));

      expect(messages).toEqual([{ n: 2 }]);
    });

    it('refreshes the incomplete-message timer even when processing throws', () => {
      expect(() => internals.handleData('bad#')).toThrow(
        CorruptedPacketLengthException,
      );

      expect(internals.buffer).toBe('');
      expect(internals.contentLength).toBeNull();
      expect(internals.messageReceiveDeadline).toBeNull();
      expect(internals.incompleteMessageTimer).toBeNull();
    });
  });

  describe('processBuffer', () => {
    // D7(T) D8(F) D10 c1(F) D12(T) D13(T)
    it('D13(T) - a frame whose length matches is emitted', () => {
      internals.handleData(frame({ hello: 'world' }));

      expect(messages).toEqual([{ hello: 'world' }]);
      expect(internals.contentLength).toBeNull();
      expect(internals.buffer).toBe('');
    });

    // D13(F) D14(T)
    it('D14(T) - extra frames in the same chunk are processed by the loop', () => {
      internals.handleData(frame({ a: 1 }) + frame({ b: 2 }));

      expect(messages).toEqual([{ a: 1 }, { b: 2 }]);
    });

    // D13(F) D14(F)
    it('D14(F) - an incomplete frame is buffered for the next read', () => {
      const full = frame({ a: 1 });

      internals.handleData(full.slice(0, 4));
      expect(messages).toEqual([]);
      expect(internals.contentLength).not.toBeNull();

      internals.handleData(full.slice(4));
      expect(messages).toEqual([{ a: 1 }]);
    });

    // D7(F) covering the already-known length branch, then D14(F)
    it('D7(F) - a known content length is not re-parsed on later reads', () => {
      internals.handleData('5#123');
      expect(messages).toEqual([]);
      expect(internals.contentLength).toBe(5);

      internals.handleData('45');

      expect(messages).toEqual([12345]);
    });

    // D8(T) D9(F)
    it('D8(T) D9(F) - a short buffer without a delimiter waits for more data', () => {
      internals.handleData('10');

      expect(internals.buffer).toBe('10');
      expect(messages).toEqual([]);
    });

    // D8(T) D9(T)
    it('D9(T) - more than 32 chars without a delimiter is a corrupted length', () => {
      expect(() => internals.handleData('1'.repeat(33))).toThrow(
        CorruptedPacketLengthException,
      );
      expect(internals.buffer).toBe('');
    });

    // D10 c1(T)
    it('D10 c1(T) - a non-numeric length is corrupted', () => {
      expect(() => internals.handleData('abc#{}')).toThrow(
        CorruptedPacketLengthException,
      );
      expect(internals.buffer).toBe('');
    });

    // D10 c1(F) c2(T)
    it('D10 c2(T) - a negative length is corrupted', () => {
      expect(() => internals.handleData('-1#{}')).toThrow(
        new CorruptedPacketLengthException('-1'),
      );
      expect(internals.contentLength).toBeNull();
    });

    // D11(T)
    it('D11(T) - declaring more than maxBufferSize destroys the peer without buffering it', () => {
      const errors: unknown[] = [];
      socket.on('error', (error: unknown) => errors.push(error));
      const tiny = new JsonSocket(socket, { maxBufferSize: 10 }) as any;

      tiny.handleData('11#{"a"');

      expect(socket.destroy).toHaveBeenCalledOnce();
      expect(errors).toEqual([
        new MaxPacketLengthExceededException(11).message,
      ]);
      expect(tiny.buffer).toBe('');
      expect(tiny.contentLength).toBeNull();
    });

    // D6(T)
    it('D6(T) - a buffer above maxBufferSize is rejected', () => {
      const tiny = new JsonSocket(socket, { maxBufferSize: 10 });

      expect(() => (tiny as any).handleData('12345678901')).toThrow(
        MaxPacketLengthExceededException,
      );
    });

    // D6(F) at the boundary
    it('D6(F) - a packet declaring exactly maxBufferSize is accepted', () => {
      const json = JSON.stringify({ a: 'xxxx' });
      const tiny = new JsonSocket(socket, {
        maxBufferSize: json.length,
      }) as any;

      tiny.handleData(`${json.length}#`);
      tiny.handleData(json);

      expect(messages).toEqual([{ a: 'xxxx' }]);
    });

    // D5(T)
    it('D5(T) - a backpressured socket stops turning frames into messages', () => {
      socket.write.mockReturnValue(false);
      jsonSocket.sendMessage({ response: 1 });
      expect(internals.isBackpressured).toBe(true);

      expect(() => internals.handleData('bad#')).not.toThrow();
      expect(internals.buffer).toBe('bad#');
      expect(messages).toEqual([]);
    });
  });

  describe('backpressure', () => {
    // D16(F) then D16(T)
    it('D16(T) - applying backpressure twice only pauses once', () => {
      socket.write.mockReturnValue(false);

      jsonSocket.sendMessage({ n: 1 });
      jsonSocket.sendMessage({ n: 2 });

      expect(socket.pause).toHaveBeenCalledOnce();
    });

    // D19(F) via drain
    it('a drain event resumes reading and clears the drain timer', () => {
      socket.write.mockReturnValue(false);
      jsonSocket.sendMessage({ n: 1 });

      socket.emit('drain');

      expect(socket.resume).toHaveBeenCalled();
      expect(internals.isBackpressured).toBe(false);
      expect(internals.drainTimer).toBeNull();
    });

    it('frames buffered while backpressured are processed after the drain', () => {
      socket.write.mockReturnValue(false);
      jsonSocket.sendMessage({ response: 1 });
      internals.handleData(frame({ n: 1 }) + frame({ n: 2 }));
      expect(messages).toEqual([]);

      socket.write.mockReturnValue(true);
      socket.emit('drain');

      expect(messages).toEqual([{ n: 1 }, { n: 2 }]);
    });

    // D17 c1(T) c2(T)
    it('D17 c1(T) c2(T) - the receive deadline is extended by the paused time', () => {
      const socketLevel = makeSocketStub();
      const js = new JsonSocket(socketLevel, {
        incompleteMessageTimeout: 0,
        messageReceiveTimeout: 1000,
        drainTimeout: 0,
      }) as any;
      js.handleData('100#partial');
      const deadlineBefore = js.messageReceiveDeadline;
      expect(deadlineBefore).not.toBeNull();

      vi.advanceTimersByTime(400);
      socketLevel.write.mockReturnValue(false);
      js.handleSend({ n: 1 });
      vi.advanceTimersByTime(500);
      socketLevel.emit('drain');

      expect(js.messageReceiveDeadline).toBe(deadlineBefore + 500);
    });

    // D17 c1(F)
    it('D17 c1(F) - no receive deadline means nothing is extended', () => {
      socket.write.mockReturnValue(false);
      jsonSocket.sendMessage({ n: 1 });
      vi.advanceTimersByTime(1000);

      socket.emit('drain');

      expect(internals.messageReceiveDeadline).toBeNull();
    });

    // D17 c1(T) c2(F) - reachable only by clearing backpressuredAt directly
    it('D17 c2(F) - a null backpressuredAt leaves the deadline untouched', () => {
      internals.contentLength = 5;
      internals.buffer = '';
      internals.backpressuredAt = null;
      internals.messageReceiveDeadline = 12345;

      internals.releaseBackpressure();

      expect(internals.messageReceiveDeadline).toBe(12345);
      expect(socket.resume).toHaveBeenCalled();
    });
  });

  describe('refreshIncompleteMessageTimer', () => {
    // D21 c1(F) c2(F), D22(T)
    it('D22(T) - a complete buffer resets the receive deadline and arms nothing', () => {
      internals.handleData(frame({ n: 1 }));

      expect(internals.messageReceiveDeadline).toBeNull();
      expect(internals.incompleteMessageTimer).toBeNull();

      vi.advanceTimersByTime(10_000);
      expect(socket.destroy).not.toHaveBeenCalled();
    });

    // D21 c1(T), D22(F), D24 c1(T) c2(T), D28(F)
    it('D21 c1(T) - buffered data arms the idle timer', () => {
      internals.handleData('10');

      expect(internals.incompleteMessageTimer).not.toBeNull();
      expect(internals.messageReceiveDeadline).not.toBeNull();
    });

    // D21 c1(F) c2(T)
    it('D21 c2(T) - a known content length with an empty buffer is still incomplete', () => {
      internals.handleData('5#');

      expect(internals.buffer).toBe('');
      expect(internals.contentLength).toBe(5);
      expect(internals.incompleteMessageTimer).not.toBeNull();
    });

    // D24 c1(T) c2(F)
    it('D24 c2(F) - the receive deadline is set only once per packet', () => {
      internals.handleData('100#');
      const deadline = internals.messageReceiveDeadline;

      vi.advanceTimersByTime(100);
      internals.handleData('a');

      expect(internals.messageReceiveDeadline).toBe(deadline);
    });

    // D24 c1(F), D25(F) -> idle only timer
    it('D24 c1(F) - messageReceiveTimeout 0 disables the deadline', () => {
      const js = new JsonSocket(socket, {
        incompleteMessageTimeout: 1000,
        messageReceiveTimeout: 0,
      }) as any;

      js.handleData('100#partial');

      expect(js.messageReceiveDeadline).toBeNull();
      expect(js.incompleteMessageTimer).not.toBeNull();
    });

    // D25(T), D26(T), D27 c1(T) c2(T)
    it('D27 c1(T) c2(T) - both timeouts disabled means no timer at all', () => {
      const js = new JsonSocket(socket, {
        incompleteMessageTimeout: 0,
        messageReceiveTimeout: 0,
      }) as any;

      js.handleData('100#partial');

      expect(js.incompleteMessageTimer).toBeNull();
      vi.advanceTimersByTime(60_000);
      expect(socket.destroy).not.toHaveBeenCalled();
    });

    // D27 c1(T) c2(F), D28(T)
    it('D27 c2(F) - idle disabled but a receive deadline set arms the deadline timer', () => {
      const errors: unknown[] = [];
      socket.on('error', (error: unknown) => errors.push(error));
      const js = new JsonSocket(socket, {
        incompleteMessageTimeout: 0,
        messageReceiveTimeout: 1000,
      }) as any;

      js.handleData('100#partial');
      vi.advanceTimersByTime(1000);

      expect(socket.destroy).toHaveBeenCalledOnce();
      expect(errors).toEqual([
        new MessageReceiveTimeoutException(7, 1000).message,
      ]);
    });

    // D23(T)
    it('D23(T) - no incomplete-message timer is armed while backpressured', () => {
      socket.write.mockReturnValue(false);
      jsonSocket.sendMessage({ n: 1 });

      internals.handleData('100#partial');

      expect(internals.incompleteMessageTimer).toBeNull();
      expect(internals.messageReceiveDeadline).toBeNull();
    });

    // D28(T) - deadline fires before the idle timeout
    it('D28(T) - the earlier receive deadline fires first', () => {
      const errors: unknown[] = [];
      socket.on('error', (error: unknown) => errors.push(error));
      const js = new JsonSocket(socket, {
        incompleteMessageTimeout: 5000,
        messageReceiveTimeout: 1000,
      });

      (js as any).handleData('100#partial');
      vi.advanceTimersByTime(999);
      expect(socket.destroy).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1);

      expect(socket.destroy).toHaveBeenCalledOnce();
      expect(errors).toEqual([
        new MessageReceiveTimeoutException(7, 1000).message,
      ]);
    });

    // D28(F) - idle timeout fires before the receive deadline
    it('D28(F) - the earlier idle timeout fires first', () => {
      const errors: unknown[] = [];
      socket.on('error', (error: unknown) => errors.push(error));
      const js = new JsonSocket(socket, {
        incompleteMessageTimeout: 500,
        messageReceiveTimeout: 5000,
      });

      (js as any).handleData('100#partial');
      vi.advanceTimersByTime(499);
      expect(socket.destroy).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1);

      expect(socket.destroy).toHaveBeenCalledOnce();
      expect(errors).toEqual([
        new IncompleteMessageTimeoutException(7, 500).message,
      ]);
    });

    it('each read re-arms the idle timer of a progressing peer', () => {
      const js = new JsonSocket(socket, {
        incompleteMessageTimeout: 1000,
        messageReceiveTimeout: 0,
      }) as any;
      js.handleData('12#');

      for (let i = 0; i < 5; i++) {
        vi.advanceTimersByTime(900);
        js.handleData('ab');
      }

      expect(socket.destroy).not.toHaveBeenCalled();
      expect(js.buffer).toBe('ababababab');
    });
  });

  describe('drain timer', () => {
    function makeUnreadSocket() {
      const unread = makeSocketStub();
      unread.write.mockImplementation((data: string) => {
        unread.writableLength += data.length;
        return false;
      });
      return unread;
    }

    // D18(F), D20(F)
    it('D20(F) - a peer that reads nothing is dropped after drainTimeout', () => {
      const unread = makeUnreadSocket();
      const errors: unknown[] = [];
      unread.on('error', (error: unknown) => errors.push(error));
      const js = new JsonSocket(unread, { drainTimeout: 1000 });

      js.sendMessage({ some: 'payload' });
      vi.advanceTimersByTime(999);
      expect(unread.destroy).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1);

      const bufferedLength = frame({ some: 'payload' }).length;
      expect(unread.destroy).toHaveBeenCalledOnce();
      expect(errors).toEqual([
        new DrainTimeoutException(bufferedLength, 1000).message,
      ]);
    });

    // D20(T)
    it('D20(T) - a slowly reading peer is given more time and re-armed', () => {
      const unread = makeUnreadSocket();
      const js = new JsonSocket(unread, { drainTimeout: 1000 });

      js.sendMessage({ n: 1 });
      const total = (js as any).writtenLength;
      unread.writableLength -= total / 2;
      vi.advanceTimersByTime(1000);
      expect(unread.destroy).not.toHaveBeenCalled();
      expect((js as any).drainTimer).not.toBeNull();

      unread.writableLength = 0;
      vi.advanceTimersByTime(1000);
      expect(unread.destroy).not.toHaveBeenCalled();

      // Nothing else is written out: the re-armed timer finally drops the peer.
      vi.advanceTimersByTime(1000);
      expect(unread.destroy).toHaveBeenCalledOnce();
    });

    // D18(T)
    it('D18(T) - drainTimeout 0 disables the drain timer', () => {
      const unread = makeUnreadSocket();
      const js = new JsonSocket(unread, { drainTimeout: 0 }) as any;

      js.handleSend({ n: 1 });

      expect(js.drainTimer).toBeNull();
      vi.advanceTimersByTime(60_000);
      expect(unread.destroy).not.toHaveBeenCalled();
    });

    // D18(F) default + D19(F) via close
    it('a close event disarms a pending drain timer', () => {
      const unread = makeUnreadSocket();
      const js = new JsonSocket(unread, { drainTimeout: 1000 });

      js.sendMessage({ n: 1 });
      expect((js as any).drainTimer).not.toBeNull();

      unread.emit('close');
      vi.advanceTimersByTime(10_000);

      expect(unread.destroy).not.toHaveBeenCalled();
    });

    // D19(T) - nothing to clear
    it('D19(T) - closing without timers is a no-op', () => {
      expect(() => socket.emit('close')).not.toThrow();
      expect(internals.drainTimer).toBeNull();
      expect(internals.incompleteMessageTimer).toBeNull();
    });
  });
});
