import { afterEach, describe, expect, it, vi } from 'vitest';
import { Logger } from '../../../../packages/common/services/logger.service.js';
import { ExceptionHandler } from '../../../../packages/core/errors/exception-handler.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ExceptionHandler', () => {
  it('logs the exception through the logger', () => {
    const error = vi
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    const exception = new Error('failure');

    new ExceptionHandler().handle(exception);

    expect(error).toHaveBeenCalledWith(exception);
  });
});
