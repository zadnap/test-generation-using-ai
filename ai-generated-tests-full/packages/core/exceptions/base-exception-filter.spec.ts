import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  HttpException,
  IntrinsicException,
} from '../../../../packages/common/index.js';
import { MESSAGES } from '../../../../packages/core/constants.js';
import { BaseExceptionFilter } from '../../../../packages/core/exceptions/base-exception-filter.js';
import { Logger } from '../../../../packages/common/services/logger.service.js';

afterEach(() => {
  vi.restoreAllMocks();
});

function adapterMock(headersSent = false) {
  return {
    isHeadersSent: vi.fn(() => headersSent),
    reply: vi.fn(),
    end: vi.fn(),
  };
}

function hostMock(response: any = {}) {
  return { getArgByIndex: vi.fn(() => response) } as any;
}

describe('BaseExceptionFilter.catch', () => {
  it('xc1(T): delegates non-HTTP exceptions to handleUnknownError', () => {
    const filter = new BaseExceptionFilter();
    const handleUnknownError = vi
      .spyOn(filter, 'handleUnknownError')
      .mockImplementation(() => undefined);
    const error = new Error('failure');
    const host = hostMock();

    filter.catch(error, host);

    expect(handleUnknownError).toHaveBeenCalledWith(
      error,
      host,
      filter.applicationRef,
    );
  });

  it('xc1(F), xc2(T): sends an object HTTP response as-is', () => {
    const adapter = adapterMock();
    const filter = new BaseExceptionFilter(adapter as any);
    const response = { custom: true };
    const exception = new HttpException(response, 400);

    filter.catch(exception, hostMock());

    expect(adapter.reply).toHaveBeenCalledWith(
      expect.anything(),
      response,
      400,
    );
  });

  it('xc2(F), xc3(T): wraps a string HTTP response and includes the error code', () => {
    const adapter = adapterMock();
    const filter = new BaseExceptionFilter(adapter as any);
    const exception = new HttpException('failure', 400, {
      errorCode: 'E_CODE',
    });

    filter.catch(exception, hostMock());

    expect(adapter.reply).toHaveBeenCalledWith(
      expect.anything(),
      {
        statusCode: 400,
        message: 'failure',
        errorCode: 'E_CODE',
      },
      400,
    );
  });

  it('xc3(F): omits the error code when undefined', () => {
    const adapter = adapterMock();
    const filter = new BaseExceptionFilter(adapter as any);

    filter.catch(new HttpException('failure', 400), hostMock());

    expect(adapter.reply.mock.calls[0][1]).toEqual({
      statusCode: 400,
      message: 'failure',
    });
  });

  it('xc4(T): ends the response when headers were already sent', () => {
    const adapter = adapterMock(true);
    const filter = new BaseExceptionFilter(adapter as any);

    filter.catch(new HttpException('failure', 400), hostMock());

    expect(adapter.end).toHaveBeenCalled();
    expect(adapter.reply).not.toHaveBeenCalled();
  });

  it('xc4(F): replies when headers were not sent', () => {
    const adapter = adapterMock(false);
    const filter = new BaseExceptionFilter(adapter as any);

    filter.catch(new HttpException('failure', 400), hostMock());

    expect(adapter.reply).toHaveBeenCalled();
  });

  it('uses the http adapter host when no application ref is given', () => {
    const adapter = adapterMock();
    const filter = new BaseExceptionFilter();
    (filter as any).httpAdapterHost = { httpAdapter: adapter };

    filter.catch(new HttpException('failure', 400), hostMock());

    expect(adapter.reply).toHaveBeenCalled();
  });
});

describe('BaseExceptionFilter.handleUnknownError', () => {
  it('xc1(T): sends an HTTP error status and message', () => {
    const adapter = adapterMock();
    const filter = new BaseExceptionFilter(adapter as any);
    const error = { statusCode: 404, message: 'not found' };

    filter.handleUnknownError(error as any, hostMock(), adapter as any);

    expect(adapter.reply).toHaveBeenCalledWith(
      expect.anything(),
      { statusCode: 404, message: 'not found' },
      404,
    );
  });

  it('xc1(F): sends an internal server error for unknown exceptions', () => {
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const adapter = adapterMock();
    const filter = new BaseExceptionFilter(adapter as any);

    filter.handleUnknownError(
      new Error('unknown') as any,
      hostMock(),
      adapter as any,
    );

    expect(adapter.reply).toHaveBeenCalledWith(
      expect.anything(),
      {
        statusCode: 500,
        message: MESSAGES.UNKNOWN_EXCEPTION_MESSAGE,
      },
      500,
    );
  });

  it('xc2(T): ends the response when headers were sent', () => {
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const adapter = adapterMock(true);
    const filter = new BaseExceptionFilter(adapter as any);

    filter.handleUnknownError(new Error('unknown') as any, hostMock(), adapter as any);

    expect(adapter.end).toHaveBeenCalled();
  });

  it('xc2(F): replies when headers were not sent', () => {
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const adapter = adapterMock(false);
    const filter = new BaseExceptionFilter(adapter as any);

    filter.handleUnknownError(new Error('unknown') as any, hostMock(), adapter as any);

    expect(adapter.reply).toHaveBeenCalled();
  });

  it('xc3(T): logs non-intrinsic errors', () => {
    const error = vi
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    const adapter = adapterMock();
    const filter = new BaseExceptionFilter(adapter as any);
    const exception = new Error('unknown');

    filter.handleUnknownError(exception as any, hostMock(), adapter as any);

    expect(error).toHaveBeenCalledWith(exception);
  });

  it('xc3(F): skips logging intrinsic exceptions', () => {
    const error = vi
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    const adapter = adapterMock();
    const filter = new BaseExceptionFilter(adapter as any);

    filter.handleUnknownError(
      new IntrinsicException('intrinsic') as any,
      hostMock(),
      adapter as any,
    );

    expect(error).not.toHaveBeenCalled();
  });
});

