import {
  PATTERN_EXTRAS_METADATA,
  PATTERN_HANDLER_METADATA,
  PATTERN_METADATA,
  TRANSPORT_METADATA,
} from '../../../../packages/microservices/constants.js';
import {
  createGrpcMethodMetadata,
  GrpcMethod,
  GrpcMethodStreamingType,
  GrpcStreamCall,
  GrpcStreamMethod,
  MessagePattern,
} from '../../../../packages/microservices/decorators/message-pattern.decorator.js';
import { PatternHandler } from '../../../../packages/microservices/enums/pattern-handler.enum.js';
import { Transport } from '../../../../packages/microservices/enums/transport.enum.js';
import { InvalidGrpcDecoratorException } from '../../../../packages/microservices/errors/invalid-grpc-message-decorator.exception.js';

const pattern = { cmd: 'test' };
const secondPattern = { cmd: 'test2' };
const extras = { param: 'value' };
const otherExtras = { foo: 'bar' };
const symbolTransport = Symbol('custom-transport');

const applyMessagePattern = (args: unknown[]) => {
  const target = {};
  const descriptor: PropertyDescriptor = { value: function handler() {} };
  const returned = (MessagePattern as any)(...args)(
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
 * CFG / C3 of the MessagePattern argument parser and writer:
 * D1: (isNumber(t) || isSymbol(t)) && isNil(maybeExtras) -> c1, c2, c3
 * D2: isObject(t) && isNil(maybeExtras)                  -> c4, c3
 * D3: try/catch around Reflect.defineMetadata            -> normal vs throwing
 * Infeasible: c2 is not evaluated when c1 is true (|| short-circuit).
 */
describe('MessagePattern', () => {
  const overloads: Array<[string, unknown[], unknown, Record<string, any>]> = [
    ['D1(F) D2(F) - neither transport nor extras', [pattern], undefined, {}],
    ['D1(T) - numeric transport', [pattern, Transport.RMQ], Transport.RMQ, {}],
    [
      'D1(T) - symbol transport',
      [pattern, symbolTransport],
      symbolTransport,
      {},
    ],
    ['D2(T) - extras object', [pattern, extras], undefined, extras],
    [
      'D1(F) D2(F) - numeric transport + extras',
      [pattern, Transport.NATS, extras],
      Transport.NATS,
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
      // Not part of the public overloads; exercises c4 true with c3 false.
      'D2(T,F) - extras in both positions',
      [pattern, otherExtras, extras],
      otherExtras,
      extras,
    ],
  ];

  it.each(overloads)(
    '%s writes transport and extras',
    (_label, args, expectedTransport, expectedExtras) => {
      const metadata = applyMessagePattern(args);

      expect(metadata.transport).toBe(expectedTransport);
      expect(metadata.extras).toEqual(expectedExtras);
      expect(metadata.patterns).toEqual([pattern]);
      expect(metadata.handlerType).toBe(PatternHandler.MESSAGE);
    },
  );

  it('wraps an array of patterns without flattening it', () => {
    const metadata = applyMessagePattern([
      [pattern, secondPattern],
      Transport.REDIS,
    ]);

    expect(metadata.patterns).toEqual([pattern, secondPattern]);
  });

  it('merges extras with metadata defined by an earlier decorator', () => {
    const descriptor: PropertyDescriptor = { value: function handler() {} };
    Reflect.defineMetadata(
      PATTERN_EXTRAS_METADATA,
      otherExtras,
      descriptor.value,
    );

    (MessagePattern as any)(pattern, Transport.TCP, extras)(
      {},
      'handler',
      descriptor,
    );

    expect(
      Reflect.getMetadata(PATTERN_EXTRAS_METADATA, descriptor.value),
    ).toEqual({ ...otherExtras, ...extras });
  });

  it('D3 throwing - wraps a failed metadata write in InvalidGrpcDecoratorException', () => {
    // descriptor.value is undefined, so Reflect.defineMetadata throws.
    expect(() => (MessagePattern as any)(pattern)({}, 'handler', {})).toThrow(
      InvalidGrpcDecoratorException,
    );
  });

  it('D3 normal - returns the descriptor', () => {
    const descriptor: PropertyDescriptor = { value: function handler() {} };

    const returned = (MessagePattern as any)(pattern)(
      {},
      'handler',
      descriptor,
    );

    expect(returned).toBe(descriptor);
  });

  it('works on a class method', () => {
    class MessagesController {
      @MessagePattern(pattern, Transport.KAFKA, extras)
      public handle() {}
    }

    expect(
      Reflect.getMetadata(
        PATTERN_METADATA,
        MessagesController.prototype.handle,
      ),
    ).toEqual([pattern]);
    expect(
      Reflect.getMetadata(
        PATTERN_HANDLER_METADATA,
        MessagesController.prototype.handle,
      ),
    ).toBe(PatternHandler.MESSAGE);
    expect(
      Reflect.getMetadata(
        TRANSPORT_METADATA,
        MessagesController.prototype.handle,
      ),
    ).toBe(Transport.KAFKA);
  });

  it('returns a method decorator for every overload', () => {
    expect(MessagePattern(pattern)).toBeTypeOf('function');
    expect(MessagePattern(pattern, Transport.TCP)).toBeTypeOf('function');
    expect(MessagePattern(pattern, extras)).toBeTypeOf('function');
    expect(MessagePattern(pattern, Transport.TCP, extras)).toBeTypeOf(
      'function',
    );
  });
});

/**
 * CFG / C3 of GrpcMethod: no decisions, it always delegates to MessagePattern
 * with Transport.GRPC. The three overload shapes are covered.
 */
describe('GrpcMethod', () => {
  class GrpcService {
    @GrpcMethod()
    public noArgs() {}

    @GrpcMethod('TestService')
    public serviceOnly() {}

    @GrpcMethod('TestService', 'Override')
    public both() {}
  }

  const metadataOf = (method: keyof GrpcService) =>
    Reflect.getMetadata(PATTERN_METADATA, GrpcService.prototype[method])[0];

  it('derives the service and rpc name from the class and method', () => {
    expect(metadataOf('noArgs')).toEqual({
      service: 'GrpcService',
      rpc: 'NoArgs',
      streaming: GrpcMethodStreamingType.NO_STREAMING,
    });
  });

  it('uses the provided service and derives the rpc name', () => {
    expect(metadataOf('serviceOnly')).toEqual({
      service: 'TestService',
      rpc: 'ServiceOnly',
      streaming: GrpcMethodStreamingType.NO_STREAMING,
    });
  });

  it('uses the provided service and rpc names', () => {
    expect(metadataOf('both')).toEqual({
      service: 'TestService',
      rpc: 'Override',
      streaming: GrpcMethodStreamingType.NO_STREAMING,
    });
  });

  it('always registers the GRPC transport', () => {
    expect(
      Reflect.getMetadata(TRANSPORT_METADATA, GrpcService.prototype.noArgs),
    ).toBe(Transport.GRPC);
  });
});

/**
 * CFG / C3 of the GrpcStreamMethod wrapper:
 * D1: result && typeof result.then === 'function' -> isPromise, c1 result truthy
 * D2: observable && observable.drainBuffer          -> c2 observable truthy,
 *                                                       c3 drainBuffer truthy
 * Both decisions are exercised true and false; the metadata copy has no
 * decision (it iterates the original metadata keys).
 */
describe('GrpcStreamMethod', () => {
  it('derives RX_STREAMING metadata and registers the GRPC transport', () => {
    class Service {
      @GrpcStreamMethod()
      public handle(_data$: any) {}
    }

    expect(
      Reflect.getMetadata(PATTERN_METADATA, Service.prototype.handle),
    ).toEqual([
      {
        service: 'Service',
        rpc: 'Handle',
        streaming: GrpcMethodStreamingType.RX_STREAMING,
      },
    ]);
    expect(
      Reflect.getMetadata(TRANSPORT_METADATA, Service.prototype.handle),
    ).toBe(Transport.GRPC);
    expect(
      Reflect.getMetadata(PATTERN_HANDLER_METADATA, Service.prototype.handle),
    ).toBe(PatternHandler.MESSAGE);
  });

  it('D1(F) D2(T,T) - drains the buffer after a synchronous handler', () => {
    class Service {
      @GrpcStreamMethod()
      public handle(data$: any) {
        return `from ${data$.id}`;
      }
    }
    const drainBuffer = vi.fn();
    const observable = { id: 'obs', drainBuffer };

    expect(new Service().handle(observable)).toBe('from obs');
    expect(drainBuffer).toHaveBeenCalledOnce();
  });

  it('D1(F) D2(T,F) - does not drain an observable without drainBuffer', () => {
    class Service {
      @GrpcStreamMethod()
      public handle(data$: any) {
        return data$.id;
      }
    }

    expect(new Service().handle({ id: 'obs' })).toBe('obs');
  });

  it('D1(F) D2(F) - tolerates a missing observable', () => {
    class Service {
      @GrpcStreamMethod()
      public handle(_data$: any) {
        return 'sync';
      }
    }

    expect(new Service().handle(undefined)).toBe('sync');
    expect(new Service().handle(null)).toBe('sync');
  });

  it('D1(F) - a falsy result still reaches the drainBuffer step', () => {
    class Service {
      @GrpcStreamMethod()
      public handle(_data$: any) {
        return undefined;
      }
    }
    const drainBuffer = vi.fn();

    // `result &&` only guards the `.then` access; drainBuffer runs regardless.
    expect(new Service().handle({ drainBuffer })).toBeUndefined();
    expect(drainBuffer).toHaveBeenCalledOnce();
  });

  it('D1(T) D2(T,T) - drains the buffer after a promise resolves', async () => {
    class Service {
      @GrpcStreamMethod()
      public async handle(_data$: any) {
        return 'async value';
      }
    }
    const drainBuffer = vi.fn();

    await expect(new Service().handle({ drainBuffer })).resolves.toBe(
      'async value',
    );
    expect(drainBuffer).toHaveBeenCalledOnce();
  });

  it('D1(T) D2(T,F) - resolves without draining when drainBuffer is missing', async () => {
    class Service {
      @GrpcStreamMethod()
      public async handle(_data$: any) {
        return 'async value';
      }
    }

    await expect(new Service().handle({})).resolves.toBe('async value');
  });

  it('D1(T) D2(F) - resolves without draining when the observable is absent', async () => {
    class Service {
      @GrpcStreamMethod()
      public async handle(_data$: any) {
        return 'async value';
      }
    }

    await expect(new Service().handle(undefined)).resolves.toBe('async value');
  });
});

/**
 * CFG / C3 of GrpcStreamCall: no decisions; it registers PT_STREAMING
 * metadata and leaves the handler untouched.
 */
describe('GrpcStreamCall', () => {
  class Service {
    @GrpcStreamCall()
    public noArgs(_call: any) {
      return 'original';
    }

    @GrpcStreamCall('TestService')
    public serviceOnly(_call: any) {}

    @GrpcStreamCall('TestService', 'Override')
    public both(_call: any) {}
  }

  const metadataOf = (method: keyof Service) =>
    Reflect.getMetadata(PATTERN_METADATA, Service.prototype[method])[0];

  it('derives service and rpc from the class and method', () => {
    expect(metadataOf('noArgs')).toEqual({
      service: 'Service',
      rpc: 'NoArgs',
      streaming: GrpcMethodStreamingType.PT_STREAMING,
    });
  });

  it('uses the provided service and derives rpc', () => {
    expect(metadataOf('serviceOnly')).toEqual({
      service: 'TestService',
      rpc: 'ServiceOnly',
      streaming: GrpcMethodStreamingType.PT_STREAMING,
    });
  });

  it('uses both provided names', () => {
    expect(metadataOf('both')).toEqual({
      service: 'TestService',
      rpc: 'Override',
      streaming: GrpcMethodStreamingType.PT_STREAMING,
    });
  });

  it('does not wrap the handler', () => {
    expect(new Service().noArgs({})).toBe('original');
  });
});

/**
 * CFG / C3 of createGrpcMethodMetadata:
 * D1: !service                              -> c1
 * D2: service && !method (evaluated only when c1 is false) -> c1, c2
 * Infeasible: D2's service operand is always truthy once D1 is false; the
 * "service falsy and method provided" input is caught by D1 first.
 */
describe('createGrpcMethodMetadata', () => {
  class OrderService {}

  it('D1(T) - derives service from the target constructor and capitalizes the key', () => {
    expect(
      createGrpcMethodMetadata(OrderService.prototype, 'findOne', undefined),
    ).toEqual({
      service: 'OrderService',
      rpc: 'FindOne',
      streaming: GrpcMethodStreamingType.NO_STREAMING,
    });
  });

  it('D1(T) - an empty service string is treated as missing', () => {
    expect(
      createGrpcMethodMetadata(OrderService.prototype, 'find', ''),
    ).toEqual({
      service: 'OrderService',
      rpc: 'Find',
      streaming: GrpcMethodStreamingType.NO_STREAMING,
    });
  });

  it('D2(T) - keeps the service and capitalizes the method key', () => {
    expect(
      createGrpcMethodMetadata(OrderService.prototype, 'findOne', 'Order'),
    ).toEqual({
      service: 'Order',
      rpc: 'FindOne',
      streaming: GrpcMethodStreamingType.NO_STREAMING,
    });
  });

  it('D2(c2 T) - an empty method string still derives rpc from the key', () => {
    expect(
      createGrpcMethodMetadata(OrderService.prototype, 'findOne', 'Order', ''),
    ).toEqual({
      service: 'Order',
      rpc: 'FindOne',
      streaming: GrpcMethodStreamingType.NO_STREAMING,
    });
  });

  it('D2(F) - keeps both service and method', () => {
    expect(
      createGrpcMethodMetadata(
        OrderService.prototype,
        'findOne',
        'Order',
        'Find',
      ),
    ).toEqual({
      service: 'Order',
      rpc: 'Find',
      streaming: GrpcMethodStreamingType.NO_STREAMING,
    });
  });

  it('keeps an explicit streaming mode', () => {
    expect(
      createGrpcMethodMetadata(
        OrderService.prototype,
        'watch',
        undefined,
        undefined,
        GrpcMethodStreamingType.RX_STREAMING,
      ),
    ).toEqual({
      service: 'OrderService',
      rpc: 'Watch',
      streaming: GrpcMethodStreamingType.RX_STREAMING,
    });
  });

  it('does not change an already capitalized key', () => {
    expect(
      createGrpcMethodMetadata(OrderService.prototype, 'FindOne', undefined),
    ).toEqual({
      service: 'OrderService',
      rpc: 'FindOne',
      streaming: GrpcMethodStreamingType.NO_STREAMING,
    });
  });
});
