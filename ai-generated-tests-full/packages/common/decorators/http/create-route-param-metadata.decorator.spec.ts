import { describe, expect, it, vi } from 'vitest';
import { ROUTE_ARGS_METADATA } from '../../../../../packages/common/constants.js';
import { createParamDecorator } from '../../../../../packages/common/decorators/http/create-route-param-metadata.decorator.js';

class Pipe {
  transform(value: unknown) {
    return value;
  }
}

const pipeInstance = { transform: (value: unknown) => value };
const schema = { '~standard': { validate: () => ({ value: undefined }) } } as any;
const otherSchema = {
  '~standard': { validate: () => ({ value: 'other' }) },
} as any;

const factory = vi.fn((data: unknown) => data);

function run(...args: unknown[]) {
  class Target {
    handler() {}
  }
  (createParamDecorator(factory) as any)(...args)(
    Target.prototype,
    'handler',
    0,
  );
  const metadata = Reflect.getMetadata(
    ROUTE_ARGS_METADATA,
    Target,
    'handler',
  );
  return Object.values(metadata)[0] as any;
}

describe('createParamDecorator', () => {
  it('xc1(T): registers undefined data and no pipes by default', () => {
    const arg = run();

    expect(arg.factory).toBe(factory);
    expect(arg.index).toBe(0);
    expect(arg.data).toBeUndefined();
    expect(arg.pipes).toEqual([]);
    expect(arg.schema).toBeUndefined();
  });

  it('xc1(T), xc2(T): keeps non-pipe custom data', () => {
    const arg = run('user');

    expect(arg.data).toBe('user');
    expect(arg.pipes).toEqual([]);
  });

  it('xc1(F): treats a pipe class as a pipe rather than data', () => {
    const arg = run(Pipe);

    expect(arg.data).toBeUndefined();
    expect(arg.pipes).toEqual([Pipe]);
  });

  it('xc1(F): treats a pipe instance as a pipe rather than data', () => {
    const arg = run(pipeInstance);

    expect(arg.data).toBeUndefined();
    expect(arg.pipes).toEqual([pipeInstance]);
  });

  it('xc2(F): classifies an options object as options', () => {
    const arg = run({ schema, pipes: [Pipe] });

    expect(arg.data).toBeUndefined();
    expect(arg.schema).toBe(schema);
    expect(arg.pipes).toEqual([Pipe]);
  });

  it('xc3(T): accepts options containing only pipes', () => {
    const arg = run({ pipes: [Pipe] });

    expect(arg.data).toBeUndefined();
    expect(arg.pipes).toEqual([Pipe]);
  });

  it('xc3(F): rejects options with an unexpected key', () => {
    const options = { schema, extra: true };

    const arg = run(options);

    expect(arg.data).toBe(options);
    expect(arg.schema).toBeUndefined();
  });

  it('xc4(T): rejects a schema that does not expose validate()', () => {
    const options = { schema: {} };

    const arg = run(options);

    expect(arg.data).toBe(options);
  });

  it('xc4(F): rejects a non-array pipes property', () => {
    const options = { schema, pipes: 'nope' };

    const arg = run(options);

    expect(arg.data).toBe(options);
  });

  it('xc5(T): allows falsy entries in the pipes array', () => {
    const arg = run({ schema, pipes: [null, Pipe] });

    expect(arg.data).toBeUndefined();
    expect(arg.pipes).toEqual([null, Pipe]);
  });

  it('xc5(F): rejects a non-pipe entry in the pipes array', () => {
    const options = { schema, pipes: [Pipe, {}] };

    const arg = run(options);

    expect(arg.data).toBe(options);
  });

  it('merges options appearing among positional pipes', () => {
    const arg = run('user', { schema, pipes: [Pipe] }, pipeInstance);

    expect(arg.data).toBe('user');
    expect(arg.schema).toBe(schema);
    expect(arg.pipes).toEqual([Pipe, pipeInstance]);
  });

  it('uses the first schema found among positional options', () => {
    const arg = run('user', { schema }, { schema: otherSchema });

    expect(arg.schema).toBe(schema);
    expect(arg.pipes).toEqual([]);
  });

  it('handles options without a pipes property', () => {
    const arg = run('user', { schema });

    expect(arg.schema).toBe(schema);
    expect(arg.pipes).toEqual([]);
  });

  it('treats a plain object without schema/pipes as custom data', () => {
    const data = { foo: 'bar' };

    const arg = run(data);

    expect(arg.data).toBe(data);
  });

  it('combines a pipe as the first argument with later options', () => {
    const arg = run(Pipe, { schema, pipes: [pipeInstance] });

    expect(arg.data).toBeUndefined();
    expect(arg.schema).toBe(schema);
    expect(arg.pipes).toEqual([Pipe, pipeInstance]);
  });

  it('calls enhancers with the decorator target, key and index', () => {
    const enhancer = vi.fn();
    class Target {
      handler() {}
    }

    createParamDecorator(factory, [enhancer])()(
      Target.prototype,
      'handler',
      0,
    );

    expect(enhancer).toHaveBeenCalledWith(Target.prototype, 'handler', 0);
  });

  it('accumulates arguments for different parameter indexes', () => {
    class Target {
      handler() {}
    }
    const decorator = createParamDecorator(factory)();

    decorator(Target.prototype, 'handler', 0);
    decorator(Target.prototype, 'handler', 1);

    const metadata = Reflect.getMetadata(
      ROUTE_ARGS_METADATA,
      Target,
      'handler',
    );
    expect(Object.values(metadata)).toHaveLength(2);
  });
});
