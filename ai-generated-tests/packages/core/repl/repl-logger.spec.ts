/**
 * CFT checklist extracted from packages/core/repl/repl-logger.ts.
 * D counts atomic short-circuit decisions and loop/case guards. P = D + 1.
 * && evaluates the next condition only after T. || evaluates it only after F.
 * Each condition needs feasible T/F outcomes. Test inputs below exercise these paths.
 * This static checklist is separate from measured V8 branch coverage.
 * Optional chaining, nullish fallback and exceptional edges remain visible in the HTML report.
 * ReplLogger.log @L13 - D=1, P=2.
 *   1=ReplLogger.ignoredContexts.includes(context!)
 */
import { afterEach, describe, it, vi } from 'vitest';
import { ConsoleLogger } from '@nestjs/common';
import { ReplLogger } from '../../../../packages/core/repl/repl-logger.js';
afterEach(() => vi.restoreAllMocks());
describe('ReplLogger.log', () => {
  it.each([
    undefined,
    'RoutesResolver',
    'RouterExplorer',
    'NestApplication',
    'Fixture',
  ])('context %s', context => {
    vi.spyOn(ConsoleLogger.prototype, 'log').mockImplementation(
      () => undefined,
    );
    new ReplLogger().log('fixture', context);
  });
});
