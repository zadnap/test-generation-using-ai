import { EventEmitter } from 'events';
import { firstValueFrom } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { ClientProxy } from '../../../../packages/microservices/client/client-proxy.js';
import { IncomingResponseDeserializer } from '../../../../packages/microservices/deserializers/incoming-response.deserializer.js';
import { InvalidMessageException } from '../../../../packages/microservices/errors/invalid-message.exception.js';
import type {
  ReadPacket,
  WritePacket,
} from '../../../../packages/microservices/interfaces/index.js';
import { IdentitySerializer } from '../../../../packages/microservices/serializers/identity.serializer.js';

class TestClientProxy extends ClientProxy {
  public readonly connectMock = vi.fn(async () => undefined);
  public readonly closeMock = vi.fn();

  public connect() {
    return this.connectMock();
  }

  public close() {
    this.closeMock();
  }

  public unwrap<T>(): T {
    return undefined as T;
  }

  public publish(
    _packet: ReadPacket,
    _callback: (packet: WritePacket) => void,
  ): () => void {
    return () => {};
  }

  public dispatchEvent<T = any>(_packet: ReadPacket): Promise<T> {
    return Promise.resolve(undefined as T);
  }

  public pushStatus(status: string) {
    this._status$.next(status as any);
  }

  public makePacket(pattern: any, data: any) {
    return this.createPacket(pattern, data);
  }
}

const createObserverSpies = () => ({
  next: vi.fn(),
  error: vi.fn(),
  complete: vi.fn(),
});

/**
 * `send` decisions:
 *   D1 `isNil(pattern) || isNil(data)` -> invalid-message observable.
 *      Atoms: pattern nil T/F, data nil T/F (short-circuit: data is only
 *      evaluated when pattern is not nil).
 *   D2 defer(connect) rejects -> observable error; resolves -> mergeMap publish.
 * `emit` uses the same D1 plus connectable setup, so both outcomes of D1 and
 * of connect (resolve/reject) are exercised too.
 */
describe('ClientProxy.send', () => {
  it('errors with InvalidMessageException when the pattern is nil (D1 pattern true)', async () => {
    const client = new TestClientProxy();

    await expect(
      firstValueFrom(client.send(null, 'data')),
    ).rejects.toBeInstanceOf(InvalidMessageException);
    expect(client.connectMock).not.toHaveBeenCalled();
  });

  it('errors with InvalidMessageException when the data is nil (D1 data true)', async () => {
    const client = new TestClientProxy();

    await expect(
      firstValueFrom(client.send('pattern', undefined)),
    ).rejects.toBeInstanceOf(InvalidMessageException);
    expect(client.connectMock).not.toHaveBeenCalled();
  });

  it('connects and publishes an identified packet for a valid request (D1 false, D2 resolve)', async () => {
    const client = new TestClientProxy();
    const publish = vi.fn(() => () => {});
    client.publish = publish;

    const subscription = client.send('pattern', 'data').subscribe();
    await vi.waitFor(() => expect(publish).toHaveBeenCalledTimes(1));
    subscription.unsubscribe();

    expect(client.connectMock).toHaveBeenCalledTimes(1);
    expect(publish.mock.calls[0][0]).toEqual({
      pattern: 'pattern',
      data: 'data',
    });
    expect(typeof publish.mock.calls[0][1]).toBe('function');
  });

  it('propagates a rejected connection as an observable error (D2 reject)', async () => {
    const client = new TestClientProxy();
    const error = new Error('connect failed');
    client.connectMock.mockRejectedValueOnce(error);

    await expect(firstValueFrom(client.send('pattern', 'data'))).rejects.toBe(
      error,
    );
  });
});

/**
 * `emit` decisions:
 *   D1 `isNil(pattern) || isNil(data)` (pattern T, data T, both F).
 *   D2 connect rejects -> stream errors; resolves -> dispatchEvent runs.
 * The connectable source is connected eagerly on the call itself.
 */
