/**
 * CFT checklist extracted from packages/core/repl/repl-native-commands.ts.
 * D counts atomic short-circuit decisions and loop/case guards. P = D + 1.
 * && evaluates the next condition only after T. || evaluates it only after F.
 * Each condition needs feasible T/F outcomes. Test inputs below exercise these paths.
 * This static checklist is separate from measured V8 branch coverage.
 * Optional chaining, nullish fallback and exceptional edges remain visible in the HTML report.
 * listAllCommands @L9 - D=0, P=1.
 * callback @L12 - D=3, P=4.
 *   1=cmd
 *   2c1=cmd.help | 2c2=''
 * defineDefaultCommandsOnRepl @L20 - D=0, P=1.
 * action @L23 - D=4, P=5.
 *   1=name
 *   2c1=this.commands[name] | 2c2=this.context[name]
 *   3=helpMessage
 */
import { describe, it, vi } from 'vitest';
import { defineDefaultCommandsOnRepl } from '../../../../packages/core/repl/repl-native-commands.js';
describe('defineDefaultCommandsOnRepl/listAllCommands', () => {
  it('help for native command, context function, missing command and all commands', () => {
    let action: Function = () => undefined;
    const server: any = {
      commands: {
        withHelp: { help: 'fixture' },
        withoutHelp: {},
        missing: undefined,
      },
      context: { help: vi.fn(), custom: { help: undefined } },
      output: { write: vi.fn() },
      clearBufferedCommand: vi.fn(),
      displayPrompt: vi.fn(),
      defineCommand: (_name: string, definition: any) => {
        action = definition.action;
      },
    };
    defineDefaultCommandsOnRepl(server);
    for (const name of [
      'withHelp',
      'withoutHelp',
      'custom',
      'absent',
      undefined,
    ])
      action.call(server, name);
  });
});
