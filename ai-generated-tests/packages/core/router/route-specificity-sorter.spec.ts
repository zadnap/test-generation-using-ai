/**
 * CFT checklist extracted from packages/core/router/route-specificity-sorter.ts.
 * D counts atomic short-circuit decisions and loop/case guards. P = D + 1.
 * && evaluates the next condition only after T. || evaluates it only after F.
 * Each condition needs feasible T/F outcomes. Test inputs below exercise these paths.
 * This static checklist is separate from measured V8 branch coverage.
 * Optional chaining, nullish fallback and exceptional edges remain visible in the HTML report.
 * RouteSpecificitySorter.sort @L43 - D=0, P=1.
 * RouteSpecificitySorter.callback @L44 - D=0, P=1.
 * RouteSpecificitySorter.callback @L50 - D=1, P=2.
 *   1=specificityDelta !== 0
 * RouteSpecificitySorter.callback @L59 - D=0, P=1.
 * RouteSpecificitySorter.comparePathSpecificity @L62 - D=0, P=1.
 * RouteSpecificitySorter.callback @L76 - D=2, P=3.
 *   1=specificityDelta !== 0
 *   2=leftRank !== rightRank
 * RouteSpecificitySorter.getEndKind @L93 - D=1, P=2.
 *   1=segments.some(segment => segment.kind === 'wildcard')
 * RouteSpecificitySorter.callback @L94 - D=0, P=1.
 * RouteSpecificitySorter.rankSegmentByKind @L99 - D=0, P=1.
 */
import { describe, it } from 'vitest';
import { RouteSpecificitySorter } from '../../../../packages/core/router/route-specificity-sorter.js';

describe('RouteSpecificitySorter', () => {
  describe('sort/comparePathSpecificity/getEndKind/rankSegmentByKind', () => {
    it.each(
      [
        [],
        [
          '/a/:id',
          '/a/fixed',
          '/a/*path',
          '/a',
          '/a/v:version',
          '/a/:name',
          '/a/fixed/child',
        ],
        ['/a/*path', '/a/b/c', '/a{/:id}'],
      ].map(paths => ({ paths })),
    )('paths $paths', ({ paths }) => {
      RouteSpecificitySorter.sort(paths.map(path => ({ path }) as any));
    });
  });
});
