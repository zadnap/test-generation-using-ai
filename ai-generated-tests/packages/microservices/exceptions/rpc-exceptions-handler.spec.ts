import { lastValueFrom, of } from 'rxjs';
import { IntrinsicException } from '../../../../packages/common/exceptions/intrinsic.exception.js';
import { InvalidExceptionFilterException } from '../../../../packages/core/errors/exceptions/invalid-exception-filter.exception.js';
import { KafkaRetriableException } from '../../../../packages/microservices/exceptions/kafka-retriable-exception.js';
import { RpcException } from '../../../../packages/microservices/exceptions/rpc-exception.js';
import { RpcExceptionsHandler } from '../../../../packages/microservices/exceptions/rpc-exceptions-handler.js';

const HOST = null as any;
const UNKNOWN_PAYLOAD = { status: 'error', message: 'Internal server error' };

class TestException extends RpcException {}

describe('RpcExceptionsHandler', () => {
  let handler: RpcExceptionsHandler;
  let loggerError: any;

  beforeEach(() => {
    handler = new RpcExceptionsHandler();
    loggerError = vi
      .spyOn((RpcExceptionsHandler as any).logger, 'error')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    loggerError.mockRestore();
  });

  /**
   * CFG / C3:
   * D1: !isUndefined(filterResult$)                          -> c1
   * D2: filterResult$ || of(filterResult$)                   -> c2
   * D3: reportUnhandled && exception instanceof RpcException -> c3, c4
   * Infeasible: c4 is not evaluated when c3 is false (short-circuit), which is
   * covered by the reportUnhandled=false cases.
   */
  describe('handle', () => {
    it('D1(F) - without custom filters the base filter serializes the message', async () => {
      await expect(
        lastValueFrom(handler.handle(new RpcException('test'), HOST)),
      ).rejects.toEqual({ status: 'error', message: 'test' });
      expect(loggerError).not.toHaveBeenCalled();
    });

    it('D1(F) - KafkaRetriableException keeps travelling', async () => {
      const exception = new KafkaRetriableException('retry me');

      await expect(lastValueFrom(handler.handle(exception, HOST))).rejects.toBe(
        exception,
      );
    });

    it('D1(T) D2(T) - filter returning an observable returns it untouched', () => {
      const stream$ = of('handled');
      handler.setCustomFilters([
        { exceptionMetatypes: [TestException], func: () => stream$ },
      ]);

      expect(handler.handle(new TestException('x'), HOST)).toBe(stream$);
    });

    it.each([
      ['false', false],
      ['0', 0],
      ['empty string', ''],
      ['null', null],
    ])(
      'D1(T) D2(F) - filter returning %s is wrapped with of()',
      async (_label, value) => {
        handler.setCustomFilters([
          { exceptionMetatypes: [TestException], func: () => value as any },
        ]);

        const result$ = handler.handle(new TestException('x'), HOST);

        expect(await lastValueFrom(result$)).toBe(value);
      },
    );

    it('D1(F) - filter returning undefined falls back to the base filter', async () => {
      handler.setCustomFilters([
        { exceptionMetatypes: [TestException], func: () => undefined as any },
      ]);

      await expect(
        lastValueFrom(handler.handle(new TestException('test'), HOST)),
      ).rejects.toEqual({ status: 'error', message: 'test' });
    });

    it('D1(F) - a filter that does not match falls back to the base filter', async () => {
      class OtherException {}
      handler.setCustomFilters([
        { exceptionMetatypes: [OtherException], func: () => of('nope') },
      ]);

      await expect(
        lastValueFrom(handler.handle(new RpcException('test'), HOST)),
      ).rejects.toEqual({ status: 'error', message: 'test' });
    });

    it('D3(T,T) - reportUnhandled logs an unhandled RpcException', async () => {
      const exception = new RpcException('unhandled');

      await expect(
        lastValueFrom(handler.handle(exception, HOST, true)),
      ).rejects.toEqual({ status: 'error', message: 'unhandled' });
      expect(loggerError).toHaveBeenCalledExactlyOnceWith(exception);
    });

    it('D3(T,F) - reportUnhandled does not log a non RpcException', async () => {
      await expect(
        lastValueFrom(
          handler.handle(
            new IntrinsicException('intrinsic') as any,
            HOST,
            true,
          ),
        ),
      ).rejects.toEqual(UNKNOWN_PAYLOAD);
      expect(loggerError).not.toHaveBeenCalled();
    });

    it('D3(F) - reportUnhandled defaults to false, so nothing is logged', async () => {
      await expect(
        lastValueFrom(handler.handle(new RpcException('quiet'), HOST)),
      ).rejects.toEqual({ status: 'error', message: 'quiet' });
      expect(loggerError).not.toHaveBeenCalled();
    });

    it('does not log when the exception was handled by a custom filter', async () => {
      handler.setCustomFilters([
        { exceptionMetatypes: [TestException], func: () => of('handled') },
      ]);

      await lastValueFrom(handler.handle(new TestException('x'), HOST, true));

      expect(loggerError).not.toHaveBeenCalled();
    });
  });

  /**
   * CFG / C3:
   * D1: !Array.isArray(filters) -> both outcomes.
   * Infeasible: none.
   */
  describe('setCustomFilters', () => {
    it('D1(F) - stores an array of filters', () => {
      const filters: any = [
        { exceptionMetatypes: [TestException], func: () => of('a') },
      ];

      handler.setCustomFilters(filters);

      expect((handler as any).filters).toBe(filters);
    });

    it('D1(F) - stores an empty array', () => {
      handler.setCustomFilters([]);

      expect((handler as any).filters).toEqual([]);
      expect(
        handler.invokeCustomFilters(new TestException('x'), HOST),
      ).toBeUndefined();
    });

    it.each([
      ['null', null],
      ['undefined', undefined],
      ['object', {}],
      ['string', 'filters'],
      ['number', 42],
    ])(
      'D1(T) - rejects %s with InvalidExceptionFilterException',
      (_label, value) => {
        expect(() => handler.setCustomFilters(value as any)).toThrow(
          InvalidExceptionFilterException,
        );
      },
    );

    it('replaces previously registered filters', () => {
      const replacement$ = of('replacement');
      const first: any = [
        { exceptionMetatypes: [TestException], func: () => of('first') },
      ];
      const second: any = [
        { exceptionMetatypes: [TestException], func: () => replacement$ },
      ];

      handler.setCustomFilters(first);
      handler.setCustomFilters(second);

      expect(handler.invokeCustomFilters(new TestException('x'), HOST)).toBe(
        replacement$,
      );
    });
  });

  /**
   * CFG / C3:
   * D1: isEmptyArray(this.filters) -> c1
   * D2: filter ? filter.func(...) : undefined -> c2
   * Infeasible: none.
   */
  describe('invokeCustomFilters', () => {
    it('D1(T) - returns undefined when no filters were registered', () => {
      expect(
        handler.invokeCustomFilters(new TestException('x'), HOST),
      ).toBeUndefined();
    });

    it('D1(F) D2(T) - calls the matching filter with the exception and host', () => {
      const func = vi.fn(() => of('value'));
      const exception = new TestException('x');
      handler.setCustomFilters([{ exceptionMetatypes: [TestException], func }]);

      const result = handler.invokeCustomFilters(exception, HOST);

      expect(func).toHaveBeenCalledExactlyOnceWith(exception, HOST);
      expect(result).toBe(func.mock.results[0].value);
    });

    it('D1(F) D2(F) - returns undefined and does not call a non-matching filter', () => {
      class OtherException {}
      const func = vi.fn(() => of('value'));
      handler.setCustomFilters([
        { exceptionMetatypes: [OtherException], func },
      ]);

      expect(
        handler.invokeCustomFilters(new TestException('x'), HOST),
      ).toBeUndefined();
      expect(func).not.toHaveBeenCalled();
    });

    it('D1(F) D2(T) - propagates a plain value returned by the filter', () => {
      const func = vi.fn(() => 'plain' as any);
      handler.setCustomFilters([{ exceptionMetatypes: [TestException], func }]);

      expect(handler.invokeCustomFilters(new TestException('x'), HOST)).toBe(
        'plain',
      );
    });

    it('D1(F) D2(T) - uses the first matching filter', () => {
      const first = vi.fn(() => of('first'));
      const second = vi.fn(() => of('second'));
      handler.setCustomFilters([
        { exceptionMetatypes: [TestException], func: first },
        { exceptionMetatypes: [TestException], func: second },
      ]);

      expect(handler.invokeCustomFilters(new TestException('x'), HOST)).toBe(
        first.mock.results[0].value,
      );
      expect(second).not.toHaveBeenCalled();
    });
  });
});
