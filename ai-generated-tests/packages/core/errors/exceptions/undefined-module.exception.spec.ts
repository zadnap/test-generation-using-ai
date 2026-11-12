/**
 * CFT checklist extracted from packages/core/errors/exceptions/undefined-module.exception.ts.
 * D counts atomic short-circuit decisions and loop/case guards. P = D + 1.
 * && evaluates the next condition only after T. || evaluates it only after F.
 * Each condition needs feasible T/F outcomes. Test inputs below exercise these paths.
 * This static checklist is separate from measured V8 branch coverage.
 * Optional chaining, nullish fallback and exceptional edges remain visible in the HTML report.
 * UndefinedModuleException.constructor @L5 - D=0, P=1.
 */
import { describe, it } from 'vitest';
import { UndefinedModuleException } from '../../../../../packages/core/errors/exceptions/undefined-module.exception.js';

describe('UndefinedModuleException.constructor', () => {
  it.each([
    () => [undefined, 0, []],
    () => [class Parent {}, 1, [class Scope {}]],
  ])('constructor path %#', input => {
    const error = new (UndefinedModuleException as any)(...input());
    error.what();
  });
});
