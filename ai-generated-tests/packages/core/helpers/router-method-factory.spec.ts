/**
 * CFT checklist extracted from packages/core/helpers/router-method-factory.ts.
 * D counts atomic short-circuit decisions and loop/case guards. P = D + 1.
 * && evaluates the next condition only after T. || evaluates it only after F.
 * Each condition needs feasible T/F outcomes. Test inputs below exercise these paths.
 * This static checklist is separate from measured V8 branch coverage.
 * Optional chaining, nullish fallback and exceptional edges remain visible in the HTML report.
 * RouterMethodFactory.get @L25 - D=1, P=2.
 *   1=!method
 */
import { describe, it } from 'vitest';
import {
  RouterMethodFactory,
  REQUEST_METHOD_MAP,
} from '../../../../packages/core/helpers/router-method-factory.js';

describe('RouterMethodFactory.get', () => {
  it.each(Object.entries(REQUEST_METHOD_MAP))(
    'method %s (%s), 1(F)',
    (method, name) => {
      new RouterMethodFactory().get(
        { [name]: () => undefined } as any,
        Number(method),
      );
    },
  );
  it.each([0, -1, 999])('missing method %s, 1(T)', method => {
    new RouterMethodFactory().get({ use: () => undefined } as any, method);
  });
});
