import {
  PATTERN_EXTRAS_METADATA,
  PATTERN_HANDLER_METADATA,
  PATTERN_METADATA,
  TRANSPORT_METADATA,
} from '../../../../packages/microservices/constants.js';
import { EventPattern } from '../../../../packages/microservices/decorators/event-pattern.decorator.js';
import { PatternHandler } from '../../../../packages/microservices/enums/pattern-handler.enum.js';
import { Transport } from '../../../../packages/microservices/enums/transport.enum.js';

const pattern = { role: 'test' };
const secondPattern = { role: 'test2' };
const extras = { param: 'value' };
const otherExtras = { foo: 'bar' };
const symbolTransport = Symbol('custom-transport');

const applyEventPattern = (args: unknown[]) => {
  const target = {};
  const descriptor: PropertyDescriptor = { value: function handler() {} };
  const returned = (EventPattern as any)(...args)(
    target,
    'handler',
    descriptor,
  );
  return {
    returned,
    patterns: Reflect.getMetadata(PATTERN_METADATA, descriptor.value),
    handlerType: Reflect.getMetadata(
      PATTERN_HANDLER_METADATA,
      descriptor.value,
    ),
    transport: Reflect.getMetadata(TRANSPORT_METADATA, descriptor.value),
    extras: Reflect.getMetadata(PATTERN_EXTRAS_METADATA, descriptor.value),
  };
};

/**
 * CFG / C3 of the EventPattern argument parser:
 * D1: (isNumber(t) || isSymbol(t)) && isNil(maybeExtras)  -> c1, c2, c3
 * D2: isObject(t) && isNil(maybeExtras)                   -> c4, c3
 * else: transport = t, extras = maybeExtras
 * Infeasible: c2 is never evaluated when c1 is true (a value is either a
 * number or a symbol, the || short-circuits), and c3 is evaluated in both D1
 * and D2. Every other atomic condition is exercised true and false below.
 */
describe('EventPattern', () => {
  const overloads: Array<[string, unknown[], unknown, Record<string, any>]> = [
    ['D1(F) D2(F) - neither transport nor extras', [pattern], undefined, {}],
    ['D1(T) - numeric transport', [pattern, Transport.TCP], Transport.TCP, {}],
    [
      'D1(T) - symbol transport',
      [pattern, symbolTransport],
      symbolTransport,
      {},
    ],
    ['D2(T) - extras object', [pattern, extras], undefined, extras],
    [
      'D1(F) D2(F) - numeric transport + extras',
      [pattern, Transport.GRPC, extras],
      Transport.GRPC,
      extras,
    ],
    [
      'D1(F) D2(F) - symbol transport + extras',
      [pattern, symbolTransport, extras],
      symbolTransport,
      extras,
    ],
    [
      'D1(F) D2(F) - undefined transport + extras',
      [pattern, undefined, extras],
      undefined,
      extras,
    ],
    [
      // Not part of the public overloads; only reachable at runtime and it is
      // the case that exercises c4 true with c3 false.
      'D2(T,F) - extras in both positions',
      [pattern, otherExtras, extras],
      otherExtras,
      extras,
    ],
  ];

  it.each(overloads)(
    '%s writes transport and extras',
    (_label, args, expectedTransport, expectedExtras) => {
      const metadata = applyEventPattern(args);

      expect(metadata.transport).toBe(expectedTransport);
      expect(metadata.extras).toEqual(expectedExtras);
      expect(metadata.patterns).toEqual([pattern]);
      expect(metadata.handlerType).toBe(PatternHandler.EVENT);
    },
  );

  it('returns the same descriptor it was given', () => {
    const descriptor: PropertyDescriptor = { value: function handler() {} };
    const returned = (EventPattern as any)(pattern)({}, 'handler', descriptor);

    expect(returned).toBe(descriptor);
  });

  it('wraps an array of patterns without flattening it', () => {
    const metadata = applyEventPattern([
      [pattern, secondPattern],
      Transport.REDIS,
    ]);

    expect(metadata.patterns).toEqual([pattern, secondPattern]);
    expect(metadata.transport).toBe(Transport.REDIS);
  });

  it('merges extras with metadata defined by an earlier decorator', () => {
    const target = {};
    const descriptor: PropertyDescriptor = { value: function handler() {} };
    Reflect.defineMetadata(
      PATTERN_EXTRAS_METADATA,
      otherExtras,
      descriptor.value,
    );

    (EventPattern as any)(pattern, Transport.TCP, extras)(
      target,
      'handler',
      descriptor,
    );

    expect(
      Reflect.getMetadata(PATTERN_EXTRAS_METADATA, descriptor.value),
    ).toEqual({ ...otherExtras, ...extras });
  });

  it('works on a class method and keeps the handler metadata on the method', () => {
    class EventsController {
      @EventPattern(pattern, Transport.KAFKA, extras)
      public handle() {}
    }

    expect(
      Reflect.getMetadata(PATTERN_METADATA, EventsController.prototype.handle),
    ).toEqual([pattern]);
    expect(
      Reflect.getMetadata(
        PATTERN_HANDLER_METADATA,
        EventsController.prototype.handle,
      ),
    ).toBe(PatternHandler.EVENT);
    expect(
      Reflect.getMetadata(
        TRANSPORT_METADATA,
        EventsController.prototype.handle,
      ),
    ).toBe(Transport.KAFKA);
    expect(
      Reflect.getMetadata(
        PATTERN_EXTRAS_METADATA,
        EventsController.prototype.handle,
      ),
    ).toEqual(extras);
  });

  it('returns a method decorator for every overload', () => {
    expect(EventPattern(pattern)).toBeTypeOf('function');
    expect(EventPattern(pattern, Transport.TCP)).toBeTypeOf('function');
    expect(EventPattern(pattern, extras)).toBeTypeOf('function');
    expect(EventPattern(pattern, Transport.TCP, extras)).toBeTypeOf('function');
  });
});