describe('ClientProxy.emit', () => {
  it('errors with InvalidMessageException when the pattern is nil (D1 pattern true)', async () => {
    const client = new TestClientProxy();

    await expect(
      firstValueFrom(client.emit(undefined, 'data')),
    ).rejects.toBeInstanceOf(InvalidMessageException);
    expect(client.connectMock).not.toHaveBeenCalled();
  });

  it('errors with InvalidMessageException when the data is nil (D1 data true)', async () => {
    const client = new TestClientProxy();

    await expect(
      firstValueFrom(client.emit('pattern', null)),
    ).rejects.toBeInstanceOf(InvalidMessageException);
    expect(client.connectMock).not.toHaveBeenCalled();
  });

  it('connects immediately when the event is valid (D1 false)', () => {
    const client = new TestClientProxy();
    client.dispatchEvent = vi.fn(async () => 'ok');

    const stream$ = client.emit('pattern', 'data');

    expect(client.connectMock).toHaveBeenCalledTimes(1);
    stream$.subscribe().unsubscribe();
  });

  it('dispatches the event once connected (D2 resolve)', async () => {
    const client = new TestClientProxy();
    const dispatchEvent = vi.fn(async () => 'dispatched');
    client.dispatchEvent = dispatchEvent;

    await expect(
      firstValueFrom(client.emit('pattern', 'data'), { defaultValue: null }),
    ).resolves.toBe('dispatched');
    expect(dispatchEvent).toHaveBeenCalledWith({
      pattern: 'pattern',
      data: 'data',
    });
  });

  it('propagates a rejected connection as a stream error (D2 reject)', async () => {
    const client = new TestClientProxy();
    const error = new Error('connect failed');
    client.connectMock.mockRejectedValueOnce(error);

    await expect(
      firstValueFrom(client.emit('pattern', 'data'), { defaultValue: null }),
    ).rejects.toBe(error);
  });
});

/**
 * `setOnDispatchHook` / `createPacket` decisions:
 *   D1 hook registered? true -> invoked with the packet, false -> packet is
 *   returned untouched. Both `send` and `emit` go through `createPacket`.
 */
describe('ClientProxy.setOnDispatchHook + createPacket', () => {
  it('invokes the registered hook with the outgoing packet (D1 true)', async () => {
    const client = new TestClientProxy();
    const hook = vi.fn((packet: ReadPacket) => {
      packet.metadata = { traceId: 'trace-1' };
    });
    client.setOnDispatchHook(hook);

    const packet = client.makePacket('pattern', 'data');

    expect(hook).toHaveBeenCalledWith(packet);
    expect(packet).toEqual({
      pattern: 'pattern',
      data: 'data',
      metadata: { traceId: 'trace-1' },
    });
  });

  it('returns the packet unchanged when no hook is registered (D1 false)', () => {
    const client = new TestClientProxy();

    expect(client.makePacket('pattern', 'data')).toEqual({
      pattern: 'pattern',
      data: 'data',
    });
  });

  it('applies the hook to a request packet', async () => {
    const client = new TestClientProxy();
    const publish = vi.fn(() => () => {});
    client.publish = publish;
    client.setOnDispatchHook(packet => {
      packet.metadata = { traceId: 'trace-2' };
    });

    client.send('pattern', 'data').subscribe();
    await vi.waitFor(() => expect(publish).toHaveBeenCalled());

    expect(publish.mock.calls[0][0]).toMatchObject({
      metadata: { traceId: 'trace-2' },
    });
  });

  it('applies the hook to an event packet', async () => {
    const client = new TestClientProxy();
    const dispatchEvent = vi.fn(async () => undefined);
    client.dispatchEvent = dispatchEvent;
    client.setOnDispatchHook(packet => {
      packet.metadata = { traceId: 'trace-3' };
    });

    await firstValueFrom(client.emit('pattern', 'data'), {
      defaultValue: null,
    });

    expect(dispatchEvent).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: { traceId: 'trace-3' } }),
    );
  });
});

/**
 * `createObserver` decision table:
 *   D1 `err` truthy? -> observer.error(serializeError(err)).
 *   D2 `response !== undefined`? -> when combined with D3.
 *   D3 `isDisposed` truthy? -> complete (with next first only if D2 true);
 *      D3 false -> next(serializeResponse(response)) without completing.
 * All four combinations of D2/D3 and both D1 outcomes are feasible.
 */
