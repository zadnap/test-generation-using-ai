/**
 * CFT checklist extracted from packages/core/errors/exceptions-zone.ts.
 * D counts atomic short-circuit decisions and loop/case guards. P = D + 1.
 * && evaluates the next condition only after T. || evaluates it only after F.
 * Each condition needs feasible T/F outcomes. Test inputs below exercise these paths.
 * This static checklist is separate from measured V8 branch coverage.
 * Optional chaining, nullish fallback and exceptional edges remain visible in the HTML report.
 * DEFAULT_TEARDOWN @L4 - D=0, P=1.
 * ExceptionsZone.run @L9 - D=1, P=2.
 *   1=autoFlushLogs
 * ExceptionsZone.asyncRun @L25 - D=1, P=2.
 *   1=autoFlushLogs
 */
import { afterEach, describe, it, vi } from 'vitest';
import { Logger } from '@nestjs/common';
import { ExceptionsZone } from '../../../../packages/core/errors/exceptions-zone.js';
afterEach(() => vi.restoreAllMocks());
describe('ExceptionsZone', () => {
  describe.each(['run', 'asyncRun'] as const)('%s', method => {
    it.each(['success', 'error no flush', 'error flush', 'default teardown'])(
      'callback %s',
      async mode => {
        vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
        vi.spyOn(Logger, 'flush').mockImplementation(() => undefined);
        vi.spyOn(process, 'exit').mockImplementation((() => undefined) as any);
        const callback = () => {
          if (mode !== 'success') throw new Error('fixture');
        };
        await ExceptionsZone[method](
          callback as any,
          mode === 'default teardown' ? undefined : () => undefined,
          mode === 'error flush',
        );
      },
    );
  });
});
