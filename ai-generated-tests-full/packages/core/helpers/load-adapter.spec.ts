import { afterEach, describe, expect, it, vi } from 'vitest';
import { Logger } from '../../../../packages/common/services/logger.service.js';
import { loadAdapter } from '../../../../packages/core/helpers/load-adapter.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('loadAdapter', () => {
  it('xc1(T): returns the result of the loader function', async () => {
    const loader = vi.fn(async () => 'adapter');

    await expect(loadAdapter('platform', 'transport', loader)).resolves.toBe(
      'adapter',
    );
    expect(loader).toHaveBeenCalled();
  });

  it('xc1(F): imports the default platform when no loader is given', async () => {
    await expect(loadAdapter('node:path', 'transport')).resolves.toBeTypeOf(
      'object',
    );
  });

  it('logs and exits when loading fails', async () => {
    const errorSpy = vi
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    const exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation((() => undefined) as never);
    const loader = vi.fn(async () => {
      throw new Error('missing');
    });

    await loadAdapter('platform', 'transport', loader);

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('No driver (transport) has been selected'),
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