describe('ClientProxy.createObserver', () => {
  it.each([
    ['error', { err: 'boom' }, { error: 1, next: 0, complete: 0 }],
    [
      'response + disposed',
      { response: 'res', isDisposed: true },
      { error: 0, next: 1, complete: 1 },
    ],
    ['disposed only', { isDisposed: true }, { error: 0, next: 0, complete: 1 }],
    ['response only', { response: 'res' }, { error: 0, next: 1, complete: 0 }],
    ['neither', {}, { error: 0, next: 1, complete: 0 }],
  ] as Array<
    [string, WritePacket, { error: number; next: number; complete: number }]
  >)('handles the %s branch', (_name, packet, expected) => {
    const client = new TestClientProxy();
    const spies = createObserverSpies();
    const notify = client['createObserver'](spies as any);

    notify(packet);

    expect(spies.error).toHaveBeenCalledTimes(expected.error);
    expect(spies.next).toHaveBeenCalledTimes(expected.next);
    expect(spies.complete).toHaveBeenCalledTimes(expected.complete);
    if (expected.error) {
      expect(spies.error).toHaveBeenCalledWith(packet.err);
    }
    if (expected.next) {
      expect(spies.next).toHaveBeenCalledWith(packet.response);
    }
  });

  it('runs error before the disposed branches even when response and isDisposed are set (D1 short-circuit)', () => {
    const client = new TestClientProxy();
    const spies = createObserverSpies();
    const notify = client['createObserver'](spies as any);

    notify({ err: 'boom', response: 'res', isDisposed: true });

    expect(spies.error).toHaveBeenCalledWith('boom');
    expect(spies.next).not.toHaveBeenCalled();
    expect(spies.complete).not.toHaveBeenCalled();
  });
});

/**
 * `connect$` decisions:
 *   D1 the instance emits `error` -> map throws (observable error) versus the
 *   instance emits `connect` -> value emitted and stream completes (take(1)).
 * Both event names default, so custom names are checked as well.
 */
describe('ClientProxy.connect$', () => {
  it('errors when the instance emits an error event (D1 error branch)', () => {
    const client = new TestClientProxy();
    const emitter = new EventEmitter();
    const error = new Error('socket error');
    const errorSpy = vi.fn();

    client['connect$'](emitter).subscribe({ error: errorSpy });
    emitter.emit('error', error);

    expect(errorSpy).toHaveBeenCalledWith(error);
    expect(emitter.listenerCount('error')).toBe(0);
    expect(emitter.listenerCount('connect')).toBe(0);
  });

  it('emits and completes on the connect event (D1 connect branch)', () => {
    const client = new TestClientProxy();
    const emitter = new EventEmitter();
    const next = vi.fn();
    const complete = vi.fn();

    client['connect$'](emitter).subscribe({ next, complete });
    emitter.emit('connect');

    expect(next).toHaveBeenCalledTimes(1);
    expect(complete).toHaveBeenCalledTimes(1);
    expect(emitter.listenerCount('error')).toBe(0);
    expect(emitter.listenerCount('connect')).toBe(0);
  });

  it('honours custom event names', () => {
    const client = new TestClientProxy();
    const emitter = new EventEmitter();
    const next = vi.fn();
    const error = vi.fn();
    const failure = new Error('nope');

    client['connect$'](emitter, 'failure', 'ready').subscribe({ next, error });
    emitter.emit('failure', failure);

    expect(error).toHaveBeenCalledWith(failure);
    expect(next).not.toHaveBeenCalled();
  });
});

/**
 * `getOptionsProp` decisions:
 *   D1 `obj` truthy? (false -> defaultValue)
 *   D2 `prop in obj`? (true -> obj[prop], false -> defaultValue)
 * Both `defaultValue` values (provided and omitted -> undefined) are covered.
 */
describe('ClientProxy.getOptionsProp', () => {
  const client = new TestClientProxy();
  const get = (obj: any, prop: any, defaultValue?: any) =>
    client['getOptionsProp'](obj, prop, defaultValue);

  it('returns the own value when the property exists (D1 true, D2 true)', () => {
    expect(get({ host: 'localhost' }, 'host')).toBe('localhost');
  });

  it('returns a property inherited through the prototype (D2 `in` true)', () => {
    const options = Object.create({ port: 1234 });

    expect(get(options, 'port')).toBe(1234);
  });

  it('returns the default when the property is missing (D1 true, D2 false)', () => {
    expect(get({}, 'host', 'fallback')).toBe('fallback');
  });

  it('returns undefined when the property is missing and no default is given', () => {
    expect(get({}, 'host')).toBeUndefined();
  });

  it('returns the default when the object is falsy (D1 false)', () => {
    expect(get(undefined, 'host', 'fallback')).toBe('fallback');
    expect(get(null, 'host', 'fallback')).toBe('fallback');
  });

  it('returns an explicitly undefined property value instead of the default (D2 true)', () => {
    expect(get({ host: undefined }, 'host', 'fallback')).toBeUndefined();
  });
});

/**
 * `initializeSerializer` decisions:
 *   D1 `options` truthy? D2 `options.serializer` truthy?
 *   true/true -> custom; true/false and false -> IdentitySerializer.
 */
