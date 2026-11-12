import { describe, expect, it } from 'vitest';
import { PARAM_ARGS_METADATA } from '../../../../packages/microservices/constants.js';
import { RpcParamtype } from '../../../../packages/microservices/enums/rpc-paramtype.enum.js';
import {
  createPipesRpcParamDecorator,
  createRpcParamDecorator,
} from '../../../../packages/microservices/utils/param.utils.js';

/**
 * C3 decisions of createPipesRpcParamDecorator (the returned decorator):
 * D1: isParameterDecoratorOptions(data)
 *     1(T): early return, pipes = opts.pipes ?? []  (D1a: pipes defined/undefined), schema = opts.schema
 *     1(F): continue
 * D2: hasParamData = isNil(data) || isString(data)
 *     2c1: isNil(data)            -> T (c2 skipped) / F
 *     2c2: isString(data)         -> T / F
 * D3: isParameterDecoratorOptions(optionsOrPipe) -> T / F
 * D4: ternary `isOptions ? optionsOrPipe.schema : undefined` (same condition as D3)
 * D5: `optionsOrPipe.pipes ?? []` (nullish) -> defined / undefined
 * D6: filter(Boolean) in `[optionsOrPipe, ...pipes]` (branch hasParamData)
 *     -> truthy pipe kept / falsy entry dropped
 * D7: filter(Boolean) in `[data, optionsOrPipe, ...pipes]` (branch !hasParamData)
 *     -> truthy entries kept / falsy entries dropped
 *
 * createRpcParamDecorator has no decision of its own (it always assembles the
 * same metadata); it is exercised with and without pipes.
 *
 * No infeasible paths among D1-D7.
 */

class PipeA {
  public transform(value: unknown) {
    return value;
  }
}
class PipeB {
  public transform(value: unknown) {
    return value;
  }
}
const pipeInstance = { transform: (value: unknown) => value };

function applyDecorator(decorator: ParameterDecorator) {
  class Target {
    public method(_arg?: unknown) {}
  }
  decorator(Target.prototype, 'method', 0);
  const metadata = Reflect.getMetadata(
    PARAM_ARGS_METADATA,
    Target,
    'method',
  ) as Record<string, any>;
  return { Target, metadata, entry: metadata[`${RpcParamtype.PAYLOAD}:0`] };
}

describe('createRpcParamDecorator', () => {
  it('stores the given pipes for the parameter index', () => {
    const decorator = createRpcParamDecorator(RpcParamtype.PAYLOAD)(
      PipeA,
      PipeB,
    );
    const { entry } = applyDecorator(decorator);

    expect(entry.index).toBe(0);
    expect(entry.pipes).toEqual([PipeA, PipeB]);
  });

  it('stores an empty pipes array when no pipe is given', () => {
    const decorator = createRpcParamDecorator(RpcParamtype.CONTEXT)();
    class Target {
      public method(_arg?: unknown) {}
    }
    decorator(Target.prototype, 'method', 0);
    const metadata = Reflect.getMetadata(
      PARAM_ARGS_METADATA,
      Target,
      'method',
    ) as Record<string, any>;

    expect(metadata[`${RpcParamtype.CONTEXT}:0`].pipes).toEqual([]);
  });
});

