import { describe, expect, it } from 'vitest';
import { Barrier } from '../../../../packages/core/helpers/barrier.js';

describe('Barrier', () => {
  it('xc1(T): resolves immediately when the target count is zero', async () => {
    const barrier = new Barrier(0);

    await expect(barrier.wait()).resolves.toBeUndefined();
  });

  it('xc1(F), xc2(F): waits until the target number of signals is reached', async () => {
    const barrier = new Barrier(2);
    let resolved = false;
    void barrier.wait().then(() => {
      resolved = true;
    });

    barrier.signal();
    await Promise.resolve();
    expect(resolved).toBe(false);

    barrier.signal();
    await expect(barrier.wait()).resolves.toBeUndefined();
  });

  it('xc2(T): resolves when the count exceeds the target', async () => {
    const barrier = new Barrier(1);

    barrier.signal();
    barrier.signal();

    await expect(barrier.wait()).resolves.toBeUndefined();
  });

  it('signalAndWait resolves once all participants signal', async () => {
    const barrier = new Barrier(2);

    const first = barrier.signalAndWait();
    const second = barrier.signalAndWait();

    await expect(Promise.all([first, second])).resolves.toEqual([
      undefined,
      undefined,
    ]);
  });
});
