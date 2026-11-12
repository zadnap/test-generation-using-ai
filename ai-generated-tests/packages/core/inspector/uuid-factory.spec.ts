/**
 * CFT checklist extracted from packages/core/inspector/uuid-factory.ts.
 * D counts atomic short-circuit decisions and loop/case guards. P = D + 1.
 * && evaluates the next condition only after T. || evaluates it only after F.
 * Each condition needs feasible T/F outcomes. Test inputs below exercise these paths.
 * This static checklist is separate from measured V8 branch coverage.
 * Optional chaining, nullish fallback and exceptional edges remain visible in the HTML report.
 * UuidFactory.mode @L12 - D=0, P=1.
 * UuidFactory.get @L16 - D=1, P=2.
 *   1=this._mode === UuidFactoryMode.Deterministic
 */
import { afterEach, describe, it } from 'vitest';
import {
  UuidFactory,
  UuidFactoryMode,
} from '../../../../packages/core/inspector/uuid-factory.js';
import { DeterministicUuidRegistry } from '../../../../packages/core/inspector/deterministic-uuid-registry.js';

describe('UuidFactory', () => {
  afterEach(() => {
    UuidFactory.mode = UuidFactoryMode.Random;
    DeterministicUuidRegistry.clear();
  });
  describe('mode/get', () => {
    it.each([UuidFactoryMode.Random, UuidFactoryMode.Deterministic])(
      'mode %s, 1(T/F)',
      mode => {
        UuidFactory.mode = mode;
        UuidFactory.get();
        UuidFactory.get('fixture');
      },
    );
  });
});
