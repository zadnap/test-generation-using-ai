/**
 * CFT checklist extracted from packages/core/repl/native-functions/resolve-repl-fn.ts.
 * D counts atomic short-circuit decisions and loop/case guards. P = D + 1.
 * && evaluates the next condition only after T. || evaluates it only after F.
 * Each condition needs feasible T/F outcomes. Test inputs below exercise these paths.
 * This static checklist is separate from measured V8 branch coverage.
 * Optional chaining, nullish fallback and exceptional edges remain visible in the HTML report.
 * ResolveReplFn.action @L13 - D=0, P=1.
 */
import { describe, it, vi } from 'vitest';
import { ResolveReplFn } from '../../../../../packages/core/repl/native-functions/resolve-repl-fn.js';
describe('ResolveReplFn', () => {
  it('constructor/action/helper paths', async () => {
    const ctx: any = {
      logger: { error: vi.fn() },
      writeToStdout: vi.fn(),
      debugRegistry: {
        Fixture: {
          controllers: {},
          providers: { Provider: class Provider {} },
        },
      },
      nativeFunctions: new Map([
        ['z', { fnDefinition: { name: 'z', description: 'fixture' } }],
        ['a', { fnDefinition: { name: 'a', description: 'fixture' } }],
      ]),
      app: {
        get: () => ({ handle() {} }),
        resolve: async () => ({}),
        select: () => ({}),
      },
    };
    const native = new ResolveReplFn(ctx);
    await native.action('fixture', { id: 1 });
    native.makeHelpMessage();
  });
});
