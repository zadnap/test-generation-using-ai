/**
 * CFT checklist extracted from packages/core/helpers/class-ref-registry.ts.
 * D counts atomic short-circuit decisions and loop/case guards. P = D + 1.
 * && evaluates the next condition only after T. || evaluates it only after F.
 * Each condition needs feasible T/F outcomes. Test inputs below exercise these paths.
 * This static checklist is separate from measured V8 branch coverage.
 * Optional chaining, nullish fallback and exceptional edges remain visible in the HTML report.
 * registerClassRef @L9 - D=1, P=2.
 *   1=classRef.prototype
 * getClassRef @L19 - D=0, P=1.
 */
import { describe, it } from 'vitest';
import {
  registerClassRef,
  getClassRef,
} from '../../../../packages/core/helpers/class-ref-registry.js';

describe('class reference registry', () => {
  describe('registerClassRef/getClassRef', () => {
    it('class with prototype, arrow without prototype, registered and fallback instances', () => {
      class Registered {}
      class Other {}
      registerClassRef(Registered);
      registerClassRef(() => undefined);
      getClassRef(new Registered());
      getClassRef(new Other());
    });
  });
});
