/**
 * CFT checklist extracted from packages/core/errors/exceptions/invalid-class-scope.exception.ts.
 * D counts atomic short-circuit decisions and loop/case guards. P = D + 1.
 * && evaluates the next condition only after T. || evaluates it only after F.
 * Each condition needs feasible T/F outcomes. Test inputs below exercise these paths.
 * This static checklist is separate from measured V8 branch coverage.
 * Optional chaining, nullish fallback and exceptional edges remain visible in the HTML report.
 * InvalidClassScopeException.constructor @L7 - D=3, P=4.
 *   1=isFunction(metatypeOrToken)
 *   2c1=name | 2c2=name.toString()
 */
import { describe, it } from 'vitest';
import { InvalidClassScopeException } from '../../../../../packages/core/errors/exceptions/invalid-class-scope.exception.js';

describe('InvalidClassScopeException.constructor', () => {
  it.each([() => [class Fixture {}], () => [Symbol('fixture')], () => ['']])(
    'constructor path %#',
    input => {
      const error = new (InvalidClassScopeException as any)(...input());
      error.what();
    },
  );
});
