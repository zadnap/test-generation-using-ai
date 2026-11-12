/**
 * CFT checklist extracted from packages/core/injector/helpers/silent-logger.ts.
 * D counts atomic short-circuit decisions and loop/case guards. P = D + 1.
 * && evaluates the next condition only after T. || evaluates it only after F.
 * Each condition needs feasible T/F outcomes. Test inputs below exercise these paths.
 * This static checklist is separate from measured V8 branch coverage.
 * Optional chaining, nullish fallback and exceptional edges remain visible in the HTML report.
 * noop @L3 - D=0, P=1.
 */
import { describe, it } from 'vitest';
import { SilentLogger } from '../../../../../packages/core/injector/helpers/silent-logger.js';
describe('SilentLogger', () => {
  it('all noop methods', () => {
    const logger = new SilentLogger();
    logger.log();
    logger.error();
    logger.warn();
    logger.debug();
    logger.verbose();
    logger.fatal();
    logger.setLogLevels();
  });
});
