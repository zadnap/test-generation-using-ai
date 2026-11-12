/**
 * CFT checklist extracted from packages/core/errors/exceptions/circular-dependency.exception.ts.
 * D counts atomic short-circuit decisions and loop/case guards. P = D + 1.
 * && evaluates the next condition only after T. || evaluates it only after F.
 * Each condition needs feasible T/F outcomes. Test inputs below exercise these paths.
 * This static checklist is separate from measured V8 branch coverage.
 * Optional chaining, nullish fallback and exceptional edges remain visible in the HTML report.
 * CircularDependencyException.constructor @L4 - D=1, P=2.
 *   1=context
 */
import { describe, it } from 'vitest';
import { CircularDependencyException } from '../../../../../packages/core/errors/exceptions/circular-dependency.exception.js';

describe('CircularDependencyException.constructor', () => {
  it.each([() => [], () => ['Fixture']])('constructor path %#', input => {
    const error = new (CircularDependencyException as any)(...input());
    error.what();
  });
});
