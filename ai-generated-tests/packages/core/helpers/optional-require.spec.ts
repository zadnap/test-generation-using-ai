/**
 * CFT checklist extracted from packages/core/helpers/optional-require.ts.
 * D counts atomic short-circuit decisions and loop/case guards. P = D + 1.
 * && evaluates the next condition only after T. || evaluates it only after F.
 * Each condition needs feasible T/F outcomes. Test inputs below exercise these paths.
 * This static checklist is separate from measured V8 branch coverage.
 * Optional chaining, nullish fallback and exceptional edges remain visible in the HTML report.
 * optionalRequire @L1 - D=1, P=2.
 *   1=loaderFn
 */
import { describe, it } from 'vitest';
import { optionalRequire } from '../../../../packages/core/helpers/optional-require.js';
describe('optionalRequire', () => {
  it.each([
    undefined,
    () => ({}),
    () => {
      throw new Error('fixture');
    },
  ])('loader %s', async loader => {
    await optionalRequire('node:path', loader);
  });
  it('missing package', async () => {
    await optionalRequire('missing-fixture-package');
  });
});
