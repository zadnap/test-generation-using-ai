import { afterEach, describe, expect, it, vi } from 'vitest';
import { Logger } from '../../../../packages/common/services/logger.service.js';
import { ExceptionHandler } from '../../../../packages/core/errors/exception-handler.js';
import { ExceptionsZone } from '../../../../packages/core/errors/exceptions-zone.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ExceptionsZone.run', () => {
  it('runs the callback without teardown on success', () => {
    const callback = vi.fn();
    const teardown = vi.fn();

    ExceptionsZone.run(callback, teardown, false);

    expect(callback).toHaveBeenCalled();
    expect(teardown).not.toHaveBeenCalled();
  });

  it('xc1(T), xc2(T): handles the error, flushes logs and tears down', () => {
    const handle = vi
      .spyOn(ExceptionHandler.prototype, 'handle')
      .mockImplementation(() => undefined);
    const flush = vi
      .spyOn(Logger, 'flush')
      .mockImplementation(() => undefined);
    const error = new Error('failure');
    const teardown = vi.fn();

    ExceptionsZone.run(
      () => {
        throw error;
      },
      teardown,
      true,
    );

    expect(handle).toHaveBeenCalledWith(error);
    expect(flush).toHaveBeenCalled();
    expect(teardown).toHaveBeenCalledWith(error);
  });

  it('xc2(F): skips log flushing when disabled', () => {
    vi.spyOn(ExceptionHandler.prototype, 'handle').mockImplementation(
      () => undefined,
    );
    const flush = vi
      .spyOn(Logger, 'flush')
      .mockImplementation(() => undefined);

    ExceptionsZone.run(() => {
      throw new Error('failure');
    }, vi.fn(), false);

    expect(flush).not.toHaveBeenCalled();
  });

  it('uses the default teardown on failure', () => {
    vi.spyOn(ExceptionHandler.prototype, 'handle').mockImplementation(
      () => undefined,
    );
    const exit = vi
      .spyOn(process, 'exit')
      .mockImplementation((() => undefined) as never);

    ExceptionsZone.run(() => {
      throw new Error('failure');
    }, undefined as any, false);

    expect(exit).toHaveBeenCalledWith(1);
  });
});

describe('ExceptionsZone.asyncRun', () => {
  it('runs the async callback without teardown on success', async () => {
    const callback = vi.fn(async () => undefined);
    const teardown = vi.fn();

    await ExceptionsZone.asyncRun(callback, teardown, false);

    expect(callback).toHaveBeenCalled();
    expect(teardown).not.toHaveBeenCalled();
  });

  it('xc1(T), xc2(T): handles async failures, flushes and tears down', async () => {
    const handle = vi
      .spyOn(ExceptionHandler.prototype, 'handle')
      .mockImplementation(() => undefined);
    const flush = vi
      .spyOn(Logger, 'flush')
      .mockImplementation(() => undefined);
    const error = new Error('failure');
    const teardown = vi.fn();

    await ExceptionsZone.asyncRun(async () => {
      throw error;
    }, teardown, true);

    expect(handle).toHaveBeenCalledWith(error);
    expect(flush).toHaveBeenCalled();
    expect(teardown).toHaveBeenCalledWith(error);
  });

  it('xc2(F): skips log flushing for async failures when disabled', async () => {
    vi.spyOn(ExceptionHandler.prototype, 'handle').mockImplementation(
      () => undefined,
    );
    const flush = vi
      .spyOn(Logger, 'flush')
      .mockImplementation(() => undefined);

    await ExceptionsZone.asyncRun(async () => {
      throw new Error('failure');
    }, vi.fn(), false);

    expect(flush).not.toHaveBeenCalled();
  });
});
