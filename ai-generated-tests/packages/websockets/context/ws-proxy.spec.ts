import { of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { WsProxy } from '../../../../packages/websockets/context/ws-proxy.js';
import { WsExceptionsHandler } from '../../../../packages/websockets/exceptions/ws-exceptions-handler.js';

describe('WsProxy', () => {
  const proxy = () => {
    const handler = new WsExceptionsHandler();
    vi.spyOn(handler, 'handle').mockImplementation(() => undefined);
    return { handler, instance: new WsProxy() };
  };

  it('should return the value of a non-observable result', async () => {
    const { instance } = proxy();
    const handler = new WsExceptionsHandler();
    const target = vi.fn(async () => 'result');
    const wrapped = instance.create(target, handler, 'pattern');

    await expect(wrapped('client')).resolves.toBe('result');
    expect(target).toHaveBeenCalledWith('client', 'pattern');
  });

  it('should default the pattern to "unknown"', async () => {
    const { instance } = proxy();
    const target = vi.fn(async () => 'result');
    const wrapped = instance.create(target, new WsExceptionsHandler());

    await wrapped('client');

    expect(target).toHaveBeenCalledWith('client', 'unknown');
  });

  it('should pass a synchronous rejection to the exceptions handler', async () => {
    const { handler, instance } = proxy();
    const error = new Error('boom');
    const wrapped = instance.create(async () => {
      throw error;
    }, handler, 'pattern');

    await expect(wrapped('client')).resolves.toBeUndefined();
    expect(handler.handle).toHaveBeenCalledWith(
      error,
      expect.objectContaining({}),
    );
  });

  it('should catch errors of a returned observable', async () => {
    const { handler, instance } = proxy();
    const error = new Error('stream failed');
    const wrapped = instance.create(
      async () => throwError(() => error),
      handler,
      'pattern',
    );

    const result = await wrapped('client');
    const complete = vi.fn();
    result.subscribe({ complete });

    expect(handler.handle).toHaveBeenCalledOnce();
    expect(complete).toHaveBeenCalledOnce();
  });

  it('should pass through a successful observable', async () => {
    const { handler, instance } = proxy();
    const wrapped = instance.create(async () => of(1, 2), handler, 'pattern');

    const values: number[] = [];
    (await wrapped('client')).subscribe(value => values.push(value));

    expect(values).toEqual([1, 2]);
    expect(handler.handle).not.toHaveBeenCalled();
  });
});
