/**
 * CFT checklist extracted from packages/core/interceptors/interceptors-consumer.ts.
 * D counts atomic short-circuit decisions and loop/case guards. P = D + 1.
 * && evaluates the next condition only after T. || evaluates it only after F.
 * Each condition needs feasible T/F outcomes. Test inputs below exercise these paths.
 * This static checklist is separate from measured V8 branch coverage.
 * Optional chaining, nullish fallback and exceptional edges remain visible in the HTML report.
 * InterceptorsConsumer.intercept @L11 - D=2, P=3.
 *   1c1=!interceptors | 1c2=isEmptyArray(interceptors)
 * InterceptorsConsumer.nextFn @L25 - D=1, P=2.
 *   1=i >= interceptors.length
 * InterceptorsConsumer.callback @L27 - D=0, P=1.
 * InterceptorsConsumer.callback @L30 - D=0, P=1.
 * InterceptorsConsumer.callback @L31 - D=0, P=1.
 * InterceptorsConsumer.callback @L35 - D=0, P=1.
 * InterceptorsConsumer.createContext @L38 - D=0, P=1.
 * InterceptorsConsumer.transformDeferred @L50 - D=0, P=1.
 * InterceptorsConsumer.callback @L56 - D=0, P=1.
 * InterceptorsConsumer.callback @L60 - D=4, P=5.
 *   1=subscriber.closed
 *   2c1=res instanceof Promise | 2c2=isObservable(res)
 *   3=isDeferred
 * InterceptorsConsumer.callback @L78 - D=1, P=2.
 *   1=!subscriber.closed
 * InterceptorsConsumer.callback @L84 - D=0, P=1.
 * bindAsyncScope @L98 - D=2, P=3.
 *   1c1=fn.name | 1c2='bound-anonymous-fn'
 * callback @L100 - D=0, P=1.
 */
import { describe, it } from 'vitest';
import { lastValueFrom, of, isObservable } from 'rxjs';
import { StreamableFile } from '@nestjs/common';
import { InterceptorsConsumer } from '../../../../packages/core/interceptors/interceptors-consumer.js';

describe('InterceptorsConsumer', () => {
  describe('intercept/createContext/bindAsyncScope', () => {
    it.each(
      [
        undefined,
        [],
        [{ intercept: (_ctx: any, next: any) => next.handle() }],
        [{ intercept: async (_ctx: any, next: any) => next.handle() }],
      ].map(interceptors => ({ interceptors })),
    )('interceptors $interceptors', async ({ interceptors }) => {
      const result = await new InterceptorsConsumer().intercept(
        interceptors as any,
        [],
        {},
        () => undefined,
        async () => 'value',
        'rpc',
      );
      if (isObservable(result)) await lastValueFrom(result);
    });
  });
  describe('transformDeferred', () => {
    it.each([1, of(1)])('handler returns %s', async value => {
      await lastValueFrom(
        new InterceptorsConsumer().transformDeferred(async () => value),
      );
    });
    it('handler rejection while subscribed', async () => {
      try {
        await lastValueFrom(
          new InterceptorsConsumer().transformDeferred(() =>
            Promise.reject(new Error('fixture')),
          ),
        );
      } catch (error) {
        if (!(error instanceof Error)) throw error;
      }
    });
    it.each([false, true])(
      'handler settles after cancellation, reject %s',
      async reject => {
        let settle: Function = () => undefined;
        const promise = new Promise((resolve, failure) => {
          settle = reject ? failure : resolve;
        });
        const subscription = new InterceptorsConsumer()
          .transformDeferred(() => promise)
          .subscribe();
        subscription.unsubscribe();
        settle(
          reject
            ? new Error('fixture')
            : new StreamableFile(Buffer.from('fixture')),
        );
        await new Promise(resolve => setImmediate(resolve));
      },
    );
  });
});