describe('ClientProxy.initializeSerializer', () => {
  it('uses a custom serializer from the options (D1 true, D2 true)', () => {
    const client = new TestClientProxy();
    const serializer = { serialize: vi.fn() };

    client['initializeSerializer']({ serializer } as any);

    expect(client['serializer']).toBe(serializer);
  });

  it('falls back to IdentitySerializer when the options have no serializer (D1 true, D2 false)', () => {
    const client = new TestClientProxy();

    client['initializeSerializer']({} as any);

    expect(client['serializer']).toBeInstanceOf(IdentitySerializer);
  });

  it('falls back to IdentitySerializer when options are missing (D1 false)', () => {
    const client = new TestClientProxy();

    client['initializeSerializer'](undefined as any);

    expect(client['serializer']).toBeInstanceOf(IdentitySerializer);
  });
});

/**
 * `initializeDeserializer` decisions mirror initializeSerializer:
 *   D1 `options` truthy? D2 `options.deserializer` truthy?
 */
describe('ClientProxy.initializeDeserializer', () => {
  it('uses a custom deserializer from the options (D1 true, D2 true)', () => {
    const client = new TestClientProxy();
    const deserializer = { deserialize: vi.fn() };

    client['initializeDeserializer']({ deserializer } as any);

    expect(client['deserializer']).toBe(deserializer);
  });

  it('falls back to IncomingResponseDeserializer when missing (D1 true, D2 false)', () => {
    const client = new TestClientProxy();

    client['initializeDeserializer']({} as any);

    expect(client['deserializer']).toBeInstanceOf(IncomingResponseDeserializer);
  });

  it('falls back when options are missing (D1 false)', () => {
    const client = new TestClientProxy();

    client['initializeDeserializer'](undefined as any);

    expect(client['deserializer']).toBeInstanceOf(IncomingResponseDeserializer);
  });
});

/**
 * `assignPacketId` has no decisions: every packet gets a fresh UUID string and
 * keeps its original fields.
 */
describe('ClientProxy.assignPacketId', () => {
  it('adds a non-empty uuid id without dropping the packet fields', () => {
    const client = new TestClientProxy();
    const packet = { pattern: 'p', data: { n: 1 } };

    const result = client['assignPacketId'](packet);

    expect(result).toBe(packet);
    expect(result.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    expect(result.pattern).toBe('p');
  });

  it('does not repeat ids between packets', () => {
    const client = new TestClientProxy();
    const ids = new Set(
      Array.from(
        { length: 5 },
        () => client['assignPacketId']({ pattern: 'p', data: 1 }).id,
      ),
    );

    expect(ids.size).toBe(5);
  });
});

/**
 * `normalizePattern` has type-based decisions inside
 * `transformPatternToRoute`: strings/numbers and objects take different paths.
 */
describe('ClientProxy.normalizePattern', () => {
  it.each([
    ['string pattern' as const, 'my-pattern', 'my-pattern'],
    ['number pattern' as const, 42, '42'],
    [
      'object pattern' as const,
      { cmd: 'test', id: 1 },
      '{"cmd":"test","id":1}',
    ],
  ])('normalizes the %s to a route', (_name, pattern, expected) => {
    const client = new TestClientProxy();

    expect(client['normalizePattern'](pattern as any)).toBe(expected);
  });
});

/**
 * `status` decision: distinctUntilChanged suppresses a repeated value.
 * The ReplaySubject replays the latest status to late subscribers.
 */
describe('ClientProxy.status', () => {
  it('emits distinct statuses only (same status twice -> one emission)', () => {
    const client = new TestClientProxy();
    const statuses: string[] = [];
    const subscription = client.status.subscribe(status =>
      statuses.push(status),
    );

    client.pushStatus('connected');
    client.pushStatus('connected');
    client.pushStatus('disconnected');
    client.pushStatus('disconnected');

    expect(statuses).toEqual(['connected', 'disconnected']);
    subscription.unsubscribe();
  });

  it('replays the latest status to a late subscriber', () => {
    const client = new TestClientProxy();
    client.pushStatus('connected');

    const statuses: string[] = [];
    const subscription = client.status.subscribe(status =>
      statuses.push(status),
    );

    expect(statuses).toEqual(['connected']);
    subscription.unsubscribe();
  });
});

/**
 * The base `on` implementation has no decisions: it always throws.
 */
describe('ClientProxy.on', () => {
  it('throws "Method not implemented."', () => {
    const client = new TestClientProxy();

    expect(() => (client as any).on('event', () => {})).toThrow(
      'Method not implemented.',
    );
  });
});
