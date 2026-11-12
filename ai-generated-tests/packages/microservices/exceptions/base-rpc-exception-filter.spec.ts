import { lastValueFrom } from 'rxjs';
import { IntrinsicException } from '../../../../packages/common/exceptions/intrinsic.exception.js';
import { BaseRpcExceptionFilter } from '../../../../packages/microservices/exceptions/base-rpc-exception-filter.js';
import { KafkaRetriableException } from '../../../../packages/microservices/exceptions/kafka-retriable-exception.js';
import { RpcException } from '../../../../packages/microservices/exceptions/rpc-exception.js';

const HOST = null as any;
const UNKNOWN_PAYLOAD = {
  status: 'error',
  message: 'Internal server error',
};

describe('BaseRpcExceptionFilter', () => {
  let filter: BaseRpcExceptionFilter;
  let loggerError: any;

  beforeEach(() => {
    filter = new BaseRpcExceptionFilter();
    loggerError = vi
      .spyOn((BaseRpcExceptionFilter as any).logger, 'error')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    loggerError.mockRestore();
  });

  /**
   * CFG / C3:
   * D1: !(exception instanceof RpcException)        -> c1
   * D2: res instanceof Error && res !== exception   -> c2, c3
   * D3: isObject(res) ? res : {status, message}     -> both ternary outcomes
   */
  describe('catch', () => {
    it('D1(T) - non RpcException goes through handleUnknownError and logs', async () => {
      const exception = new Error('boom');

      await expect(
        lastValueFrom(filter.catch(exception, HOST)),
      ).rejects.toEqual(UNKNOWN_PAYLOAD);
      expect(loggerError).toHaveBeenCalledWith(exception);
    });

    it('D1(T) - non Error scalar also goes through handleUnknownError', async () => {
      await expect(
        lastValueFrom(filter.catch('boom' as any, HOST)),
      ).rejects.toEqual(UNKNOWN_PAYLOAD);
      expect(loggerError).toHaveBeenCalledWith('boom');
    });

    it('D1(F) D2(T,T) - RpcException holding a different Error is unwrapped and logged', async () => {
      const error = Object.assign(new Error('request failed'), {
        config: { headers: { authorization: 'Bearer secret' } },
      });

      await expect(
        lastValueFrom(filter.catch(new RpcException(error), HOST)),
      ).rejects.toEqual(UNKNOWN_PAYLOAD);
      expect(loggerError).toHaveBeenCalledWith(error);
    });

    it('D1(F) D2(T,F) - RpcException returning itself keeps travelling', async () => {
      const exception = new KafkaRetriableException('retry me');

      await expect(lastValueFrom(filter.catch(exception, HOST))).rejects.toBe(
        exception,
      );
      expect(loggerError).not.toHaveBeenCalled();
    });

    it('D1(F) D2(F) D3(F) - scalar payload is wrapped as {status, message}', async () => {
      await expect(
        lastValueFrom(filter.catch(new RpcException('Unauthorized'), HOST)),
      ).rejects.toEqual({ status: 'error', message: 'Unauthorized' });
      expect(loggerError).not.toHaveBeenCalled();
    });

    it('D1(F) D2(F) D3(T) - object payload is emitted unchanged', async () => {
      const payload = { custom: 'value', retryable: false };

      await expect(
        lastValueFrom(filter.catch(new RpcException(payload), HOST)),
      ).rejects.toBe(payload);
      expect(loggerError).not.toHaveBeenCalled();
    });

    it('D1(F) D2(F) D3(T) - array payload is an object and is emitted unchanged', async () => {
      const payload = ['a', 'b'];

      await expect(
        lastValueFrom(filter.catch(new RpcException(payload), HOST)),
      ).rejects.toBe(payload);
      expect(loggerError).not.toHaveBeenCalled();
    });
  });

  /**
   * CFG / C3:
   * D1: !(exception instanceof IntrinsicException) -> c1 (log or not)
   * Infeasible: none.
   */
  describe('handleUnknownError', () => {
    it('D1(T) - logs a regular exception', async () => {
      const exception = new Error('boom');

      await expect(
        lastValueFrom(filter.handleUnknownError(exception as any, 'error')),
      ).rejects.toEqual(UNKNOWN_PAYLOAD);
      expect(loggerError).toHaveBeenCalledExactlyOnceWith(exception);
    });

    it('D1(F) - does not log an IntrinsicException', async () => {
      const exception = new IntrinsicException('already reported');

      await expect(
        lastValueFrom(filter.handleUnknownError(exception as any, 'error')),
      ).rejects.toEqual(UNKNOWN_PAYLOAD);
      expect(loggerError).not.toHaveBeenCalled();
    });

    it('uses the status argument in the emitted payload', async () => {
      await expect(
        lastValueFrom(
          filter.handleUnknownError(
            new IntrinsicException('x') as any,
            'fatal',
          ),
        ),
      ).rejects.toEqual({ status: 'fatal', message: 'Internal server error' });
    });
  });

  /**
   * CFG / C3:
   * D1: isObject(exception) && exception.message -> c1, c2
   * Infeasible: none.
   */
  describe('isError', () => {
    it.each([
      ['object with truthy message', { message: 'boom' }, true],
      ['Error instance with message', new Error('boom'), true],
      ['object with empty message', { message: '' }, false],
      ['object without message', { code: 1 }, false],
      ['null', null, false],
      ['string primitive', 'boom', false],
      ['number primitive', 42, false],
    ])('D1(c1,c2) - %s -> %s', (_label, value, expected) => {
      expect(filter.isError(value)).toBe(expected);
    });
  });
});
