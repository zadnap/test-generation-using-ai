/**
 * CFT checklist extracted from packages/core/errors/exceptions/invalid-provider.exception.ts.
 * D counts atomic short-circuit decisions and loop/case guards. P = D + 1.
 * && evaluates the next condition only after T. || evaluates it only after F.
 * Each condition needs feasible T/F outcomes. Test inputs below exercise these paths.
 * This static checklist is separate from measured V8 branch coverage.
 * Optional chaining, nullish fallback and exceptional edges remain visible in the HTML report.
 * InvalidProviderException.constructor @L6 - D=0, P=1.
 */
import { describe, it } from 'vitest';
import { InvalidProviderException } from '../../../../../packages/core/errors/exceptions/invalid-provider.exception.js';

describe('InvalidProviderException.constructor', () => {
  it.each([
    () => ['token', 'Fixture'],
    () => [undefined, 'Fixture'],
    () => [class Provider {}, 'Fixture'],
    () => [Symbol('token'), 'Fixture'],
  ])('constructor path %#', input => {
    const error = new (InvalidProviderException as any)(...input());
    error.what();
  });
});
