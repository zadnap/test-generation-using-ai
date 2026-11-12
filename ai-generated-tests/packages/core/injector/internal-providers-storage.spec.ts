/**
 * CFT checklist extracted from packages/core/injector/internal-providers-storage.ts.
 * D counts atomic short-circuit decisions and loop/case guards. P = D + 1.
 * && evaluates the next condition only after T. || evaluates it only after F.
 * Each condition needs feasible T/F outcomes. Test inputs below exercise these paths.
 * This static checklist is separate from measured V8 branch coverage.
 * Optional chaining, nullish fallback and exceptional edges remain visible in the HTML report.
 * InternalProvidersStorage.httpAdapterHost @L8 - D=0, P=1.
 * InternalProvidersStorage.httpAdapter @L12 - D=0, P=1.
 * InternalProvidersStorage.httpAdapter @L16 - D=0, P=1.
 */
import { describe, it } from 'vitest';
import { InternalProvidersStorage } from '../../../../packages/core/injector/internal-providers-storage.js';
describe('InternalProvidersStorage accessors', () => {
  it('reads defaults and assigned adapter', () => {
    const value = new InternalProvidersStorage();
    value.httpAdapterHost;
    value.httpAdapter;
    value.httpAdapter = {} as any;
    value.httpAdapter;
  });
});
