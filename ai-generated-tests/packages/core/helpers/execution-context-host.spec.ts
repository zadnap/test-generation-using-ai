/**
 * CFT checklist extracted from packages/core/helpers/execution-context-host.ts.
 * D counts atomic short-circuit decisions and loop/case guards. P = D + 1.
 * && evaluates the next condition only after T. || evaluates it only after F.
 * Each condition needs feasible T/F outcomes. Test inputs below exercise these paths.
 * This static checklist is separate from measured V8 branch coverage.
 * Optional chaining, nullish fallback and exceptional edges remain visible in the HTML report.
 * ExecutionContextHost.constructor @L12 - D=0, P=1.
 * ExecutionContextHost.setType @L18 - D=2, P=3.
 *   1c1=type | 1c2=this.contextType = type
 * ExecutionContextHost.getType @L22 - D=0, P=1.
 * ExecutionContextHost.getClass @L26 - D=0, P=1.
 * ExecutionContextHost.getHandler @L30 - D=0, P=1.
 * ExecutionContextHost.getArgs @L34 - D=0, P=1.
 * ExecutionContextHost.getArgByIndex @L38 - D=0, P=1.
 * ExecutionContextHost.switchToRpc @L42 - D=0, P=1.
 * ExecutionContextHost.callback @L44 - D=0, P=1.
 * ExecutionContextHost.callback @L45 - D=0, P=1.
 * ExecutionContextHost.switchToHttp @L49 - D=0, P=1.
 * ExecutionContextHost.callback @L51 - D=0, P=1.
 * ExecutionContextHost.callback @L52 - D=0, P=1.
 * ExecutionContextHost.callback @L53 - D=0, P=1.
 * ExecutionContextHost.switchToWs @L57 - D=0, P=1.
 * ExecutionContextHost.callback @L59 - D=0, P=1.
 * ExecutionContextHost.callback @L60 - D=0, P=1.
 * ExecutionContextHost.callback @L61 - D=0, P=1.
 */
import { describe, it } from 'vitest';
import { ExecutionContextHost } from '../../../../packages/core/helpers/execution-context-host.js';

describe('ExecutionContextHost', () => {
  describe('constructor and accessors', () => {
    it.each(
      [[], [{}, {}, () => undefined], ['client', 'data', 'pattern']].map(
        args => ({ args }),
      ),
    )('reads arguments $args', ({ args }) => {
      const host = new ExecutionContextHost(
        args,
        class Controller {},
        () => undefined,
      );
      host.getClass();
      host.getHandler();
      host.getArgs();
      host.getArgByIndex(0);
      host.getArgByIndex(10);
    });
  });
  describe('setType/getType', () => {
    // 1(T/F), two independent paths. A falsy type preserves the default.
    it.each(['rpc', 'ws', ''])('sets type %s', type => {
      const host = new ExecutionContextHost([]);
      host.setType(type);
      host.getType();
    });
  });
  describe.each([[], [1, 2, 3]].map(args => ({ args })))(
    'host adapters for $args',
    ({ args }) => {
      it('switchToHttp', () => {
        const host = new ExecutionContextHost(args).switchToHttp();
        host.getRequest();
        host.getResponse();
        host.getNext();
      });
      it('switchToRpc', () => {
        const host = new ExecutionContextHost(args).switchToRpc();
        host.getData();
        host.getContext();
      });
      it('switchToWs', () => {
        const host = new ExecutionContextHost(args).switchToWs();
        host.getClient();
        host.getData();
        host.getPattern();
      });
    },
  );
});
