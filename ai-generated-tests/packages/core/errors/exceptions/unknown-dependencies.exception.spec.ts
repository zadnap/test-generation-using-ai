/**
 * CFT checklist extracted from packages/core/errors/exceptions/unknown-dependencies.exception.ts.
 * D counts atomic short-circuit decisions and loop/case guards. P = D + 1.
 * && evaluates the next condition only after T. || evaluates it only after F.
 * Each condition needs feasible T/F outcomes. Test inputs below exercise these paths.
 * This static checklist is separate from measured V8 branch coverage.
 * Optional chaining, nullish fallback and exceptional edges remain visible in the HTML report.
 * UnknownDependenciesException.constructor @L9 - D=2, P=3.
 *   1c1=moduleRef | 1c2={ id: moduleRef.id }
 */
import { describe, it } from 'vitest';
import { UnknownDependenciesException } from '../../../../../packages/core/errors/exceptions/unknown-dependencies.exception.js';

describe('UnknownDependenciesException.constructor', () => {
  it.each([
    () => ['Fixture', { index: 0, dependencies: ['token'], name: 'token' }],
    () => [
      Symbol('fixture'),
      { index: 0, dependencies: [Object] },
      { id: 'fixture', metatype: class Root {} },
    ],
  ])('constructor path %#', input => {
    const error = new (UnknownDependenciesException as any)(...input());
    error.what();
  });
});
