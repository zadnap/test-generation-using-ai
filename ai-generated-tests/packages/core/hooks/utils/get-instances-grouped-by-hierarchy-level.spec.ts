/**
 * CFT checklist extracted from packages/core/hooks/utils/get-instances-grouped-by-hierarchy-level.ts.
 * D counts atomic short-circuit decisions and loop/case guards. P = D + 1.
 * && evaluates the next condition only after T. || evaluates it only after F.
 * Each condition needs feasible T/F outcomes. Test inputs below exercise these paths.
 * This static checklist is separate from measured V8 branch coverage.
 * Optional chaining, nullish fallback and exceptional edges remain visible in the HTML report.
 * getInstancesGroupedByHierarchyLevel @L4 - D=6, P=7.
 *   1=next iteration of collections
 *   2=next iteration of collection
 *   3=!wrapper.isDependencyTreeStatic()
 *   4=!groupedByHierarchyLevel.has(level)
 *   5=wrapper.isTransient
 *   6=wrapper.instance
 * callback @L27 - D=0, P=1.
 * callback @L28 - D=0, P=1.
 */
import { describe, it } from 'vitest';
import { getInstancesGroupedByHierarchyLevel } from '../../../../../packages/core/hooks/utils/get-instances-grouped-by-hierarchy-level.js';
describe('getInstancesGroupedByHierarchyLevel', () => {
  it('empty/static/request/transient/missing instances and repeated level', () => {
    getInstancesGroupedByHierarchyLevel();
    const wrapper = (extra: any = {}) => ({
      hierarchyLevel: 1,
      instance: {},
      isDependencyTreeStatic: () => true,
      ...extra,
    });
    getInstancesGroupedByHierarchyLevel(
      new Map<any, any>([
        ['normal', wrapper()],
        ['empty', wrapper({ instance: null })],
        ['request', wrapper({ isDependencyTreeStatic: () => false })],
        [
          'transient',
          wrapper({
            hierarchyLevel: 2,
            isTransient: true,
            getStaticTransientInstances: () => [null, { instance: {} }],
          }),
        ],
      ]),
    );
  });
});
