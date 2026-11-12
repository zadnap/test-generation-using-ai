/**
 * CFT checklist extracted from packages/core/middleware/resolver.ts.
 * D counts atomic short-circuit decisions and loop/case guards. P = D + 1.
 * && evaluates the next condition only after T. || evaluates it only after F.
 * Each condition needs feasible T/F outcomes. Test inputs below exercise these paths.
 * This static checklist is separate from measured V8 branch coverage.
 * Optional chaining, nullish fallback and exceptional edges remain visible in the HTML report.
 * MiddlewareResolver.constructor @L8 - D=0, P=1.
 * MiddlewareResolver.resolveInstances @L13 - D=0, P=1.
 * MiddlewareResolver.resolveInstance @L16 - D=0, P=1.
 * MiddlewareResolver.resolveMiddlewareInstance @L21 - D=0, P=1.
 */
import { describe, it, vi } from 'vitest';
import { MiddlewareResolver } from '../../../../packages/core/middleware/resolver.js';
describe('MiddlewareResolver', () => {
  it('resolveInstances/resolveMiddlewareInstance', async () => {
    await new MiddlewareResolver(
      { getMiddlewareCollection: () => new Map([['fixture', {}]]) } as any,
      { loadMiddleware: vi.fn() } as any,
    ).resolveInstances({} as any, 'fixture');
  });
});
