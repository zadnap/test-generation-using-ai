import { lastValueFrom, of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { ExecutionContextHost } from '../../../../packages/core/helpers/execution-context-host.js';
import { InterceptorsConsumer } from '../../../../packages/core/interceptors/interceptors-consumer.js';

class Controller {}

describe('InterceptorsConsumer', () => {
  it('xc1(T): calls next directly without interceptors', async () => {
    const consumer = new InterceptorsConsumer();
    const next = vi.fn(async () => 'result');

    await expect(
      consumer.intercept([], [], new Controller(), () => undefined, next),
    ).resolves.toBe('result');
  });

  it('xc1(F): runs interceptors around the next handler', async () => {
    const consumer = new InterceptorsConsumer();
    const interceptor = {
      intercept: (_ctx: any, nextHandler: any) =>
        of('intercepted').pipe((source: any) => source),
    };
    const result = await consumer.intercept(
      [interceptor] as any,
      [],
      new Controller(),
      () => undefined,
      async () => 'result',
    );

    await expect(lastValueFrom(result as any)).resolves.toBe('intercepted');
  });

  it('passes the handler result through the interceptor chain', async () => {
    const consumer = new InterceptorsConsumer();
    const interceptor = {
      intercept: (_ctx: any, nextHandler: any) => nextHandler.handle(),
    };
    const result = await consumer.intercept(
      [interceptor] as any,
      [],
      new Controller(),
      () => undefined,
      async () => 'result',
    );

    await expect(lastValueFrom(result as any)).resolves.toBe('result');
  });

  it('creates a context with the controller constructor and callback', () => {
    const consumer = new InterceptorsConsumer();
    const controller = new Controller();
    const callback = () => undefined;

    const context = consumer.createContext(['arg'], controller, callback);

    expect(context).toBeInstanceOf(ExecutionContextHost);
    expect(context.getClass()).toBe(Controller);
    expect(context.getHandler()).toBe(callback);
  });

  it('xc2(T): emits a resolved value', async () => {
    const consumer = new InterceptorsConsumer();

    const result = consumer.transformDeferred(async () => 'value');

    await expect(lastValueFrom(result)).resolves.toBe('value');
  });

  it('xc2(F), xc3(T): emits from a resolved promise', async () => {
    const consumer = new InterceptorsConsumer();

    const result = consumer.transformDeferred(async () => Promise.resolve('value'));

    await expect(lastValueFrom(result)).resolves.toBe('value');
  });

  it('xc3(F), xc4(T): emits from a resolved observable', async () => {
    const consumer = new InterceptorsConsumer();

    const result = consumer.transformDeferred(async () => of('value'));

    await expect(lastValueFrom(result)).resolves.toBe('value');
  });

  it('xc4(F): propagates errors', async () => {
    const consumer = new InterceptorsConsumer();
    const error = new Error('failure');

    const result = consumer.transformDeferred(async () => {
      throw error;
    });

    await expect(lastValueFrom(result)).rejects.toThrow(error);
  });

  it('xc5(T): emits an error from a resolved observable', async () => {
    const consumer = new InterceptorsConsumer();
    const error = new Error('failure');

    const result = consumer.transformDeferred(async () => throwError(() => error));

    await expect(lastValueFrom(result)).rejects.toThrow(error);
  });

  it('xc5(F): does not subscribe when the subscriber is already closed', async () => {
    const consumer = new InterceptorsConsumer();
    let resolve!: (value: string) => void;
    const pending = new Promise<string>(r => {
      resolve = r;
    });

    const result = consumer.transformDeferred(() => pending);
    const subscription = result.subscribe();
    subscription.unsubscribe();
    resolve('value');

    await pending;
    await Promise.resolve();
    expect(subscription.closed).toBe(true);
  });
});
