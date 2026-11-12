/**
 * CFT checklist extracted from packages/core/errors/exceptions/runtime.exception.ts.
 * D counts atomic short-circuit decisions and loop/case guards. P = D + 1.
 * && evaluates the next condition only after T. || evaluates it only after F.
 * Each condition needs feasible T/F outcomes. Test inputs below exercise these paths.
 * This static checklist is separate from measured V8 branch coverage.
 * Optional chaining, nullish fallback and exceptional edges remain visible in the HTML report.
 * RuntimeException.constructor @L2 - D=0, P=1.
 * RuntimeException.what @L6 - D=0, P=1.
 */
import { describe, it } from 'vitest';
import { RuntimeException } from '../../../../../packages/core/errors/exceptions/runtime.exception.js';

describe('RuntimeException.constructor', () => {
  it.each([() => [], () => ['fixture']])('constructor path %#', input => {
    const error = new (RuntimeException as any)(...input());
    error.what();
  });
});
