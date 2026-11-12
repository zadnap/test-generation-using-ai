import { PARAM_ARGS_METADATA } from '../../../../packages/microservices/constants.js';
import { Ctx } from '../../../../packages/microservices/decorators/ctx.decorator.js';
import { RpcParamtype } from '../../../../packages/microservices/enums/rpc-paramtype.enum.js';

const CONTEXT_KEY = `${RpcParamtype.CONTEXT}:0`;

/**
 * CFG / C3 of Ctx: the exported constant is a factory without decisions; the
 * parameter decorator it returns always merges one entry keyed by
 * `${RpcParamtype.CONTEXT}:${index}` into PARAM_ARGS_METADATA.
 */
describe('Ctx', () => {
  it('registers context metadata for the decorated parameter', () => {
    class CtxController {
      public test(@Ctx() ctx: any) {}
    }

    const metadata = Reflect.getMetadata(
      PARAM_ARGS_METADATA,
      CtxController,
      'test',
    );

    expect(metadata).toEqual({
      [CONTEXT_KEY]: { index: 0, data: undefined, pipes: [] },
    });
  });

  it('registers one entry per decorated parameter and keeps their indices', () => {
    class MultiCtxController {
      public test(@Ctx() first: any, @Ctx() second: any) {}
    }

    const metadata = Reflect.getMetadata(
      PARAM_ARGS_METADATA,
      MultiCtxController,
      'test',
    );

    expect(Object.keys(metadata).sort()).toEqual(
      [`${RpcParamtype.CONTEXT}:0`, `${RpcParamtype.CONTEXT}:1`].sort(),
    );
    expect(metadata[`${RpcParamtype.CONTEXT}:1`]).toEqual({
      index: 1,
      data: undefined,
      pipes: [],
    });
  });

  it('replaces the entry when the same index is decorated again', () => {
    class ReplacedController {
      public test(@Ctx() ctx: any) {}
    }

    // Re-applying the decorator at the same index must overwrite, not duplicate.
    (Ctx() as any)(ReplacedController.prototype, 'test', 0);

    const metadata = Reflect.getMetadata(
      PARAM_ARGS_METADATA,
      ReplacedController,
      'test',
    );

    expect(Object.keys(metadata)).toHaveLength(1);
    expect(metadata[CONTEXT_KEY]).toEqual({
      index: 0,
      data: undefined,
      pipes: [],
    });
  });

  it('returns a decorator function', () => {
    expect(Ctx()).toBeTypeOf('function');
  });
});
