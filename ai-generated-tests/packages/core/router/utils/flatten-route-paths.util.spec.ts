/**
 * CFT checklist extracted from packages/core/router/utils/flatten-route-paths.util.ts.
 * D counts atomic short-circuit decisions and loop/case guards. P = D + 1.
 * && evaluates the next condition only after T. || evaluates it only after F.
 * Each condition needs feasible T/F outcomes. Test inputs below exercise these paths.
 * This static checklist is separate from measured V8 branch coverage.
 * Optional chaining, nullish fallback and exceptional edges remain visible in the HTML report.
 * flattenRoutePaths @L5 - D=0, P=1.
 * callback @L10 - D=3, P=4.
 *   1c1=item.module | 1c2=item.path
 *   2=item.children
 * callback @L16 - D=2, P=3.
 *   1c1=!isString(child) | 1c2=isString(child.path)
 */
import { describe, it } from 'vitest';
import { flattenRoutePaths } from '../../../../../packages/core/router/utils/flatten-route-paths.util.js';

describe('flattenRoutePaths', () => {
  it('empty roots and nested class/path/string children', () => {
    class Child {}
    flattenRoutePaths([]);
    flattenRoutePaths([
      {
        path: 'root',
        module: Child,
        children: [
          Child,
          'literal' as any,
          { path: 'child', module: Child, children: [] },
        ],
      },
      { path: '', module: Child },
      { path: 'path' } as any,
    ]);
  });
});
