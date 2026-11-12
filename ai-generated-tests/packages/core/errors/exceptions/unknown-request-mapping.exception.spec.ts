/**
 * CFT checklist extracted from packages/core/errors/exceptions/unknown-request-mapping.exception.ts.
 * D counts atomic short-circuit decisions and loop/case guards. P = D + 1.
 * && evaluates the next condition only after T. || evaluates it only after F.
 * Each condition needs feasible T/F outcomes. Test inputs below exercise these paths.
 * This static checklist is separate from measured V8 branch coverage.
 * Optional chaining, nullish fallback and exceptional edges remain visible in the HTML report.
 * UnknownRequestMappingException.constructor @L6 - D=0, P=1.
 */
import { describe, it } from 'vitest';
import { UnknownRequestMappingException } from '../../../../../packages/core/errors/exceptions/unknown-request-mapping.exception.js';

describe('UnknownRequestMappingException.constructor', () => {
  it.each([
    () => [class Fixture {}],
    () => [Object.defineProperty(class {}, 'name', { value: '' })],
  ])('constructor path %#', input => {
    const error = new (UnknownRequestMappingException as any)(...input());
    error.what();
  });
});
