/**
 * CFT checklist extracted from packages/core/errors/exceptions/undefined-dependency.exception.ts.
 * D counts atomic short-circuit decisions and loop/case guards. P = D + 1.
 * && evaluates the next condition only after T. || evaluates it only after F.
 * Each condition needs feasible T/F outcomes. Test inputs below exercise these paths.
 * This static checklist is separate from measured V8 branch coverage.
 * Optional chaining, nullish fallback and exceptional edges remain visible in the HTML report.
 * UndefinedDependencyException.constructor @L7 - D=0, P=1.
 */
import { describe, it } from 'vitest';
import { UndefinedDependencyException } from '../../../../../packages/core/errors/exceptions/undefined-dependency.exception.js';

describe('UndefinedDependencyException.constructor', () => {
  it.each([
    () => ['Fixture', { index: 0, dependencies: [undefined] }],
    () => ['Fixture', { index: 0, dependencies: [Object] }],
    () => ['Fixture', { key: 'field', name: 'token' }],
  ])('constructor path %#', input => {
    const error = new (UndefinedDependencyException as any)(...input());
    error.what();
  });
});
