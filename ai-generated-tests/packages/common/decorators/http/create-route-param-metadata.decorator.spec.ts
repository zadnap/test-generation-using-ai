import { ROUTE_ARGS_METADATA } from '../../../../../packages/common/constants.js';
import { createParamDecorator } from '../../../../../packages/common/decorators/http/create-route-param-metadata.decorator.js';

class ClassPipe {
  transform(value: unknown) {
    return value;
  }
}

const instancePipe = { transform: (value: unknown) => value };
const functionWithStaticTransform = Object.assign(() => undefined, {
  transform: (value: unknown) => value,
});
const plainFunction = () => undefined;
const schema = { '~standard': { validate: () => undefined } };

function register(
  factory: (...args: any[]) => any,
  args: any[],
  enhancers: any[] = [],
) {
  class Target {
    method() {}
  }
  createParamDecorator(factory, enhancers)(...args)(
    Target.prototype,
    'method',
    0,
  );
  const metadata = Reflect.getMetadata(ROUTE_ARGS_METADATA, Target, 'method');
  return Object.values(metadata)[0] as any;
}

describe('createParamDecorator', () => {
  it('stores a custom parameter entry and returns the factory output', () => {
    const factory = vi.fn((data, ctx) => ({ data, ctx }));
    const entry = register(factory, ['payload']);
    const context = { id: 1 };

    expect(entry.index).toBe(0);
    expect(entry.factory).toBe(factory);
    expect(entry.data).toBe('payload');
    expect(entry.pipes).toEqual([]);
    expect(entry.schema).toBeUndefined();
    expect(entry.factory('payload', context)).toEqual({
      data: 'payload',
      ctx: context,
    });
  });

  it('treats class, instance, and static-transform functions as pipes', () => {
    const first = register(() => undefined, [ClassPipe]);
    const second = register(() => undefined, [instancePipe]);
    const third = register(() => undefined, [functionWithStaticTransform]);

    expect(first.data).toBeUndefined();
    expect(first.pipes).toEqual([ClassPipe]);
    expect(second.data).toBeUndefined();
    expect(second.pipes).toEqual([instancePipe]);
    expect(third.data).toBeUndefined();
    expect(third.pipes).toEqual([functionWithStaticTransform]);
  });

  it('keeps non-pipe data and appends ordinary pipes', () => {
    const entry = register(() => undefined, [
      { id: 1 },
      ClassPipe,
      instancePipe,
    ]);

    expect(entry.data).toEqual({ id: 1 });
    expect(entry.pipes).toEqual([ClassPipe, instancePipe]);
  });

  it('handles nullish data and functions that are not pipes', () => {
    expect(register(() => undefined, [undefined]).data).toBeUndefined();
    expect(register(() => undefined, [null]).data).toBeNull();
    expect(register(() => undefined, [plainFunction]).data).toBe(plainFunction);
  });

  it('treats a pure options object as options', () => {
    const entry = register(() => undefined, [
      { schema, pipes: [ClassPipe, null, instancePipe] },
    ]);

    expect(entry.data).toBeUndefined();
    expect(entry.schema).toBe(schema);
    expect(entry.pipes).toEqual([ClassPipe, null, instancePipe]);
  });

  it('accepts options with undefined schema and pipes', () => {
    const entry = register(() => undefined, [
      { schema: undefined, pipes: undefined },
    ]);

    expect(entry.data).toBeUndefined();
    expect(entry.schema).toBeUndefined();
    expect(entry.pipes).toEqual([]);
  });

  it('does not treat arbitrary data as options', () => {
    const cases = [
      { schema, extra: true },
      { schema: {} },
      { schema, pipes: 'not-an-array' },
      { schema, pipes: [{}] },
      {},
    ];

    for (const data of cases) {
      const entry = register(() => undefined, [data]);
      expect(entry.data).toEqual(data);
    }
  });

  it('merges options found among pipes, keeping the first schema', () => {
    const secondSchema = { '~standard': { validate: () => undefined } };
    const entry = register(() => undefined, [
      'data',
      { schema },
      ClassPipe,
      { schema: secondSchema, pipes: [instancePipe] },
      { pipes: undefined },
    ]);

    expect(entry.data).toBe('data');
    expect(entry.schema).toBe(schema);
    expect(entry.pipes).toEqual([ClassPipe, instancePipe]);
  });

  it('invokes every enhancer with the decorated target, key, and index', () => {
    const first = vi.fn();
    const second = vi.fn();
    class Target {
      method() {}
    }

    createParamDecorator(() => undefined, [first, second])()(
      Target.prototype,
      'method',
      2,
    );

    expect(first).toHaveBeenCalledWith(Target.prototype, 'method', 2);
    expect(second).toHaveBeenCalledWith(Target.prototype, 'method', 2);
  });
});
