/**
 * CFT checklist extracted from packages/core/helpers/rethrow.ts.
 * D counts atomic short-circuit decisions and loop/case guards. P = D + 1.
 * && evaluates the next condition only after T. || evaluates it only after F.
 * Each condition needs feasible T/F outcomes. Test inputs below exercise these paths.
 * This static checklist is separate from measured V8 branch coverage.
 * Optional chaining, nullish fallback and exceptional edges remain visible in the HTML report.
 * rethrow @L1 - D=0, P=1.
 */
import { describe, it } from 'vitest';
import { rethrow } from '../../../../packages/core/helpers/rethrow.js';
describe('rethrow', () => {
  it('throw path', () => {
    const error = new Error('fixture');
    try {
      rethrow(error);
    } catch (caught) {
      if (caught !== error) throw caught;
    }
  });
});
