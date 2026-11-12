/**
 * CFT checklist extracted from packages/core/router/rejected-by-pipes.ts.
 * D counts atomic short-circuit decisions and loop/case guards. P = D + 1.
 * && evaluates the next condition only after T. || evaluates it only after F.
 * Each condition needs feasible T/F outcomes. Test inputs below exercise these paths.
 * This static checklist is separate from measured V8 branch coverage.
 * Optional chaining, nullish fallback and exceptional edges remain visible in the HTML report.
 * markRejectedByPipes @L12 - D=2, P=3.
 *   1c1=typeof request === 'object' | 1c2=request !== null
 * isRejectedByPipes @L26 - D=3, P=4.
 *   1c1=typeof request === 'object' | 1c2=request !== null | 1c3=(request as Record<symbol, unknown>)[REJECTED_BY_PIPES] === true
 */
import { describe, it } from 'vitest';
import {
  markRejectedByPipes,
  isRejectedByPipes,
} from '../../../../packages/core/router/rejected-by-pipes.js';

describe('rejected-by-pipes helpers', () => {
  describe('markRejectedByPipes/isRejectedByPipes', () => {
    // 1c1(object),1c2(non-null),1c3(marker exactly true).
    it.each([
      undefined,
      null,
      1,
      () => undefined,
      {},
      { [Symbol.for('nestjs:rejected-by-pipes')]: false },
    ])('request %s', req => {
      isRejectedByPipes(req);
      markRejectedByPipes(req);
      isRejectedByPipes(req);
    });
  });
});
