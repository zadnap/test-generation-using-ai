import { describe, expect, it, vi } from 'vitest';
import { isObservable, lastValueFrom, of, throwError } from 'rxjs';
import { RpcProxy } from '../../../../packages/microservices/context/rpc-proxy.js';

/**
 * CFG / C3 decisions of RpcProxy:
 * create:
 *   D1 isObservable(result returned by targetCallback)
 *   catch block catches a synchronous throw / rejected targetCallback
 *   D2 reportUnhandledErrors forwarded (default false vs explicit true)
 * handleError: no branches (builds an rpc ExecutionContextHost, delegates to
 *   exceptionsHandler.handle).
 * transformToObservable:
 *   D3 isObservable(result) of the filter result
 *   D4 isObservable(value resolved by the filter result promise)
 * No infeasible path.
 */
describe('RpcProxy', () => {
  const makeExceptionsHandler = (result: unknown = of('handled')) => {
    const handle = vi.fn(() => result);
    return { handle, exceptionsHandler: { handle } as any };
  };

  describe('create', () => {
    // D1(T): targetCallback resolves to an Observable.
    it('D1(T) - forwards the call arguments and returns the target observable stream', async () => {
      const targetCallback = vi.fn(async () => of('ok'));
      const proxy = new RpcProxy().create(
        targetCallback as any,
        makeExceptionsHandler().exceptionsHandler,
      );

      const result = await proxy('first', 'second');

      expect(isObservable(result)).toBe(true);
      expect(await lastValueFrom(result as any)).toBe('ok');
      expect(targetCallback).toHaveBeenCalledWith('first', 'second');
    });

    // D1(F): targetCallback resolves to a non-observable value.
    it('D1(F) - returns a non-observable result untouched', async () => {
      const targetCallback = vi.fn(async () => ({ plain: true }));
      const proxy = new RpcProxy().create(
        targetCallback as any,
        makeExceptionsHandler().exceptionsHandler,
      );

      const result = await proxy();

      expect(isObservable(result)).toBe(false);
      expect(result).toEqual({ plain: true });
    });

    it('returns an async function', () => {
      const proxy = new RpcProxy().create(
        (async () => of('x')) as any,
        makeExceptionsHandler().exceptionsHandler,
      );

      expect(proxy()).toBeInstanceOf(Promise);
    });

    describe('when the target observable errors', () => {
      // D1(T) + catchError path; handleError builds the rpc host and forwards
      // error, args and the false default of reportUnhandledErrors.
      it('emits the filter result and calls the handler with an rpc host', async () => {
        const error = new Error('boom');
        const targetCallback = vi.fn(async () => throwError(() => error));
        const { handle, exceptionsHandler } = makeExceptionsHandler(
          of('handled'),
        );
        const proxy = new RpcProxy().create(
          targetCallback as any,
          exceptionsHandler,
        );

        const result = await proxy('arg0', 'arg1');

        expect(await lastValueFrom(result as any)).toBe('handled');
        expect(handle).toHaveBeenCalledTimes(1);

        const [forwardedError, host, reportUnhandledErrors] = handle.mock
          .calls[0] as unknown as any[];
        expect(forwardedError).toBe(error);
        expect(host.getType()).toBe('rpc');
        expect(host.getArgs()).toEqual(['arg0', 'arg1']);
        expect(reportUnhandledErrors).toBe(false);
      });

      it('D3(F) D4(F) - wraps a plain filter result as an observable', async () => {
        const targetCallback = vi.fn(async () =>
          throwError(() => new Error('x')),
        );
        const proxy = new RpcProxy().create(
          targetCallback as any,
          makeExceptionsHandler('plain-filter-value').exceptionsHandler,
        );

        const result = await proxy('payload');

        expect(await lastValueFrom(result as any)).toBe('plain-filter-value');
      });

      it('D3(F) D4(T) - resolves a filter promise that yields an observable', async () => {
        const targetCallback = vi.fn(async () =>
          throwError(() => new Error('x')),
        );
        const proxy = new RpcProxy().create(
          targetCallback as any,
          makeExceptionsHandler(Promise.resolve(of('async-observable')))
            .exceptionsHandler,
        );

        const result = await proxy('payload');

        expect(await lastValueFrom(result as any)).toBe('async-observable');
      });

      it('D3(F) D4(F) - resolves a filter promise that yields a plain value', async () => {
        const targetCallback = vi.fn(async () =>
          throwError(() => new Error('x')),
        );
        const proxy = new RpcProxy().create(
          targetCallback as any,
          makeExceptionsHandler(Promise.resolve('async-plain'))
            .exceptionsHandler,
        );

        const result = await proxy('payload');

        expect(await lastValueFrom(result as any)).toBe('async-plain');
      });

      it('D3(T) - emits a filter observable as-is', async () => {
        const targetCallback = vi.fn(async () =>
          throwError(() => new Error('x')),
        );
        const proxy = new RpcProxy().create(
          targetCallback as any,
          makeExceptionsHandler(of('observable-filter')).exceptionsHandler,
        );

        const result = await proxy('payload');

        expect(await lastValueFrom(result as any)).toBe('observable-filter');
      });
    });

    describe('D2 - reportUnhandledErrors forwarding', () => {
      it('D2(default false) - reportUnhandledErrors is not requested', async () => {
        const { handle, exceptionsHandler } = makeExceptionsHandler();
        const proxy = new RpcProxy().create(
          (async () => throwError(() => new Error('x'))) as any,
          exceptionsHandler,
        );

        await lastValueFrom((await proxy('a')) as any);

        expect(handle.mock.calls[0][2]).toBe(false);
      });

      it('D2(true) - reportUnhandledErrors is forwarded when requested', async () => {
        const { handle, exceptionsHandler } = makeExceptionsHandler();
        const proxy = new RpcProxy().create(
          (async () => throwError(() => new Error('x'))) as any,
          exceptionsHandler,
          true,
        );

        await lastValueFrom((await proxy('a')) as any);

        expect(handle.mock.calls[0][2]).toBe(true);
      });
    });

    describe('when targetCallback throws or rejects before returning a stream', () => {
      it('handles a synchronous throw through the filter', async () => {
        const error = new Error('sync-boom');
        const targetCallback = vi.fn(() => {
          throw error;
        });
        const { handle, exceptionsHandler } = makeExceptionsHandler(
          of('sync-handled'),
        );
        const proxy = new RpcProxy().create(
          targetCallback as any,
          exceptionsHandler,
        );

        const result = await proxy('a', 'b');

        expect(await lastValueFrom(result as any)).toBe('sync-handled');
        const [forwardedError, , report] = handle.mock
          .calls[0] as unknown as any[];
        expect(forwardedError).toBe(error);
        expect(report).toBe(false);
      });

      it('handles a rejected targetCallback through the filter with the flag', async () => {
        const error = new Error('async-boom');
        const targetCallback = vi.fn(async () => {
          throw error;
        });
        const { handle, exceptionsHandler } =
          makeExceptionsHandler('rejected-handled');
        const proxy = new RpcProxy().create(
          targetCallback as any,
          exceptionsHandler,
          true,
        );

        const result = await proxy('a');

        // The catch block returns whatever exceptionsHandler.handle() returns
        // (no transformToObservable wrapping on this path).
        expect(result).toBe('rejected-handled');
        expect(handle.mock.calls[0][0]).toBe(error);
        expect(handle.mock.calls[0][2]).toBe(true);
      });
    });
  });

  describe('handleError', () => {
    // No branches in handleError itself; defaults of reportUnhandledErrors
    // covered with and without the 4th argument.
    it('builds an rpc ExecutionContextHost and delegates to the handler', async () => {
      const error = new Error('boom');
      const { handle, exceptionsHandler } = makeExceptionsHandler(
        of('handled'),
      );
      const proxy = new RpcProxy();

      const result = proxy.handleError(
        exceptionsHandler,
        ['a', 'b'],
        error,
        true,
      );

      expect(await lastValueFrom(result)).toBe('handled');
      const [forwardedError, host, report] = handle.mock
        .calls[0] as unknown as any[];
      expect(forwardedError).toBe(error);
      expect(host.getType()).toBe('rpc');
      expect(host.getArgs()).toEqual(['a', 'b']);
      expect(report).toBe(true);
    });

    it('defaults reportUnhandledErrors to false', async () => {
      const { handle, exceptionsHandler } = makeExceptionsHandler();
      const proxy = new RpcProxy();

      await lastValueFrom(
        proxy.handleError(exceptionsHandler, [], new Error('x')),
      );

      expect(handle.mock.calls[0][2]).toBe(false);
    });
  });

  describe('transformToObservable (private, also reached through the filter error path)', () => {
    // D3(T): already an observable; D3(F) goes through the promise wrapper and
    // D4 selects between the resolved observable and of(value).
    it('D3(T) - returns an observable unchanged', async () => {
      const proxy = new RpcProxy();
      const source = of('direct');

      const result = (proxy as any).transformToObservable(source);

      expect(result).toBe(source);
    });

    it('D3(F) - wraps a plain value', async () => {
      const proxy = new RpcProxy();

      const result = (proxy as any).transformToObservable('value');

      expect(await lastValueFrom(result)).toBe('value');
    });

    it('D3(F) D4(T) - resolves a promise to an observable', async () => {
      const proxy = new RpcProxy();

      const result = (proxy as any).transformToObservable(
        Promise.resolve(of(7)),
      );

      expect(await lastValueFrom(result)).toBe(7);
    });

    it('D3(F) D4(F) - resolves a promise to a plain value', async () => {
      const proxy = new RpcProxy();

      const result = (proxy as any).transformToObservable(Promise.resolve(9));

      expect(await lastValueFrom(result)).toBe(9);
    });
  });
});
