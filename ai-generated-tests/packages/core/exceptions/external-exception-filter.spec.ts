/**
 * CFT checklist extracted from packages/core/exceptions/external-exception-filter.ts.
 * D counts atomic short-circuit decisions and loop/case guards. P = D + 1.
 * && evaluates the next condition only after T. || evaluates it only after F.
 * Each condition needs feasible T/F outcomes. Test inputs below exercise these paths.
 * This static checklist is separate from measured V8 branch coverage.
 * Optional chaining, nullish fallback and exceptional edges remain visible in the HTML report.
 * ExternalExceptionFilter.catch @L6 - D=2, P=3.
 *   1c1=exception instanceof Error | 1c2=!(exception instanceof IntrinsicException)
 */
import { afterEach, describe, it, vi } from 'vitest';
import { IntrinsicException, Logger } from '@nestjs/common';
import { ExternalExceptionFilter } from '../../../../packages/core/exceptions/external-exception-filter.js';
import { ExecutionContextHost } from '../../../../packages/core/helpers/execution-context-host.js';
afterEach(() => vi.restoreAllMocks());
describe('ExternalExceptionFilter.catch', () => {
  it.each([new Error('fixture'), new IntrinsicException(), 'plain'])(
    'exception %s',
    error => {
      vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
      try {
        new ExternalExceptionFilter().catch(
          error,
          new ExecutionContextHost([]),
        );
      } catch (caught) {
        if (caught !== error) throw caught;
      }
    },
  );
});
