/**
 * CFT checklist extracted from packages/core/errors/exceptions/invalid-class.exception.ts.
 * D counts atomic short-circuit decisions and loop/case guards. P = D + 1.
 * && evaluates the next condition only after T. || evaluates it only after F.
 * Each condition needs feasible T/F outcomes. Test inputs below exercise these paths.
 * This static checklist is separate from measured V8 branch coverage.
 * Optional chaining, nullish fallback and exceptional edges remain visible in the HTML report.
 * InvalidClassException.constructor @L5 - D=0, P=1.
 */
import { describe, it } from 'vitest';
import { InvalidClassException } from '../../../../../packages/core/errors/exceptions/invalid-class.exception.js';

describe('InvalidClassException.constructor', () => {
  it.each([() => ['fixture']])('constructor path %#', input => {
    const error = new (InvalidClassException as any)(...input());
    error.what();
  });
});
