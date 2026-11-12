/**
 * CFT checklist extracted from packages/core/errors/exceptions/unknown-module.exception.ts.
 * D counts atomic short-circuit decisions and loop/case guards. P = D + 1.
 * && evaluates the next condition only after T. || evaluates it only after F.
 * Each condition needs feasible T/F outcomes. Test inputs below exercise these paths.
 * This static checklist is separate from measured V8 branch coverage.
 * Optional chaining, nullish fallback and exceptional edges remain visible in the HTML report.
 * UnknownModuleException.constructor @L4 - D=1, P=2.
 *   1=moduleName
 */
import { describe, it } from 'vitest';
import { UnknownModuleException } from '../../../../../packages/core/errors/exceptions/unknown-module.exception.js';

describe('UnknownModuleException.constructor', () => {
  it.each([() => [], () => ['Fixture']])('constructor path %#', input => {
    const error = new (UnknownModuleException as any)(...input());
    error.what();
  });
});
