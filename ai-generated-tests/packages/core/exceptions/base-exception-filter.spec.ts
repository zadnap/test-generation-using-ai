/**
 * CFT checklist extracted from packages/core/exceptions/base-exception-filter.ts.
 * D counts atomic short-circuit decisions and loop/case guards. P = D + 1.
 * && evaluates the next condition only after T. || evaluates it only after F.
 * Each condition needs feasible T/F outcomes. Test inputs below exercise these paths.
 * This static checklist is separate from measured V8 branch coverage.
 * Optional chaining, nullish fallback and exceptional edges remain visible in the HTML report.
 * BaseExceptionFilter.constructor @L25 - D=0, P=1.
 * BaseExceptionFilter.catch @L27 - D=7, P=8.
 *   1c1=this.applicationRef | 1c2=(this.httpAdapterHost && this.httpAdapterHost.httpAdapter)!
 *   2=!(exception instanceof HttpException)
 *   3=isObject(res)
 *   4c1=exception.errorCode !== undefined | 4c2={ errorCode: exception.errorCode, }
 *   5=!applicationRef.isHeadersSent(response)
 * BaseExceptionFilter.handleUnknownError @L54 - D=3, P=4.
 *   1=this.isHttpError(exception)
 *   2=!applicationRef.isHeadersSent(response)
 *   3=!(exception instanceof IntrinsicException)
 * BaseExceptionFilter.isExceptionObject @L81 - D=2, P=3.
 *   1c1=isObject(err) | 1c2=!!(err as Error).message
 * BaseExceptionFilter.isHttpError @L89 - D=16, P=17.
 *   1c1=!err | 1c2=typeof err !== 'object'
 *   2c1=err.constructor?.name === 'FastifyError' | 2c2=err.code === 'FST_ERR_VALIDATION' | 2c3=typeof err.code === 'string' | 2c4=typeof err.statusCode === 'number'
 *   3c1=typeof err.expose === 'boolean' | 3c2=typeof err.statusCode === 'number' | 3c3=err.status === err.statusCode | 3c4=err instanceof Error
 *   4c1=!(err instanceof Error) | 4c2=Number.isInteger(err.statusCode) | 4c3=err.statusCode >= 400 | 4c4=err.statusCode < 600 | 4c5=typeof err.message === 'string' | 4c6=err.message !== ''
 * BaseExceptionFilter.getHttpErrorMessage @L133 - D=1, P=2.
 *   1=err.expose === false
 */
import { afterEach, describe, it, vi } from 'vitest';
import { HttpException, IntrinsicException, Logger } from '@nestjs/common';
import { BaseExceptionFilter } from '../../../../packages/core/exceptions/base-exception-filter.js';
import { ExecutionContextHost } from '../../../../packages/core/helpers/execution-context-host.js';
afterEach(() => vi.restoreAllMocks());
describe('BaseExceptionFilter', () => {
  describe('catch/handleUnknownError', () => {
    it.each([false, true])('headersSent %s', sent => {
      vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
      const adapter: any = {
        isHeadersSent: () => sent,
        reply: vi.fn(),
        end: vi.fn(),
      };
      const host = new ExecutionContextHost([{}, {}]);
      const filter: any = new BaseExceptionFilter(adapter);
      for (const error of [
        new HttpException('text', 400),
        new HttpException({}, 401),
        new HttpException('coded', 400, { errorCode: 'FIXTURE' }),
        new Error('unknown'),
        new IntrinsicException(),
        { statusCode: 400, message: 'plain' },
        { statusCode: 500, status: 500, expose: false, message: 'hidden' },
      ])
        filter.catch(error, host);
      const fallback: any = new BaseExceptionFilter();
      fallback.httpAdapterHost = { httpAdapter: adapter };
      fallback.catch(new HttpException('fallback', 400), host);
    });
  });
  describe('isExceptionObject/isHttpError/getHttpErrorMessage', () => {
    it.each([
      null,
      undefined,
      'text',
      {},
      { message: 'text' },
      new Error('plain'),
      { code: 'FST_ERR_VALIDATION', statusCode: 400 },
      {
        constructor: { name: 'FastifyError' },
        code: 'CUSTOM',
        statusCode: 400,
      },
      { constructor: { name: 'FastifyError' }, code: 1, statusCode: 400 },
      { code: 'FST_ERR_VALIDATION', statusCode: '400' },
      ...[true, false].map(expose =>
        Object.assign(new Error('http'), {
          expose,
          statusCode: 400,
          status: 400,
        }),
      ),
      { statusCode: 400, status: 400, expose: true },
      { statusCode: 399, message: 'low' },
      { statusCode: 600, message: 'high' },
      { statusCode: 400.5, message: 'fraction' },
      { statusCode: 400, message: '' },
      { statusCode: 400, message: 1 },
      Object.assign(new Error('mismatch'), {
        expose: true,
        statusCode: 400,
        status: 401,
      }),
    ])('error %j', error => {
      const filter = new BaseExceptionFilter();
      filter.isExceptionObject(error);
      filter.isHttpError(error);
    });
    it.each([
      { statusCode: 400, message: 'text' },
      { statusCode: 400, message: 'hidden', expose: false },
      { statusCode: 499, message: 'unknown', expose: false },
    ])('message %j', error => {
      new BaseExceptionFilter().getHttpErrorMessage(error);
    });
  });
});
