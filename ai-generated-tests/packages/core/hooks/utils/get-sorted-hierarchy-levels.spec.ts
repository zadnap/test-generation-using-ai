/**
 * CFT checklist extracted from packages/core/hooks/utils/get-sorted-hierarchy-levels.ts.
 * D counts atomic short-circuit decisions and loop/case guards. P = D + 1.
 * && evaluates the next condition only after T. || evaluates it only after F.
 * Each condition needs feasible T/F outcomes. Test inputs below exercise these paths.
 * This static checklist is separate from measured V8 branch coverage.
 * Optional chaining, nullish fallback and exceptional edges remain visible in the HTML report.
 * getSortedHierarchyLevels @L1 - D=1, P=2.
 *   1=order === 'ASC'
 * callback @L7 - D=0, P=1.
 * callback @L8 - D=0, P=1.
 */
import { describe, it } from 'vitest';
import { getSortedHierarchyLevels } from '../../../../../packages/core/hooks/utils/get-sorted-hierarchy-levels.js';
describe('getSortedHierarchyLevels', () => {
  it.each([undefined, 'ASC', 'DESC'] as const)('order %s', order => {
    getSortedHierarchyLevels(
      new Map([
        [2, []],
        [1, []],
        [3, []],
      ]),
      order,
    );
  });
});
