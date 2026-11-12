/**
 * CFT checklist extracted from packages/core/injector/topology-tree/topology-tree.ts.
 * D counts atomic short-circuit decisions and loop/case guards. P = D + 1.
 * && evaluates the next condition only after T. || evaluates it only after F.
 * Each condition needs feasible T/F outcomes. Test inputs below exercise these paths.
 * This static checklist is separate from measured V8 branch coverage.
 * Optional chaining, nullish fallback and exceptional edges remain visible in the HTML report.
 * TopologyTree.constructor @L13 - D=1, P=2.
 *   1=next iteration of order
 * TopologyTree.callback @L15 - D=0, P=1.
 * TopologyTree.callback @L23 - D=3, P=4.
 *   1c1=!child | 1c2=positions.get(child)! <= position
 *   2=(this.depths.get(child) ?? 0) < childDepth
 * TopologyTree.walk @L34 - D=0, P=1.
 * TopologyTree.callback @L35 - D=0, P=1.
 * TopologyTree.sortTopologically @L43 - D=0, P=1.
 * TopologyTree.visit @L46 - D=0, P=1.
 * TopologyTree.callback @L48 - D=2, P=3.
 *   1c1=child | 1c2=!visited.has(child)
 */
import { describe, it } from 'vitest';
import { TopologyTree } from '../../../../../packages/core/injector/topology-tree/topology-tree.js';
describe('TopologyTree', () => {
  describe('constructor/sortTopologically/walk', () => {
    it('leaf, diamond graph, unequal longest paths, null import and cycle', () => {
      const leaf: any = {};
      const branch: any = { imports: new Set([leaf]) };
      const root: any = { imports: new Set([leaf, branch, null]) };
      branch.imports.add(root);
      new TopologyTree(root).walk(() => undefined);
      new TopologyTree(leaf).walk(() => undefined);
    });
  });
});
