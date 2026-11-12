/**
 * CFT checklist extracted from packages/core/injector/helpers/is-debug-mode.util.ts.
 * D counts atomic short-circuit decisions and loop/case guards. P = D + 1.
 * && evaluates the next condition only after T. || evaluates it only after F.
 * Each condition needs feasible T/F outcomes. Test inputs below exercise these paths.
 * This static checklist is separate from measured V8 branch coverage.
 * Optional chaining, nullish fallback and exceptional edges remain visible in the HTML report.
 * isDebugMode @L1 - D=0, P=1.
 */
import { afterEach, describe, it, vi } from 'vitest';
import { isDebugMode } from '../../../../../packages/core/injector/helpers/is-debug-mode.util.js';
afterEach(() => vi.unstubAllEnvs());
describe('isDebugMode', () => {
  it.each([undefined, '1', ''])('NEST_DEBUG %s', value => {
    vi.stubEnv('NEST_DEBUG', value);
    isDebugMode();
  });
});
