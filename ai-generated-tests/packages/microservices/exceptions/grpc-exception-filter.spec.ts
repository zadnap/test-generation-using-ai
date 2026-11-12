import { lastValueFrom } from 'rxjs';
import { GrpcStatus } from '../../../../packages/microservices/enums/grpc-status.enum.js';
import {
  GrpcException,
  GrpcNotFoundException,
} from '../../../../packages/microservices/exceptions/grpc-exception.js';
import { GrpcExceptionFilter } from '../../../../packages/microservices/exceptions/grpc-exception-filter.js';
import { RpcException } from '../../../../packages/microservices/exceptions/rpc-exception.js';

const HOST = null as any;

describe('GrpcExceptionFilter', () => {
  let filter: GrpcExceptionFilter;

  beforeEach(() => {
    filter = new GrpcExceptionFilter();
  });

  /**
   * CFG / C3:
   * D1: exception instanceof GrpcException                     -> c1
   * D2: exception instanceof RpcException                      -> c2
   * D3: isObject(error) inside serializeRpcException           -> c3
   * D4: isNumber(code) after getErrorCode                      -> c4
   * Infeasible: a GrpcException that is also a bare RpcException is covered by
   * D1; c2 is only evaluated when c1 is false.
   */
  describe('catch', () => {
    it('D1(T) - GrpcException emits its own error body', async () => {
      const exception = new GrpcNotFoundException('missing order');

      await expect(
        lastValueFrom(filter.catch(exception, HOST)),
      ).rejects.toEqual({
        code: GrpcStatus.NOT_FOUND,
        message: 'missing order',
      });
    });

    it('D1(F) D2(T) D3(T) D4(T) - RpcException with object code', async () => {
      const exception = new RpcException({
        code: GrpcStatus.INVALID_ARGUMENT,
        message: 'invalid input',
      });

      await expect(
        lastValueFrom(filter.catch(exception, HOST)),
      ).rejects.toEqual({
        code: GrpcStatus.INVALID_ARGUMENT,
        message: 'invalid input',
      });
    });

    it('D1(F) D2(T) D3(T) D4(T) - object code is spread over extra props', async () => {
      const exception = new RpcException({
        code: GrpcStatus.ABORTED,
        details: ['retry later'],
        message: 'aborted',
      });

      await expect(
        lastValueFrom(filter.catch(exception, HOST)),
      ).rejects.toEqual({
        code: GrpcStatus.ABORTED,
        details: ['retry later'],
        message: 'aborted',
      });
    });

    it('D1(F) D2(T) D3(T) D4(T) - numeric code 0 is not treated as absent', async () => {
      const exception = new RpcException({
        code: GrpcStatus.OK,
        message: 'ok',
      });

      await expect(
        lastValueFrom(filter.catch(exception, HOST)),
      ).rejects.toEqual({ code: GrpcStatus.OK, message: 'ok' });
    });

    it('D1(F) D2(T) D3(T) D4(F) - non-numeric code falls back to UNKNOWN with its message', async () => {
      const exception = new RpcException({ code: '3', message: 'custom' });

      await expect(
        lastValueFrom(filter.catch(exception, HOST)),
      ).rejects.toEqual({
        code: GrpcStatus.UNKNOWN,
        message: 'custom',
      });
    });

    it('D1(F) D2(T) D3(F) - scalar error falls back to UNKNOWN with its message', async () => {
      const exception = new RpcException('plain failure');

      await expect(
        lastValueFrom(filter.catch(exception, HOST)),
      ).rejects.toEqual({
        code: GrpcStatus.UNKNOWN,
        message: 'plain failure',
      });
    });

    it('D1(F) D2(F) - unknown exceptions map to UNKNOWN', async () => {
      await expect(
        lastValueFrom(filter.catch(new Error('boom'), HOST)),
      ).rejects.toEqual({
        code: GrpcStatus.UNKNOWN,
        message: 'Internal server error',
      });
    });

    it('D1(F) D2(F) - non-error values map to UNKNOWN', async () => {
      await expect(
        lastValueFrom(filter.catch(undefined, HOST)),
      ).rejects.toEqual({
        code: GrpcStatus.UNKNOWN,
        message: 'Internal server error',
      });
    });
  });

  /**
   * CFG / C3:
   * D1: isObject(error)  -> c1
   * D2: isNumber(code)   -> c2 (code comes from getErrorCode, number | undefined)
   * Infeasible: none; both decisions are reachable.
   */
  describe('serializeRpcException', () => {
    const serialize = (exception: RpcException) =>
      (filter as any).serializeRpcException(exception);

    it.each([
      [
        'D1(F) - scalar error',
        new RpcException('scalar'),
        { code: GrpcStatus.UNKNOWN, message: 'scalar' },
      ],
      [
        'D1(T) D2(T) - numeric code',
        new RpcException({ code: GrpcStatus.DATA_LOSS, message: 'lost' }),
        { code: GrpcStatus.DATA_LOSS, message: 'lost' },
      ],
      [
        'D1(T) D2(F) - object without a numeric code',
        new RpcException({ code: null, message: 'no numeric code' }),
        { code: GrpcStatus.UNKNOWN, message: 'no numeric code' },
      ],
      [
        'D1(T) D2(T) - status is used when code is missing',
        new RpcException({ status: GrpcStatus.UNAVAILABLE, message: 'down' }),
        {
          code: GrpcStatus.UNAVAILABLE,
          status: GrpcStatus.UNAVAILABLE,
          message: 'down',
        },
      ],
      [
        'D1(F) - array error is an object, but code lookup finds nothing',
        new RpcException(['a'] as any),
        { code: GrpcStatus.UNKNOWN, message: 'Rpc Exception' },
      ],
    ])('%s', (_label, exception, expected) => {
      expect(serialize(exception)).toEqual(expected);
    });

    it('D1(T) D2(F) - message always comes from the exception', () => {
      expect(serialize(new RpcException({ message: 'mine' }))).toEqual({
        code: GrpcStatus.UNKNOWN,
        message: 'mine',
      });
    });
  });

  /**
   * CFG / C3:
   * D1: isNumber(code)   -> c1
   * D2: isNumber(status) -> c2 (only when c1 is false)
   * Infeasible: none.
   */
  describe('getErrorCode', () => {
    const getErrorCode = (error: object) =>
      (filter as any).getErrorCode(error) as number | undefined;

    it.each([
      ['D1(T) - numeric code wins', { code: 7, status: 9 }, 7],
      ['D1(T) - zero code', { code: 0 }, 0],
      ['D1(F) D2(T) - numeric status', { status: 14 }, 14],
      ['D1(F) D2(T) - zero status', { status: 0 }, 0],
      ['D1(F) D2(F) - no numeric field', {}, undefined],
      ['D1(F) D2(F) - string fields', { code: '1', status: '2' }, undefined],
      ['D1(F) D2(F) - null fields', { code: null, status: null }, undefined],
    ])('%s', (_label, error, expected) => {
      expect(getErrorCode(error)).toBe(expected);
    });
  });
});
