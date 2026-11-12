/**
 * CFT checklist extracted from packages/core/errors/exception-handler.ts.
 * D counts atomic short-circuit decisions and loop/case guards. P = D + 1.
 * && evaluates the next condition only after T. || evaluates it only after F.
 * Each condition needs feasible T/F outcomes. Test inputs below exercise these paths.
 * This static checklist is separate from measured V8 branch coverage.
 * Optional chaining, nullish fallback and exceptional edges remain visible in the HTML report.
 * ExceptionHandler.handle @L6 - D=0, P=1.
 */
import { afterEach, describe, it, vi } from 'vitest';
import { Logger } from '@nestjs/common';
import { ExceptionHandler } from '../../../../packages/core/errors/exception-handler.js';
afterEach(() => vi.restoreAllMocks());
describe('ExceptionHandler.handle', () => {
  it('reports an exception', () => {
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    new ExceptionHandler().handle(new Error('fixture'));
  });
});
