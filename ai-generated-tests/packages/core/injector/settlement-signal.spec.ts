/**
 * CFT checklist extracted from packages/core/injector/settlement-signal.ts.
 * D counts atomic short-circuit decisions and loop/case guards. P = D + 1.
 * && evaluates the next condition only after T. || evaluates it only after F.
 * Each condition needs feasible T/F outcomes. Test inputs below exercise these paths.
 * This static checklist is separate from measured V8 branch coverage.
 * Optional chaining, nullish fallback and exceptional edges remain visible in the HTML report.
 * SettlementSignal.constructor @L20 - D=0, P=1.
 * SettlementSignal.callback @L21 - D=0, P=1.
 * SettlementSignal.complete @L29 - D=0, P=1.
 * SettlementSignal.error @L38 - D=0, P=1.
 * SettlementSignal.asPromise @L47 - D=0, P=1.
 * SettlementSignal.insertRef @L55 - D=1, P=2.
 *   1=!this.completed
 * SettlementSignal.isCycle @L68 - D=0, P=1.
 * SettlementSignal.markSettled @L77 - D=0, P=1.
 * SettlementSignal.waitsOn @L82 - D=5, P=6.
 *   1c1=this.completed | 1c2=visited.has(this)
 *   2=next iteration of this._refs
 *   3c1=refId === wrapperId | 3c2=ref.settlementSignal?.waitsOn(wrapperId, visited)
 */
import { describe, it } from 'vitest';
import { SettlementSignal } from '../../../../packages/core/injector/settlement-signal.js';

describe('SettlementSignal', () => {
  describe('insertRef/isCycle/waitsOn', () => {
    it('empty, direct, transitive, repeated, completed and absent dependencies', () => {
      const first = new SettlementSignal();
      const second = new SettlementSignal();
      const completed = new SettlementSignal();
      completed.complete();
      first.isCycle('missing');
      first.insertRef({ id: 'second', settlementSignal: second });
      first.insertRef({ id: 'settled', settlementSignal: completed });
      first.insertRef({ id: 'leaf' });
      second.insertRef({ id: 'first', settlementSignal: first });
      second.insertRef({ id: 'target' });
      first.isCycle('second');
      first.isCycle('target');
      first.isCycle('missing');
      first.complete();
      first.insertRef({ id: 'late' });
      first.isCycle('late');
    });
  });
  describe('complete/error/asPromise/markSettled', () => {
    it.each(['complete', 'error'] as const)(
      'settles using %s',
      async method => {
        const signal = new SettlementSignal();
        if (method === 'complete') signal.complete();
        else signal.error(new Error('fixture'));
        await signal.asPromise();
      },
    );
  });
});
