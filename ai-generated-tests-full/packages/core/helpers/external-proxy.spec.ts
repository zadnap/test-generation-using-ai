import { describe, expect, it, vi } from 'vitest';
import { ExternalErrorProxy } from '../../../../packages/core/helpers/external-proxy.js';

describe('ExternalErrorProxy', () => {
  it('returns the target result when it succeeds', async () => {
    const proxy = new ExternalErrorProxy();
    const target = vi.fn(async () => 'result');
    const handler = { next: vi.fn() };

    const fn = proxy.createProxy(target, handler as any);

    await expect(fn('arg')).resolves.toBe('result');
    expect(handler.next).not.toHaveBeenCalled();
  });

  it('delegates errors to the exception handler with an execution context', async () => {
    const proxy = new ExternalErrorProxy();
    const error = new Error('failure');
    const target = vi.fn(async () => {
      throw error;
    });
    const handler = { next: vi.fn(() => 'handled') };

    const fn = proxy.createProxy(target, handler as any, 'rpc');

    await expect(fn('arg')).resolves.toBe('handled');
    expect(handler.next).toHaveBeenCalledWith(error, expect.anything());
    const context = handler.next.mock.calls[0][1];
    expect(context.getArgs()).toEqual(['arg']);
    expect(context.getType()).toBe('rpc');
  });
});
