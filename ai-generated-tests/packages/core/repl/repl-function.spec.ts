/**
 * CFT checklist extracted from packages/core/repl/repl-function.ts.
 * D counts atomic short-circuit decisions and loop/case guards. P = D + 1.
 * && evaluates the next condition only after T. || evaluates it only after F.
 * Each condition needs feasible T/F outcomes. Test inputs below exercise these paths.
 * This static checklist is separate from measured V8 branch coverage.
 * Optional chaining, nullish fallback and exceptional edges remain visible in the HTML report.
 * ReplFunction.constructor @L15 - D=0, P=1.
 * ReplFunction.makeHelpMessage @L27 - D=0, P=1.
 */
import { describe, it, vi } from 'vitest';
import { ReplFunction } from '../../../../packages/core/repl/repl-function.js';
describe('ReplFunction', () => {
  it('constructor and makeHelpMessage', () => {
    class Fixture extends ReplFunction {
      fnDefinition = {
        name: 'fixture',
        description: 'fixture',
        signature: '()',
      };
      action() {}
    }
    new Fixture({ logger: { log: vi.fn() } } as any).makeHelpMessage();
  });
});
