/**
 * CFT checklist extracted from packages/core/errors/exceptions/invalid-middleware-configuration.exception.ts.
 * D counts atomic short-circuit decisions and loop/case guards. P = D + 1.
 * && evaluates the next condition only after T. || evaluates it only after F.
 * Each condition needs feasible T/F outcomes. Test inputs below exercise these paths.
 * This static checklist is separate from measured V8 branch coverage.
 * Optional chaining, nullish fallback and exceptional edges remain visible in the HTML report.
 * InvalidMiddlewareConfigurationException.constructor @L5 - D=0, P=1.
 */
import { describe, it } from 'vitest';
import { InvalidMiddlewareConfigurationException } from '../../../../../packages/core/errors/exceptions/invalid-middleware-configuration.exception.js';

describe('InvalidMiddlewareConfigurationException.constructor', () => {
  it.each([() => []])('constructor path %#', input => {
    const error = new (InvalidMiddlewareConfigurationException as any)(
      ...input(),
    );
    error.what();
  });
});
