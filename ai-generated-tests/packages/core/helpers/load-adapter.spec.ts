/**
 * CFT checklist extracted from packages/core/helpers/load-adapter.ts.
 * D counts atomic short-circuit decisions and loop/case guards. P = D + 1.
 * && evaluates the next condition only after T. || evaluates it only after F.
 * Each condition needs feasible T/F outcomes. Test inputs below exercise these paths.
 * This static checklist is separate from measured V8 branch coverage.
 * Optional chaining, nullish fallback and exceptional edges remain visible in the HTML report.
 * MISSING_REQUIRED_DEPENDENCY @L3 - D=0, P=1.
 * loadAdapter @L11 - D=1, P=2.
 *   1=loaderFn
 */
import { afterEach, describe, it, vi } from 'vitest';
import { Logger } from '@nestjs/common';
import { loadAdapter } from '../../../../packages/core/helpers/load-adapter.js';
afterEach(() => vi.restoreAllMocks());
describe('loadAdapter', () => {
  it.each([
    undefined,
    () => ({}),
    () => {
      throw new Error('fixture');
    },
  ])('loader %s', async loader => {
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    vi.spyOn(process, 'exit').mockImplementation((() => undefined) as any);
    await loadAdapter('node:path', 'fixture', loader);
  });
});
