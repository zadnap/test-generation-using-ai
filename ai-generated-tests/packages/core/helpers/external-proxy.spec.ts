/**
 * CFT checklist extracted from packages/core/helpers/external-proxy.ts.
 * D counts atomic short-circuit decisions and loop/case guards. P = D + 1.
 * && evaluates the next condition only after T. || evaluates it only after F.
 * Each condition needs feasible T/F outcomes. Test inputs below exercise these paths.
 * This static checklist is separate from measured V8 branch coverage.
 * Optional chaining, nullish fallback and exceptional edges remain visible in the HTML report.
 * ExternalErrorProxy.createProxy @L6 - D=0, P=1.
 * ExternalErrorProxy.callback @L11 - D=0, P=1.
 */
import { describe, it, vi } from 'vitest';
import { ExternalErrorProxy } from '../../../../packages/core/helpers/external-proxy.js';

describe('ExternalErrorProxy.createProxy', () => {
  it.each([false, true])('callback throws %s', async throws => {
    const callback = () => {
      if (throws) throw new Error('fixture');
      return 1;
    };
    await new ExternalErrorProxy().createProxy(
      callback,
      { next: vi.fn() } as any,
      'rpc',
    )(1, 2);
  });
});
