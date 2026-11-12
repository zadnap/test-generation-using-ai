/**
 * CFT checklist extracted from packages/core/guards/guards-consumer.ts.
 * D counts atomic short-circuit decisions and loop/case guards. P = D + 1.
 * && evaluates the next condition only after T. || evaluates it only after F.
 * Each condition needs feasible T/F outcomes. Test inputs below exercise these paths.
 * This static checklist is separate from measured V8 branch coverage.
 * Optional chaining, nullish fallback and exceptional edges remain visible in the HTML report.
 * GuardsConsumer.tryActivate @L8 - D=6, P=7.
 *   1c1=!guards | 1c2=isEmptyArray(guards)
 *   2=next iteration of guards
 *   3=typeof result === 'boolean'
 *   4=!result
 *   5=await this.pickResult(result)
 * GuardsConsumer.createContext @L37 - D=0, P=1.
 * GuardsConsumer.pickResult @L49 - D=1, P=2.
 *   1=isObservable(value)
 */
import { describe, it } from 'vitest';
import { of } from 'rxjs';
import { GuardsConsumer } from '../../../../packages/core/guards/guards-consumer.js';

describe('GuardsConsumer', () => {
  describe('tryActivate', () => {
    it.each(
      [
        undefined,
        [],
        [true],
        [false],
        [Promise.resolve(true)],
        [Promise.resolve(false)],
        [of(true)],
        [of(false)],
        [true, Promise.resolve(true)],
      ].map(values => ({ values })),
    )(
      'guards $values, short-circuit/boolean/async paths',
      async ({ values }) => {
        await new GuardsConsumer().tryActivate(
          values?.map(value => ({ canActivate: () => value })) as any,
          [],
          {},
          () => undefined,
          'rpc',
        );
      },
    );
  });
  describe('createContext', () => {
    it('creates an execution context', () => {
      new GuardsConsumer().createContext([1], {}, () => undefined);
    });
  });
  describe('pickResult', () => {
    it.each([
      true,
      Promise.resolve(false),
      of(true),
      Promise.resolve(of(false)),
    ])('observable/promise/plain %s', async value => {
      await new GuardsConsumer().pickResult(value as any);
    });
  });
});
