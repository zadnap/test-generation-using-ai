/**
 * CFT checklist extracted from packages/core/exceptions/exceptions-handler.ts.
 * D counts atomic short-circuit decisions and loop/case guards. P = D + 1.
 * && evaluates the next condition only after T. || evaluates it only after F.
 * Each condition needs feasible T/F outcomes. Test inputs below exercise these paths.
 * This static checklist is separate from measured V8 branch coverage.
 * Optional chaining, nullish fallback and exceptional edges remain visible in the HTML report.
 * ExceptionsHandler.next @L15 - D=1, P=2.
 *   1=this.invokeCustomFilters(exception, ctx)
 * ExceptionsHandler.setCustomFilters @L22 - D=1, P=2.
 *   1=!Array.isArray(filters)
 * ExceptionsHandler.invokeCustomFilters @L29 - D=3, P=4.
 *   1=isEmptyArray(this.filters)
 *   2=!filter
 *   3=isObservable(result)
 */
import { afterEach, describe, it, vi } from 'vitest';
import { HttpException, Logger } from '@nestjs/common';
import { of } from 'rxjs';
import { ExceptionsHandler } from '../../../../packages/core/exceptions/exceptions-handler.js';
import { ExecutionContextHost } from '../../../../packages/core/helpers/execution-context-host.js';
afterEach(() => vi.restoreAllMocks());
describe('ExceptionsHandler', () => {
  describe('next/setCustomFilters/invokeCustomFilters', () => {
    it.each([
      'empty',
      'unmatched',
      'normal',
      'observable unsent',
      'observable sent',
    ])('filters %s', mode => {
      vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
      const handler = new ExceptionsHandler({
        isHeadersSent: () => mode === 'observable sent',
        reply: vi.fn(),
        end: vi.fn(),
      } as any);
      const metadata =
        mode === 'empty'
          ? []
          : [
              {
                exceptionMetatypes: mode === 'unmatched' ? [TypeError] : [],
                func: () => (mode.startsWith('observable') ? of(1) : undefined),
              },
            ];
      handler.setCustomFilters(metadata);
      handler.next(
        new HttpException('fixture', 400),
        new ExecutionContextHost([{}, {}]),
      );
    });
    it('invalid filter list', () => {
      try {
        new ExceptionsHandler().setCustomFilters(null as any);
      } catch (error) {
        if (!(error instanceof Error)) throw error;
      }
    });
    it('observable filter without adapter', () => {
      const handler = new ExceptionsHandler();
      handler.setCustomFilters([{ exceptionMetatypes: [], func: () => of(1) }]);
      handler.invokeCustomFilters(
        new Error('fixture'),
        new ExecutionContextHost([{}, {}]),
      );
    });
  });
});
