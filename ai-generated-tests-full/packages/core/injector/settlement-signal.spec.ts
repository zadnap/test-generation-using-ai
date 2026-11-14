import { describe, expect, it } from 'vitest';
import { SettlementSignal } from '../../../../packages/core/injector/settlement-signal.js';

describe('SettlementSignal', () => {
  it('xc1(T): completes the pending promise', async () => {
    const signal = new SettlementSignal();

    signal.complete();

    await expect(signal.asPromise()).resolves.toBeUndefined();
  });

  it('xc2(T): resolves the pending promise with the error value', async () => {
    const signal = new SettlementSignal();
    const error = new Error('boom');

    signal.error(error);

    await expect(signal.asPromise()).resolves.toBe(error);
  });

  it('xc3(T): records refs before settlement', () => {
    const signal = new SettlementSignal();

    signal.insertRef({ id: 'a' });

    expect(signal.isCycle('a')).toBe(true);
  });

  it('xc3(F): ignores refs after settlement', () => {
    const signal = new SettlementSignal();
    signal.complete();

    signal.insertRef({ id: 'a' });

    expect(signal.isCycle('a')).toBe(false);
  });

  it('xc4(T): detects a transitive cycle through refs', () => {
    const signal = new SettlementSignal();
    const child = new SettlementSignal();
    signal.insertRef({ id: 'child', settlementSignal: child });
    child.insertRef({ id: 'leaf' });

    expect(signal.isCycle('leaf')).toBe(true);
  });

  it('xc4(F): returns false when the ref graph cannot reach the wrapper', () => {
    const signal = new SettlementSignal();
    const child = new SettlementSignal();
    signal.insertRef({ id: 'child', settlementSignal: child });

    expect(signal.isCycle('other')).toBe(false);
  });

  it('xc5(T): treats a settled signal as not part of a cycle', () => {
    const signal = new SettlementSignal();
    signal.insertRef({ id: 'a' });
    signal.complete();

    expect(signal.isCycle('a')).toBe(false);
  });

  it('xc5(F): avoids infinite recursion on visited signals', () => {
    const first = new SettlementSignal();
    const second = new SettlementSignal();
    first.insertRef({ id: 'second', settlementSignal: second });
    second.insertRef({ id: 'first', settlementSignal: first });

    expect(first.isCycle('unknown')).toBe(false);
  });

  it('returns false for an empty signal', () => {
    expect(new SettlementSignal().isCycle('a')).toBe(false);
  });
});
