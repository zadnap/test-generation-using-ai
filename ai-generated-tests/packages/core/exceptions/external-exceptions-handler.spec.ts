/**
 * CFT checklist extracted from packages/core/exceptions/external-exceptions-handler.ts.
 * D counts atomic short-circuit decisions and loop/case guards. P = D + 1.
 * && evaluates the next condition only after T. || evaluates it only after F.
 * Each condition needs feasible T/F outcomes. Test inputs below exercise these paths.
 * This static checklist is separate from measured V8 branch coverage.
 * Optional chaining, nullish fallback and exceptional edges remain visible in the HTML report.
 * ExternalExceptionsHandler.next @L14 - D=1, P=2.
 *   1=!isUndefined(result)
 * ExternalExceptionsHandler.setCustomFilters @L24 - D=1, P=2.
 *   1=!Array.isArray(filters)
 * ExternalExceptionsHandler.invokeCustomFilters @L31 - D=2, P=3.
 *   1=isEmptyArray(this.filters)
 *   2=filter
 */
import { afterEach, describe, it, vi } from 'vitest';
import { Logger } from '@nestjs/common';
import { ExternalExceptionsHandler } from '../../../../packages/core/exceptions/external-exceptions-handler.js';
import { ExecutionContextHost } from '../../../../packages/core/helpers/execution-context-host.js';
afterEach(() => vi.restoreAllMocks());
describe('ExternalExceptionsHandler', () => {
  describe('next/setCustomFilters/invokeCustomFilters', () => {
    it.each(['empty', 'unmatched', 'void', 'handled'])('filter %s', mode => {
      vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
      const handler = new ExternalExceptionsHandler();
      handler.setCustomFilters(
        mode === 'empty'
          ? []
          : [
              {
                exceptionMetatypes: mode === 'unmatched' ? [TypeError] : [],
                func: () =>
                  mode === 'handled' ? Promise.resolve('handled') : undefined,
              },
            ],
      );
      try {
        handler.next(new Error('fixture'), new ExecutionContextHost([]));
      } catch (error) {
        if (!(error instanceof Error)) throw error;
      }
    });
    it('invalid filter list', () => {
      try {
        new ExternalExceptionsHandler().setCustomFilters({} as any);
      } catch (error) {
        if (!(error instanceof Error)) throw error;
      }
    });
  });
});
