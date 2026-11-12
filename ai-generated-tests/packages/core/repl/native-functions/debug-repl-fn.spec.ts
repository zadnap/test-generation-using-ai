/**
 * CFT checklist extracted from packages/core/repl/native-functions/debug-repl-fn.ts.
 * D counts atomic short-circuit decisions and loop/case guards. P = D + 1.
 * && evaluates the next condition only after T. || evaluates it only after F.
 * Each condition needs feasible T/F outcomes. Test inputs below exercise these paths.
 * This static checklist is separate from measured V8 branch coverage.
 * Optional chaining, nullish fallback and exceptional edges remain visible in the HTML report.
 * DebugReplFn.action @L15 - D=4, P=5.
 *   1=moduleCls
 *   2=typeof moduleCls === 'function'
 *   3=!moduleEntry
 *   4=next iteration of Object.entries(this.ctx.debugRegistry)
 * DebugReplFn.printCtrlsAndProviders @L36 - D=0, P=1.
 * DebugReplFn.printCollection @L45 - D=1, P=2.
 *   1=collectionEntries.length <= 0
 * DebugReplFn.callback @L55 - D=0, P=1.
 */
import { describe, it, vi } from 'vitest';
import { DebugReplFn } from '../../../../../packages/core/repl/native-functions/debug-repl-fn.js';
describe('DebugReplFn', () => {
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
    const native = new DebugReplFn(ctx);
    native.action();
    native.action('Fixture');
    native.action(class Fixture {});
    native.action('missing');
    native.makeHelpMessage();
  });
});
