/**
 * CFT checklist extracted from packages/core/repl/native-functions/select-relp-fn.ts.
 * D counts atomic short-circuit decisions and loop/case guards. P = D + 1.
 * && evaluates the next condition only after T. || evaluates it only after F.
 * Each condition needs feasible T/F outcomes. Test inputs below exercise these paths.
 * This static checklist is separate from measured V8 branch coverage.
 * Optional chaining, nullish fallback and exceptional edges remain visible in the HTML report.
 * SelectReplFn.action @L17 - D=0, P=1.
 */
import { describe, it, vi } from 'vitest';
import { SelectReplFn } from '../../../../../packages/core/repl/native-functions/select-relp-fn.js';
describe('SelectReplFn', () => {
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
    const native = new SelectReplFn(ctx);
    native.action(class Fixture {});
    native.makeHelpMessage();
  });
});
