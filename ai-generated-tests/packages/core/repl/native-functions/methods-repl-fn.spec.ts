/**
 * CFT checklist extracted from packages/core/repl/native-functions/methods-repl-fn.ts.
 * D counts atomic short-circuit decisions and loop/case guards. P = D + 1.
 * && evaluates the next condition only after T. || evaluates it only after F.
 * Each condition needs feasible T/F outcomes. Test inputs below exercise these paths.
 * This static checklist is separate from measured V8 branch coverage.
 * Optional chaining, nullish fallback and exceptional edges remain visible in the HTML report.
 * MethodsReplFn.action @L17 - D=1, P=2.
 *   1=typeof token !== 'function'
 * MethodsReplFn.callback @L27 - D=0, P=1.
 */
import { describe, it, vi } from 'vitest';
import { MethodsReplFn } from '../../../../../packages/core/repl/native-functions/methods-repl-fn.js';
describe('MethodsReplFn', () => {
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
    const native = new MethodsReplFn(ctx);
    class Fixture {
      handle() {}
    }
    native.action(Fixture);
    native.action('fixture');
    native.makeHelpMessage();
  });
});