describe('createPipesRpcParamDecorator', () => {
  // D1(T), D1a(T/F)
  it('D1(T) - data is an options object with pipes: uses its pipes and schema', () => {
    const schema = { type: 'string' };
    const decorator = createPipesRpcParamDecorator(RpcParamtype.PAYLOAD)({
      pipes: [PipeA],
      schema,
    });
    const { entry } = applyDecorator(decorator);

    expect(entry.pipes).toEqual([PipeA]);
    expect(entry.schema).toBe(schema);
    expect(entry.data).toBeUndefined();
  });

  it('D1(T) D1a(F) - options object without pipes falls back to an empty array', () => {
    const decorator = createPipesRpcParamDecorator(RpcParamtype.PAYLOAD)({
      schema: { type: 'number' },
    });
    const { entry } = applyDecorator(decorator);

    expect(entry.pipes).toEqual([]);
    expect(entry.schema).toEqual({ type: 'number' });
  });

  it('D1(T) - extra positional pipes are ignored once data is options', () => {
    const decorator = createPipesRpcParamDecorator(RpcParamtype.PAYLOAD)(
      { pipes: [PipeA] },
      undefined,
      PipeB,
    );
    const { entry } = applyDecorator(decorator);

    expect(entry.pipes).toEqual([PipeA]);
  });

  // D1(F), D2 c1(T), D3(F), D6(T)
  it('D2 c1(T) - nil data keeps optionsOrPipe as a pipe and leaves data undefined', () => {
    const decorator = createPipesRpcParamDecorator(RpcParamtype.PAYLOAD)(
      undefined,
      pipeInstance,
    );
    const { entry } = applyDecorator(decorator);

    expect(entry.data).toBeUndefined();
    expect(entry.pipes).toEqual([pipeInstance]);
  });

  // D1(F), D2 c1(T) via null, D6(F) -> the nil entry is filtered out
  it('D2 c1(T) D6(F) - null data and no pipe -> empty pipes, null kept as data', () => {
    const decorator = createPipesRpcParamDecorator(RpcParamtype.PAYLOAD)(
      null,
      undefined,
    );
    const { entry } = applyDecorator(decorator);

    expect(entry.data).toBeNull();
    expect(entry.pipes).toEqual([]);
  });

  // D1(F), D2 c1(F) c2(T), D3(F), D6(T)
  it('D2 c2(T) - string data is kept and only the real pipes survive filtering', () => {
    const decorator = createPipesRpcParamDecorator(RpcParamtype.PAYLOAD)(
      'id',
      undefined,
      PipeA,
    );
    const { entry } = applyDecorator(decorator);

    expect(entry.data).toBe('id');
    expect(entry.pipes).toEqual([PipeA]);
  });

  // D1(F), D2 both(F), D3(F), D7(T)
  it('D2 c2(F) - non string/nil data becomes part of the pipes and data is undefined', () => {
    const decorator = createPipesRpcParamDecorator(RpcParamtype.PAYLOAD)(
      42,
      pipeInstance,
      PipeA,
    );
    const { entry } = applyDecorator(decorator);

    expect(entry.data).toBeUndefined();
    expect(entry.pipes).toEqual([42, pipeInstance, PipeA]);
  });

  // D1(F), D2 both(F), D7(F)
  it('D7(F) - falsy non-data entries are dropped from the pipes array', () => {
    const decorator = createPipesRpcParamDecorator(RpcParamtype.PAYLOAD)(
      42,
      null,
      undefined as any,
      '' as any,
    );
    const { entry } = applyDecorator(decorator);

    expect(entry.pipes).toEqual([42]);
  });

  // D1(F), D2 c2(T), D3(T), D4 (isOptions T), D5(T)
  it('D3(T) D5(T) - optionsOrPipe options object merges its pipes with the positional ones', () => {
    const schema = { type: 'object' };
    const decorator = createPipesRpcParamDecorator(RpcParamtype.PAYLOAD)(
      'payload',
      { pipes: [pipeInstance], schema },
      PipeA,
    );
    const { entry } = applyDecorator(decorator);

    expect(entry.data).toBe('payload');
    expect(entry.pipes).toEqual([pipeInstance, PipeA]);
    expect(entry.schema).toBe(schema);
  });

  // D1(F), D2 c1(T), D3(T), D5(F)
  it('D3(T) D5(F) - optionsOrPipe without pipes contributes only the positional pipes', () => {
    const decorator = createPipesRpcParamDecorator(RpcParamtype.PAYLOAD)(
      undefined,
      { schema: { type: 'string' } },
      PipeB,
    );
    const { entry } = applyDecorator(decorator);

    expect(entry.pipes).toEqual([PipeB]);
    expect(entry.schema).toEqual({ type: 'string' });
  });

  // D1(F), D2 both(F), D3(F) despite a "pipes" property: pipe-like objects are pipes
  it('D3(F) - a pipe instance exposing "pipes" is not mistaken for an options object', () => {
    const pipeLike = {
      transform: (value: unknown) => value,
      pipes: [],
    };
    const decorator = createPipesRpcParamDecorator(RpcParamtype.PAYLOAD)(
      'id',
      pipeLike,
    );
    const { entry } = applyDecorator(decorator);

    expect(entry.pipes).toEqual([pipeLike]);
    expect(entry.schema).toBeUndefined();
  });

  // D4(F): schema is undefined when optionsOrPipe is a plain pipe
  it('D4(F) - no schema is stored when optionsOrPipe is not an options object', () => {
    const decorator = createPipesRpcParamDecorator(RpcParamtype.PAYLOAD)(
      'id',
      PipeA,
    );
    const { entry } = applyDecorator(decorator);

    expect(entry.schema).toBeUndefined();
  });

  it('replaces an inherited param entry at the same index for an overriding method', () => {
    class Parent {
      public method(_arg?: unknown) {}
    }
    class Child extends Parent {
      public override method(_arg?: unknown) {}
    }
    Reflect.defineMetadata(
      PARAM_ARGS_METADATA,
      { [`${RpcParamtype.PAYLOAD}:0`]: { index: 0, data: 'parent' } },
      Parent,
      'method',
    );

    const decorator = createPipesRpcParamDecorator(RpcParamtype.PAYLOAD)(
      'child',
    );
    decorator(Child.prototype, 'method', 0);
    const metadata = Reflect.getMetadata(
      PARAM_ARGS_METADATA,
      Child,
      'method',
    ) as Record<string, any>;
    const entries = Object.values(metadata);

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ index: 0, data: 'child' });
  });
});
