/**
 * CFT checklist extracted from packages/core/helpers/barrier.ts.
 * D counts atomic short-circuit decisions and loop/case guards. P = D + 1.
 * && evaluates the next condition only after T. || evaluates it only after F.
 * Each condition needs feasible T/F outcomes. Test inputs below exercise these paths.
 * This static checklist is separate from measured V8 branch coverage.
 * Optional chaining, nullish fallback and exceptional edges remain visible in the HTML report.
 * Barrier.constructor @L10 - D=1, P=2.
 *   1=targetCount === 0
 * Barrier.callback @L14 - D=0, P=1.
 * Barrier.signal @L28 - D=1, P=2.
 *   1=this.currentCount >= this.targetCount
 * Barrier.wait @L40 - D=0, P=1.
 * Barrier.signalAndWait @L51 - D=0, P=1.
 */
import { describe, it } from 'vitest';
import { Barrier } from '../../../../packages/core/helpers/barrier.js';

describe('Barrier', () => {
  describe('constructor/wait', () => {
    it('zero participants, 1(T)', async () => {
      await new Barrier(0).wait();
    });
  });
  describe('signal', () => {
    it('below/at/above target, 1(F/T)', async () => {
      const barrier = new Barrier(2);
      barrier.signal();
      barrier.signal();
      barrier.signal();
      await barrier.wait();
    });
  });
  describe('signalAndWait', () => {
    it('releases concurrent participants', async () => {
      const barrier = new Barrier(2);
      await Promise.all([barrier.signalAndWait(), barrier.signalAndWait()]);
    });
  });
});
