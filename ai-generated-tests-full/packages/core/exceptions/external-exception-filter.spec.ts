import { afterEach, describe, expect, it, vi } from 'vitest';
import { IntrinsicException } from '../../../../packages/common/index.js';
import { Logger } from '../../../../packages/common/services/logger.service.js';
import { ExternalExceptionFilter } from '../../../../packages/core/exceptions/external-exception-filter.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ExternalExceptionFilter', () => {
  it('xc1(T), xc2(T): logs and rethrows a regular error', () => {
    const error = vi
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    const exception = new Error('failure');

    expect(() =>
      new ExternalExceptionFilter().catch(exception, {} as any),
    ).toThrow(exception);
    expect(error).toHaveBeenCalledWith(exception);
  });

  it('xc2(F): does not log intrinsic exceptions', () => {
    const error = vi
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    const exception = new IntrinsicException('intrinsic');

    expect(() =>
      new ExternalExceptionFilter().catch(exception, {} as any),
    ).toThrow(exception);
    expect(error).not.toHaveBeenCalled();
  });

  it('xc1(F): rethrows non-error values without logging', () => {
    const error = vi
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);

    expect(() => new ExternalExceptionFilter().catch('failure', {} as any)).toThrow(
      'failure',
    );
    expect(error).not.toHaveBeenCalled();
  });
});
