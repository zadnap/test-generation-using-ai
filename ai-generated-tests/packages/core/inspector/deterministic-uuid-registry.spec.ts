/**
 * CFT checklist extracted from packages/core/inspector/deterministic-uuid-registry.ts.
 * D counts atomic short-circuit decisions and loop/case guards. P = D + 1.
 * && evaluates the next condition only after T. || evaluates it only after F.
 * Each condition needs feasible T/F outcomes. Test inputs below exercise these paths.
 * This static checklist is separate from measured V8 branch coverage.
 * Optional chaining, nullish fallback and exceptional edges remain visible in the HTML report.
 * DeterministicUuidRegistry.get @L4 - D=2, P=3.
 *   1=inc
 *   2=this.registry.has(id)
 * DeterministicUuidRegistry.clear @L13 - D=0, P=1.
 * DeterministicUuidRegistry.hashCode @L17 - D=1, P=2.
 *   1=i < s.length
 */
import { afterEach, describe, it } from 'vitest';
import { DeterministicUuidRegistry } from '../../../../packages/core/inspector/deterministic-uuid-registry.js';

describe('DeterministicUuidRegistry', () => {
  afterEach(() => DeterministicUuidRegistry.clear());
  describe('get/hashCode/clear', () => {
    it('empty hash loop, collision recursion and explicit increment', () => {
      DeterministicUuidRegistry.clear();
      DeterministicUuidRegistry.get('');
      DeterministicUuidRegistry.get('');
      DeterministicUuidRegistry.get('');
      DeterministicUuidRegistry.get('fixture', 4);
    });
  });
});
