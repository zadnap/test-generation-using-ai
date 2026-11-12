/**
 * CFT checklist extracted from packages/core/router/router-proxy.ts.
 * D counts atomic short-circuit decisions and loop/case guards. P = D + 1.
 * && evaluates the next condition only after T. || evaluates it only after F.
 * Each condition needs feasible T/F outcomes. Test inputs below exercise these paths.
 * This static checklist is separate from measured V8 branch coverage.
 * Optional chaining, nullish fallback and exceptional edges remain visible in the HTML report.
 * RouterProxy.createProxy @L11 - D=0, P=1.
 * RouterProxy.callback @L15 - D=0, P=1.
 * RouterProxy.createExceptionLayerProxy @L30 - D=0, P=1.
 * RouterProxy.callback @L39 - D=0, P=1.
 */
import { describe, it, vi } from 'vitest';
import { RouterProxy } from '../../../../packages/core/router/router-proxy.js';

describe('RouterProxy', () => {
  describe.each(['createProxy', 'createExceptionLayerProxy'] as const)(
    '%s',
    method => {
      it.each(['success', 'sync error', 'async error'])(
        'callback %s',
        async mode => {
          const handler = () => {
            if (mode === 'sync error') throw new Error('fixture');
            if (mode === 'async error')
              return Promise.reject(new Error('fixture'));
          };
          const proxy = new RouterProxy()[method](handler, {
            next: vi.fn(),
          } as any);
          const args =
            method === 'createProxy'
              ? [{}, {}, vi.fn()]
              : [new Error('incoming'), {}, {}, vi.fn()];
          await (proxy as Function)(...args);
        },
      );
    },
  );
});