describe('BaseExceptionFilter.isHttpError', () => {
  const filter = new BaseExceptionFilter();

  it('xc1(F): rejects falsy and non-object values', () => {
    expect(filter.isHttpError(null)).toBe(false);
    expect(filter.isHttpError(undefined)).toBe(false);
    expect(filter.isHttpError('error')).toBe(false);
  });

  it('xc2(T), xc3(T): accepts a FastifyError with a status code', () => {
    expect(
      filter.isHttpError({
        constructor: { name: 'FastifyError' },
        code: 'ERR',
        statusCode: 400,
      }),
    ).toBe(true);
  });

  it('xc2(T), xc3(T): accepts FST_ERR_VALIDATION', () => {
    expect(
      filter.isHttpError({ code: 'FST_ERR_VALIDATION', statusCode: 400 }),
    ).toBe(true);
  });

  it('xc3(F): rejects a Fastify-like error without a numeric status', () => {
    expect(
      filter.isHttpError({
        constructor: { name: 'FastifyError' },
        code: 'ERR',
        statusCode: '400',
      }),
    ).toBe(false);
  });

  it('xc4(T), xc5(T), xc6(T): accepts an http-errors instance', () => {
    const error = new Error('failure') as any;
    error.expose = true;
    error.statusCode = 400;
    error.status = 400;

    expect(filter.isHttpError(error)).toBe(true);
  });

  it('xc4(F): rejects errors without expose', () => {
    const error = new Error('failure') as any;
    error.statusCode = 400;
    error.status = 400;

    expect(filter.isHttpError(error)).toBe(false);
  });

  it('xc5(F): rejects errors whose status differs from statusCode', () => {
    const error = new Error('failure') as any;
    error.expose = true;
    error.statusCode = 400;
    error.status = 401;

    expect(filter.isHttpError(error)).toBe(false);
  });

  it('xc6(F): rejects non-Error values for the http-errors branch', () => {
    expect(
      filter.isHttpError({
        expose: true,
        statusCode: 200,
        status: 200,
        message: 'ok',
      }),
    ).toBe(false);
  });

  it('xc7(T), xc8(T): accepts a plain http-error-shaped value', () => {
    expect(filter.isHttpError({ statusCode: 404, message: 'not found' })).toBe(
      true,
    );
  });

  it('xc7(F): rejects non-integer status codes', () => {
    expect(
      filter.isHttpError({ statusCode: 404.5, message: 'not found' }),
    ).toBe(false);
  });

  it('xc8(F): rejects status codes outside the 4xx/5xx range', () => {
    expect(filter.isHttpError({ statusCode: 200, message: 'ok' })).toBe(false);
    expect(filter.isHttpError({ statusCode: 600, message: 'bad' })).toBe(
      false,
    );
  });

  it('xc9(T): rejects an empty message', () => {
    expect(filter.isHttpError({ statusCode: 404, message: '' })).toBe(false);
  });

  it('xc9(F): rejects a non-string message', () => {
    expect(filter.isHttpError({ statusCode: 404, message: 1 })).toBe(false);
  });
});

describe('BaseExceptionFilter.getHttpErrorMessage', () => {
  const filter = new BaseExceptionFilter();

  it('xc1(T): hides messages when expose is false', () => {
    expect(
      filter.getHttpErrorMessage({
        statusCode: 500,
        message: 'secret',
        expose: false,
      }),
    ).toBe('Internal Server Error');
  });

  it('xc1(T): falls back when no status text exists', () => {
    expect(
      filter.getHttpErrorMessage({
        statusCode: 999,
        message: 'secret',
        expose: false,
      }),
    ).toBe(MESSAGES.UNKNOWN_EXCEPTION_MESSAGE);
  });

  it('xc1(F): returns the message when exposed', () => {
    expect(
      filter.getHttpErrorMessage({ statusCode: 400, message: 'visible' }),
    ).toBe('visible');
  });
});

describe('BaseExceptionFilter.isExceptionObject', () => {
  const filter = new BaseExceptionFilter();

  it('xc1(T), xc2(T): accepts an object with a message', () => {
    expect(filter.isExceptionObject({ message: 'failure' })).toBe(true);
  });

  it('xc1(F): rejects non-objects', () => {
    expect(filter.isExceptionObject('failure')).toBe(false);
  });

  it('xc2(F): rejects objects without a message', () => {
    expect(filter.isExceptionObject({})).toBe(false);
  });
});
