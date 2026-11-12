/**
 * CFT checklist extracted from packages/core/repl/native-functions/help-repl-fn.ts.
 * D counts atomic short-circuit decisions and loop/case guards. P = D + 1.
 * && evaluates the next condition only after T. || evaluates it only after F.
 * Each condition needs feasible T/F outcomes. Test inputs below exercise these paths.
 * This static checklist is separate from measured V8 branch coverage.
 * Optional chaining, nullish fallback and exceptional edges remain visible in the HTML report.
 * HelpReplFn.callback @L13 - D=1, P=2.
 *   1=description
 * HelpReplFn.action @L17 - D=0, P=1.
 * HelpReplFn.callback @L19 - D=0, P=1.
 * HelpReplFn.callback @L21 - D=1, P=2.
 *   1=a.name < b.name
 */
import { describe, it, vi } from 'vitest';
import { HelpReplFn } from '../../../../../packages/core/repl/native-functions/help-repl-fn.js';
describe('HelpReplFn', () => {
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
    const native = new HelpReplFn(ctx);
    native.action();
    HelpReplFn.buildHelpMessage({
      name: 'fixture',
      signature: '()',
      description: '',
    });
    native.makeHelpMessage();
  });
});
