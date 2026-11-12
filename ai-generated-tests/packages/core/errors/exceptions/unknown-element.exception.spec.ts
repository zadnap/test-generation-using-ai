/**
 * CFT checklist extracted from packages/core/errors/exceptions/unknown-element.exception.ts.
 * D counts atomic short-circuit decisions and loop/case guards. P = D + 1.
 * && evaluates the next condition only after T. || evaluates it only after F.
 * Each condition needs feasible T/F outcomes. Test inputs below exercise these paths.
 * This static checklist is separate from measured V8 branch coverage.
 * Optional chaining, nullish fallback and exceptional edges remain visible in the HTML report.
 * UnknownElementException.constructor @L4 - D=4, P=5.
 *   1c1=name | 1c2=name.toString()
 *   2c1=name | 2c2='given'
 */
import { describe, it } from 'vitest';
import { UnknownElementException } from '../../../../../packages/core/errors/exceptions/unknown-element.exception.js';

describe('UnknownElementException.constructor', () => {
  it.each([() => [], () => [Symbol('fixture')]])(
    'constructor path %#',
    input => {
      const error = new (UnknownElementException as any)(...input());
      error.what();
    },
  );
});
