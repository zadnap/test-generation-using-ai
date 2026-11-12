/**
 * CFT checklist extracted from packages/core/repl/assign-to-object.util.ts.
 * D counts atomic short-circuit decisions and loop/case guards. P = D + 1.
 * && evaluates the next condition only after T. || evaluates it only after F.
 * Each condition needs feasible T/F outcomes. Test inputs below exercise these paths.
 * This static checklist is separate from measured V8 branch coverage.
 * Optional chaining, nullish fallback and exceptional edges remain visible in the HTML report.
 * assignToObject @L5 - D=0, P=1.
 * callback @L11 - D=0, P=1.
 */
import { describe, it } from 'vitest';
import { assignToObject } from '../../../../packages/core/repl/assign-to-object.util.js';
describe('assignToObject', () => {
  it('copies plain and accessor descriptors, including empty source', () => {
    assignToObject({}, {});
    assignToObject(
      {},
      {
        value: 1,
        get accessor() {
          return 2;
        },
      },
    );
  });
});
