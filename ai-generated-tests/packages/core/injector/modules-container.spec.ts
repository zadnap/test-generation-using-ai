/**
 * CFT checklist extracted from packages/core/injector/modules-container.ts.
 * D counts atomic short-circuit decisions and loop/case guards. P = D + 1.
 * && evaluates the next condition only after T. || evaluates it only after F.
 * Each condition needs feasible T/F outcomes. Test inputs below exercise these paths.
 * This static checklist is separate from measured V8 branch coverage.
 * Optional chaining, nullish fallback and exceptional edges remain visible in the HTML report.
 * ModulesContainer.applicationId @L12 - D=0, P=1.
 * ModulesContainer.getById @L21 - D=0, P=1.
 * ModulesContainer.callback @L22 - D=0, P=1.
 * ModulesContainer.getRpcTargetRegistry @L30 - D=0, P=1.
 * ModulesContainer.addRpcTarget @L38 - D=0, P=1.
 */
import { describe, it } from 'vitest';
import { ModulesContainer } from '../../../../packages/core/injector/modules-container.js';
describe('ModulesContainer', () => {
  describe('applicationId/getById/getRpcTargetRegistry/addRpcTarget', () => {
    it('empty/present/absent module and registry', () => {
      const value = new ModulesContainer();
      value.applicationId;
      value.getById('missing');
      value.set('first', { id: 'first' } as any);
      value.getById('first');
      value.getById('missing');
      const subscription = value.getRpcTargetRegistry().subscribe();
      value.addRpcTarget({});
      subscription.unsubscribe();
    });
  });
});
