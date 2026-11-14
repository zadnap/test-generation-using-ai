import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { ExecutionContextHost } from '../../../../packages/core/helpers/execution-context-host.js';
import { GuardsConsumer } from '../../../../packages/core/guards/guards-consumer.js';

class Controller {}

describe('GuardsConsumer', () => {
  it('xc1(T): allows activation without guards', async () => {
    const consumer = new GuardsConsumer();

    await expect(
      consumer.tryActivate([], [], new Controller(), () => undefined),
    ).resolves.toBe(true);
    await expect(
      consumer.tryActivate(undefined as any, [], new Controller(), () => undefined),
    ).resolves.toBe(true);
  });

  it('xc1(F), xc2(T): allows activation when every guard returns true', async () => {
    const consumer = new GuardsConsumer();
    const guard = { canActivate: vi.fn(() => true) };

    await expect(
      consumer.tryActivate([guard], [], new Controller(), () => undefined),
    ).resolves.toBe(true);
    expect(guard.canActivate).toHaveBeenCalled();
  });

  it('xc2(F), xc3(T): denies activation when a guard returns false', async () => {
    const consumer = new GuardsConsumer();
    const guard = { canActivate: () => false };

    await expect(
      consumer.tryActivate([guard], [], new Controller(), () => undefined),
    ).resolves.toBe(false);
  });

  it('xc3(F), xc4(T): awaits a promise result', async () => {
    const consumer = new GuardsConsumer();
    const guard = { canActivate: async () => true };

    await expect(
      consumer.tryActivate([guard], [], new Controller(), () => undefined),
    ).resolves.toBe(true);
  });

  it('xc4(F), xc5(T): reads the last value of an observable result', async () => {
    const consumer = new GuardsConsumer();
    const guard = { canActivate: () => of(true) };

    await expect(
      consumer.tryActivate([guard], [], new Controller(), () => undefined),
    ).resolves.toBe(true);
  });

  it('xc5(F): denies activation for a falsy observable result', async () => {
    const consumer = new GuardsConsumer();
    const guard = { canActivate: () => of(false) };

    await expect(
      consumer.tryActivate([guard], [], new Controller(), () => undefined),
    ).resolves.toBe(false);
  });

  it('creates a context with the controller constructor and callback', () => {
    const consumer = new GuardsConsumer();
    const controller = new Controller();
    const callback = () => undefined;

    const context = consumer.createContext(['arg'], controller, callback);

    expect(context).toBeInstanceOf(ExecutionContextHost);
    expect(context.getClass()).toBe(Controller);
    expect(context.getHandler()).toBe(callback);
    expect(context.getArgs()).toEqual(['arg']);
  });

  it('xc6(T): resolves a promise before checking for observables', async () => {
    const consumer = new GuardsConsumer();

    await expect(consumer.pickResult(Promise.resolve(true))).resolves.toBe(
      true,
    );
  });

  it('xc6(F): returns a non-observable value directly', async () => {
    const consumer = new GuardsConsumer();

    await expect(consumer.pickResult(false)).resolves.toBe(false);
  });
});
