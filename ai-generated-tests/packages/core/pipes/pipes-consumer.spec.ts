/**
 * CFT checklist extracted from packages/core/pipes/pipes-consumer.ts.
 * D counts atomic short-circuit decisions and loop/case guards. P = D + 1.
 * && evaluates the next condition only after T. || evaluates it only after F.
 * Each condition needs feasible T/F outcomes. Test inputs below exercise these paths.
 * This static checklist is separate from measured V8 branch coverage.
 * Optional chaining, nullish fallback and exceptional edges remain visible in the HTML report.
 * isThenable @L5 - D=4, P=5.
 *   1c1=value !== null | 1c2=typeof value === 'object' | 1c3=typeof value === 'function' | 1c4=typeof (value as PromiseLike<unknown>).then === 'function'
 * PipesConsumer.apply @L13 - D=0, P=1.
 * PipesConsumer.applyPipes @L33 - D=2, P=3.
 *   1=isThenable(value)
 *   2=next iteration of transforms
 */
import { describe, it } from 'vitest';
import { RouteParamtypes } from '@nestjs/common/internal';
import { PipesConsumer } from '../../../../packages/core/pipes/pipes-consumer.js';

describe('PipesConsumer', () => {
  const metadata = { type: 'custom' as const, data: 'field', metatype: String };
  describe('apply', () => {
    it('maps enum metadata and executes transforms', async () => {
      await new PipesConsumer().apply(
        'value',
        { ...metadata, type: RouteParamtypes.BODY as any },
        [{ transform: value => value }],
      );
    });
  });
  describe('applyPipes/isThenable', () => {
    // isThenable 1c1(value !== null),1c2(object),1c3(function),1c4(then callable).
    const functionThenable = Object.assign(() => undefined, {
      then: (resolve: Function) => resolve('ready'),
    });
    it.each([
      null,
      undefined,
      0,
      'text',
      {},
      { then: 1 },
      () => undefined,
      Promise.resolve('ready'),
      functionThenable,
    ])('initial value %s', async value => {
      await new PipesConsumer().applyPipes(value, metadata, [
        { transform: input => input },
        { transform: async input => input },
      ]);
    });
    it('empty pipeline', async () => {
      await new PipesConsumer().applyPipes(1, metadata, []);
    });
  });
});
