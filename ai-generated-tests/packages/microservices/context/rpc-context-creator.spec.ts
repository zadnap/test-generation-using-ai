import { afterEach, describe, expect, it, vi } from 'vitest';
import { defer, from, isObservable, lastValueFrom, mergeMap, of } from 'rxjs';
import {
  getHandlerObservableNotifier,
  RpcContextCreator,
} from '../../../../packages/microservices/context/rpc-context-creator.js';
import { RpcException } from '../../../../packages/microservices/exceptions/rpc-exception.js';
import {
  CUSTOM_ROUTE_ARGS_METADATA,
  PARAMTYPES_METADATA,
} from '../../../../packages/common/constants.js';
import { PARAM_ARGS_METADATA } from '../../../../packages/microservices/constants.js';
import { STATIC_CONTEXT } from '../../../../packages/core/injector/constants.js';
import { FORBIDDEN_MESSAGE } from '../../../../packages/core/guards/constants.js';

/**
 * CFG / C3 decisions of RpcContextCreator:
 * create:
 *   D1  paramsMetadata (getParamsMetadata result) truthy
 *   D2  paramsOptions.length truthy inside createPipesFn
 *   D3  fnApplyPipes truthy (handler awaits it)
 *   D4  fnApplyPipes truthy ? initialArgs : args
 *   D5  handlerObservable$ truthy
 *   D6  preRequestHooks.length === 0
 *   D7  fnCanActivate truthy
 *   D8  !isEmptyArray(interceptors) || preRequestHooks.length > 0
 *   D9  index >= preRequestHooks.length inside the nested next()
 *   D10 applicationConfig optional chaining + ?? [] for pre-request hooks
 *   D11 reportUnhandledErrors forwarding (default false / explicit true)
 * getMetadata:      D12 cacheMetadata truthy, D13 metadata || default,
 *                   D14 getParamsMetadata default contextId.
 * createGuardsFn:   D15 guards.length truthy, D16 !canActivate.
 * exchangeKeysForValues: D17 key.includes(CUSTOM_ROUTE_ARGS_METADATA).
 * createPipesFn:    D18 paramsOptions.length truthy.
 * getParamValue:    D19 isEmptyArray(pipes).
 * getHandlerObservableNotifier: D20 isObject(context).
 * attachHandlerObservableNotifier: D21 isObject(context), D22 cached notifier.
 * notifyIfObservable: D23 isObservable(result), D24 result instanceof Promise,
 *                   D25 isObservable(value the handler promise resolves to).
 * No infeasible path: every decision is exercised on both sides. The
 * "paramsMetadata undefined" branch (D1 false) is only reachable when
 * exchangeKeysForValues is stubbed/overridden, which the suite does.
 */
class TestController {
  handle(data: string) {
    return of(`handled:${data}`);
  }

  empty(_data: string, _extra: string) {
    return of('empty');
  }

  meta(_a: string, _b: string) {
    return of('meta');
  }

  cached() {
    return of('cached');
  }

  typed(_a: string, _b: number) {
    return of('typed');
  }

  custom(_a: string) {
    return of('custom');
  }
}

// Methods whose param metadata is defined on the class (reflectCallbackMetadata
// reads it from instance.constructor + methodName).
Reflect.defineMetadata(PARAM_ARGS_METADATA, {}, TestController, 'empty');
Reflect.defineMetadata(
  PARAM_ARGS_METADATA,
  {
    [`${CUSTOM_ROUTE_ARGS_METADATA}:0`]: {
      index: 0,
      data: 'trace',
      pipes: [],
      factory: (data: string, ctx: any) => `${data}:${ctx.getType()}`,
    },
  },
  TestController,
  'custom',
);

const DEFAULT_METADATA = {
  '3:0': { index: 0, data: undefined, pipes: [] },
};

interface HarnessOptions {
  interceptors?: any[];
  guards?: any[];
  withConfig?: boolean;
  hooks?: any[] | null;
}

const createHarness = (options: HarnessOptions = {}) => {
  const exceptionHandler = { handle: vi.fn(() => of('handled-error')) };
  const rpcProxy = {
    create: vi.fn(
      (target: (...args: unknown[]) => unknown) =>
        (...args: unknown[]) =>
          target(...args),
    ),
  };
  const exceptionFiltersContext = {
    create: vi.fn(() => exceptionHandler),
  };
  const pipesContextCreator = {
    create: vi.fn(() => [] as any[]),
    setModuleContext: vi.fn(),
    createConcreteContext: vi.fn(() => [] as any[]),
  };
  const pipesConsumer = {
    apply: vi.fn(async (value: unknown) => `applied:${value}`),
  };
  const guardsContextCreator = {
    create: vi.fn(() => options.guards ?? []),
  };
  const guardsConsumer = {
    tryActivate: vi.fn(async () => true),
  };
  const interceptorsContextCreator = {
    create: vi.fn(() => options.interceptors ?? []),
  };
  const interceptorsConsumer = {
    intercept: vi.fn(
      async (
        _interceptors: any[],
        _args: unknown[],
        _instance: any,
        _callback: any,
        next: () => Promise<unknown>,
      ) => next(),
    ),
    transformDeferred: vi.fn((next: () => Promise<unknown>) =>
      defer(() =>
        from(next()).pipe(
          mergeMap(value => (isObservable(value) ? value : of(value))),
        ),
      ),
    ),
  };
  const hooks = options.withConfig
    ? options.hooks === undefined
      ? []
      : options.hooks
    : undefined;
  const applicationConfig = options.withConfig
    ? { getGlobalPreRequestHooks: vi.fn(() => hooks) }
    : undefined;

  const creator = new RpcContextCreator(
    rpcProxy as any,
    exceptionFiltersContext as any,
    pipesContextCreator as any,
    pipesConsumer as any,
    guardsContextCreator as any,
    guardsConsumer as any,
    interceptorsContextCreator as any,
    interceptorsConsumer as any,
    applicationConfig as any,
  );

  return {
    creator,
    rpcProxy,
    exceptionHandler,
    exceptionFiltersContext,
    pipesContextCreator,
    pipesConsumer,
    guardsContextCreator,
    guardsConsumer,
    interceptorsContextCreator,
    interceptorsConsumer,
    applicationConfig,
  };
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('RpcContextCreator', () => {
  describe('create', () => {
    // D1..D11. Infeasible path: none.
    it('wires all collaborators with the static context and forwards the default report flag', () => {
      const harness = createHarness();
      const controller = new TestController();
      const callback = controller.handle;

      const proxy = harness.creator.create(
        controller,
        callback,
        'module',
        'handle',
      );

      expect(harness.exceptionFiltersContext.create).toHaveBeenCalledWith(
        controller,
        callback,
        'module',
        STATIC_CONTEXT,
        undefined,
      );
      expect(harness.pipesContextCreator.create).toHaveBeenCalledWith(
        controller,
        callback,
        'module',
        STATIC_CONTEXT,
        undefined,
      );
      expect(harness.guardsContextCreator.create).toHaveBeenCalledWith(
        controller,
        callback,
        'module',
        STATIC_CONTEXT,
        undefined,
      );
      expect(harness.interceptorsContextCreator.create).toHaveBeenCalledWith(
        controller,
        callback,
        'module',
        STATIC_CONTEXT,
        undefined,
      );
      expect(harness.rpcProxy.create).toHaveBeenCalledTimes(1);
      const [, exceptionHandler, reportUnhandledErrors] = harness.rpcProxy
        .create.mock.calls[0] as unknown as any[];
      expect(exceptionHandler).toBe(harness.exceptionHandler);
      expect(reportUnhandledErrors).toBe(false);
      expect(typeof proxy).toBe('function');
    });

    it('D10/D11 - forwards a scoped contextId, inquirerId and reportUnhandledErrors=true', () => {
      const harness = createHarness();
      const controller = new TestController();
      const callback = controller.handle;
      const scopedContextId = { id: 11 } as any;

      harness.creator.create(
        controller,
        callback,
        'module',
        'handle',
        scopedContextId,
        'inquirer-9',
        {},
        true,
      );

      expect(harness.exceptionFiltersContext.create).toHaveBeenCalledWith(
        controller,
        callback,
        'module',
        scopedContextId,
        'inquirer-9',
      );
      expect(harness.pipesContextCreator.create).toHaveBeenCalledWith(
        controller,
        callback,
        'module',
        scopedContextId,
        'inquirer-9',
      );
      expect(harness.guardsContextCreator.create).toHaveBeenCalledWith(
        controller,
        callback,
        'module',
        scopedContextId,
        'inquirer-9',
      );
      expect(harness.interceptorsContextCreator.create).toHaveBeenCalledWith(
        controller,
        callback,
        'module',
        scopedContextId,
        'inquirer-9',
      );
      expect(harness.rpcProxy.create.mock.calls[0][2]).toBe(true);
    });

    // D1(T) with default metadata: the real RpcParamsFactory pipes args[0]
    // into the handler through the initial args array; no pipes means
    // getParamValue returns the value directly (D19(T)).
    it('D1(T) D2(T) D3(T) D4(T) - resolves default payload metadata before calling the handler', async () => {
      const harness = createHarness();
      const controller = new TestController();
      const received: unknown[][] = [];
      const callback = vi.fn((...args: unknown[]) => {
        received.push(args);
        return of(args[0]);
      });

      const proxy = harness.creator.create(
        controller,
        callback as any,
        'module',
        'handle',
      );
      const result = await proxy('payload-value');

      expect(received[0]).toEqual(['payload-value']);
      expect(await lastValueFrom(result as any)).toBe('payload-value');
      expect(harness.pipesConsumer.apply).not.toHaveBeenCalled();
    });

    // D1(T) D2(F) D3(F) D4(F): empty metadata -> no params, so the handler
    // receives the raw args array instead of the initial args array.
    it('D2(F) D3(F) D4(F) - calls the handler with the raw args when there are no params', async () => {
      const harness = createHarness();
      const controller = new TestController();
      const callback = vi.fn(() => of('raw'));

      const proxy = harness.creator.create(
        controller,
        callback as any,
        'module',
        'empty',
      );
      await proxy('one', 'two');

      expect(callback).toHaveBeenCalledWith('one', 'two');
    });

    // D1(F): only reachable when exchangeKeysForValues returns undefined.
    it('D1(F) - falls back to an empty params list when getParamsMetadata resolves nothing', async () => {
      const harness = createHarness();
      const controller = new TestController();
      const callback = vi.fn(() => of('raw'));
      const exchangeKeys = vi
        .spyOn(harness.creator, 'exchangeKeysForValues')
        .mockReturnValue(undefined as any);

      const proxy = harness.creator.create(
        controller,
        callback as any,
        'module',
        'handle',
      );
      await proxy('one', 'two');

      expect(exchangeKeys).toHaveBeenCalled();
      expect(callback).toHaveBeenCalledWith('one', 'two');
    });

    // D7(F): no guards -> no activation function.
    it('D7(F) - does not call the guards consumer when there are no guards', async () => {
      const harness = createHarness();
      const controller = new TestController();

      const proxy = harness.creator.create(
        controller,
        controller.handle,
        'module',
        'handle',
      );
      await lastValueFrom((await proxy('data')) as any);

      expect(harness.guardsConsumer.tryActivate).not.toHaveBeenCalled();
    });

    // D7(T) + D16(F): guards pass.
    it('D7(T) - activates guards before the handler runs', async () => {
      const guard = { canActivate: () => true };
      const harness = createHarness({ guards: [guard] });
      const controller = new TestController();
      const callback = controller.handle;

      const proxy = harness.creator.create(
        controller,
        callback,
        'module',
        'handle',
      );
      const result = await proxy('data');

      expect(harness.guardsConsumer.tryActivate).toHaveBeenCalledWith(
        [guard],
        ['data'],
        controller,
        callback,
        'rpc',
      );
      expect(await lastValueFrom(result as any)).toBe('handled:data');
    });

    // D16(T): a false activation throws the forbidden RpcException.
    it('D16(T) - rejects with a forbidden RpcException when a guard denies', async () => {
      const harness = createHarness({ guards: [{ canActivate: () => false }] });
      const controller = new TestController();
      harness.guardsConsumer.tryActivate.mockResolvedValue(false);

      const proxy = harness.creator.create(
        controller,
        controller.handle,
        'module',
        'handle',
      );

      await expect(proxy('data')).rejects.toBeInstanceOf(RpcException);
      await expect(proxy('data')).rejects.toThrow(FORBIDDEN_MESSAGE);
    });

    // D8(T) via non-empty interceptors + D5(T): the notifier is attached to
    // the context (second proxy arg) and notified when the handler returns an
    // Observable.
    it('D5(T) D8(T) - reports a handler Observable through the context notifier', async () => {
      const passThrough = {};
      const harness = createHarness({ interceptors: [passThrough] });
      const controller = new TestController();
      const callback = controller.handle;

      const proxy = harness.creator.create(
        controller,
        callback,
        'module',
        'handle',
      );
      const context = {};
      const result = await proxy('data', context);
      expect(await lastValueFrom(result as any)).toBe('handled:data');

      expect(harness.interceptorsConsumer.intercept).toHaveBeenCalledWith(
        [passThrough],
        ['data', context],
        controller,
        callback,
        expect.any(Function),
        'rpc',
      );
      const notifier = getHandlerObservableNotifier(context);
      expect(notifier).toBeDefined();
      const onNotified = vi.fn();
      notifier!.subscribe(onNotified);
      expect(onNotified).toHaveBeenCalledOnce();
    });

    // D8(F) D5(F): no interceptors and no hooks -> result is not wrapped and
    // no notifier is created for the context.
    it('D5(F) D8(F) - creates no notifier when the result is not wrapped', async () => {
      const harness = createHarness();
      const controller = new TestController();
      const context = {};

      const proxy = harness.creator.create(
        controller,
        controller.handle,
        'module',
        'handle',
      );
      await lastValueFrom((await proxy('data', context)) as any);

      expect(getHandlerObservableNotifier(context)).toBeUndefined();
    });

    // D21(F): a primitive context cannot key the WeakMap; no notifier and no
    // throw while the pipeline still runs.
    it('D21(F) - tolerates a primitive context when the result is wrapped', async () => {
      const harness = createHarness({ interceptors: [{}] });
      const controller = new TestController();

      const proxy = harness.creator.create(
        controller,
        controller.handle,
        'module',
        'handle',
      );
      const result = await proxy('data', 'primitive-context');

      expect(await lastValueFrom(result as any)).toBe('handled:data');
      expect(getHandlerObservableNotifier('primitive-context')).toBeUndefined();
    });

    it('D22(T) - reuses one notifier for repeated calls sharing the context', async () => {
      const harness = createHarness({ interceptors: [{}] });
      const controller = new TestController();
      const context = {};

      const proxy = harness.creator.create(
        controller,
        controller.handle,
        'module',
        'handle',
      );
      await lastValueFrom((await proxy('a', context)) as any);
      await lastValueFrom((await proxy('b', context)) as any);

      const first = getHandlerObservableNotifier(context);
      const second = getHandlerObservableNotifier(context);
      expect(first).toBeDefined();
      expect(second).toBe(first);
    });

    // D23(T) through a promise handler: the notifier emits once the handler
    // promise resolves to an Observable.
    it('D24(T) D25(T) - reports an Observable resolved by an async handler', async () => {
      const harness = createHarness({ interceptors: [{}] });
      const controller = new TestController();
      const callback = vi.fn(async () => of('async-handler'));
      const context = {};

      const proxy = harness.creator.create(
        controller,
        callback as any,
        'module',
        'handle',
      );
      await lastValueFrom((await proxy('data', context)) as any);
      await new Promise(resolve => setTimeout(resolve, 0));

      const notifier = getHandlerObservableNotifier(context);
      const onNotified = vi.fn();
      notifier!.subscribe(onNotified);
      expect(onNotified).toHaveBeenCalledOnce();
    });

    // D24(T) with a rejected promise: notifyIfObservable swallows the
    // rejection; no notifier emission and no unhandled rejection.
    it('D24(T) - a rejected handler promise does not notify and is not unhandled', async () => {
      const harness = createHarness({ interceptors: [{}] });
      const controller = new TestController();
      const callback = vi.fn(() =>
        Promise.reject(new Error('handler-rejected')),
      );
      const context = {};

      const proxy = harness.creator.create(
        controller,
        callback as any,
        'module',
        'handle',
      );
      await expect(proxy('data', context)).rejects.toThrow('handler-rejected');
      await new Promise(resolve => setTimeout(resolve, 0));

      const notifier = getHandlerObservableNotifier(context);
      const onNotified = vi.fn();
      notifier!.subscribe(onNotified);
      expect(onNotified).not.toHaveBeenCalled();
    });

    // D6(T): no pre-request hooks -> executePipeline directly, no wrapping.
    it('D6(T) - runs the pipeline directly when no hooks are configured', async () => {
      const harness = createHarness();
      const controller = new TestController();

      const proxy = harness.creator.create(
        controller,
        controller.handle,
        'module',
        'handle',
      );
      const result = await proxy('data');

      expect(
        harness.interceptorsConsumer.transformDeferred,
      ).not.toHaveBeenCalled();
      expect(await lastValueFrom(result as any)).toBe('handled:data');
    });

    it('D10 - an empty hook list from the application config also runs directly', async () => {
      const harness = createHarness({ withConfig: true, hooks: [] });
      const controller = new TestController();

      const proxy = harness.creator.create(
        controller,
        controller.handle,
        'module',
        'handle',
      );
      const result = await proxy('data');

      expect(
        harness.applicationConfig!.getGlobalPreRequestHooks,
      ).toHaveBeenCalled();
      expect(
        harness.interceptorsConsumer.transformDeferred,
      ).not.toHaveBeenCalled();
      expect(await lastValueFrom(result as any)).toBe('handled:data');
    });

    it('D10 - null hooks fall back to an empty list', async () => {
      const harness = createHarness({ withConfig: true, hooks: null });
      const controller = new TestController();

      const proxy = harness.creator.create(
        controller,
        controller.handle,
        'module',
        'handle',
      );
      const result = await proxy('data');

      expect(
        harness.interceptorsConsumer.transformDeferred,
      ).not.toHaveBeenCalled();
      expect(await lastValueFrom(result as any)).toBe('handled:data');
    });

    // D6(F) D8(T) D9(F then T): a hook receives the rpc ExecutionContextHost,
    // invokes next() and the pipeline is wrapped in transformDeferred.
    it('D6(F) D8(T) D9(T/F) - runs pre-request hooks and reuses the pipeline observable when next() is called twice', async () => {
      let firstPipeline: any;
      let secondPipeline: any;
      const hook = vi.fn((_context: any, next: () => any) => {
        firstPipeline = next();
        secondPipeline = next();
        return firstPipeline;
      });
      const harness = createHarness({ withConfig: true, hooks: [hook] });
      const controller = new TestController();
      const callback = controller.handle;

      const proxy = harness.creator.create(
        controller,
        callback,
        'module',
        'handle',
      );
      const context = {};
      const result = await proxy('data', context);

      expect(await lastValueFrom(result as any)).toBe('handled:data');
      expect(firstPipeline).toBe(secondPipeline);
      expect(
        harness.interceptorsConsumer.transformDeferred,
      ).toHaveBeenCalledTimes(1);
      expect(harness.interceptorsConsumer.intercept).toHaveBeenCalledTimes(1);

      const [executionContext, next] = hook.mock.calls[0] as unknown as any[];
      expect(executionContext.getType()).toBe('rpc');
      expect(executionContext.getClass()).toBe(TestController);
      expect(executionContext.getHandler()).toBe(callback);
      expect(executionContext.getArgs()).toEqual(['data', context]);
      expect(typeof next).toBe('function');
    });

    // D9(T) again with two hooks: the chain advances by index and the last
    // next() returns the shared pipeline.
    it('D9(T) - chains multiple pre-request hooks in registration order', async () => {
      const calls: string[] = [];
      const first = vi.fn((_context: any, next: () => any) => {
        calls.push('first');
        return defer(() => next());
      });
      const second = vi.fn((_context: any, next: () => any) => {
        calls.push('second');
        return defer(() => next());
      });
      const harness = createHarness({
        withConfig: true,
        hooks: [first, second],
      });
      const controller = new TestController();

      const proxy = harness.creator.create(
        controller,
        controller.handle,
        'module',
        'handle',
      );
      const result = await proxy('data');

      expect(await lastValueFrom(result as any)).toBe('handled:data');
      expect(calls).toEqual(['first', 'second']);
    });

    it('D6(F) - a hook can short-circuit the pipeline without next()', async () => {
      const hook = vi.fn(() => of('short-circuited'));
      const harness = createHarness({ withConfig: true, hooks: [hook] });
      const controller = new TestController();

      const proxy = harness.creator.create(
        controller,
        controller.handle,
        'module',
        'handle',
      );
      const result = await proxy('data');

      expect(await lastValueFrom(result as any)).toBe('short-circuited');
      expect(harness.interceptorsConsumer.intercept).not.toHaveBeenCalled();
    });

    it('D1(T) - resolves custom route params through their factory', async () => {
      const harness = createHarness();
      const controller = new TestController();
      const callback = vi.fn(() => of('custom'));

      const proxy = harness.creator.create(
        controller,
        callback as any,
        'module',
        'custom',
      );
      await proxy('payload');

      expect(callback).toHaveBeenCalledWith('trace:rpc');
    });

    it('D5(T) D8(T) - hooks alone also mark the result as wrapped', async () => {
      const harness = createHarness({
        withConfig: true,
        hooks: [vi.fn((_context: any, next: () => any) => next())],
      });
      const controller = new TestController();
      const context = {};

      const proxy = harness.creator.create(
        controller,
        controller.handle,
        'module',
        'handle',
      );
      const result = await proxy('data', context);
      expect(await lastValueFrom(result as any)).toBe('handled:data');

      expect(getHandlerObservableNotifier(context)).toBeDefined();
      expect(harness.interceptorsConsumer.transformDeferred).toHaveBeenCalled();
    });
  });

  describe('getMetadata', () => {
    // D12 (cache), D13 (reflected metadata || default), D14 (default contextId).
    it('D13(T) - computes argsLength and paramtypes from reflected metadata', () => {
      const harness = createHarness();
      const controller = new TestController();
      Reflect.defineMetadata(
        PARAM_ARGS_METADATA,
        {
          '3:0': { index: 0, data: undefined, pipes: [] },
          '6:1': { index: 1, data: undefined, pipes: [] },
        },
        TestController,
        'meta',
      );
      Reflect.defineMetadata(
        PARAMTYPES_METADATA,
        [String, Object],
        controller,
        'meta',
      );

      const metadata = harness.creator.getMetadata(
        controller,
        'meta',
        DEFAULT_METADATA,
        'rpc',
      );

      expect(metadata.argsLength).toBe(2);
      expect(metadata.paramtypes).toEqual([String, Object]);
      expect(typeof metadata.getParamsMetadata).toBe('function');
    });

    it('D13(F) - falls back to the default call metadata', () => {
      const harness = createHarness();
      const controller = new TestController();

      const metadata = harness.creator.getMetadata(
        controller,
        'handle',
        DEFAULT_METADATA,
        'rpc',
      );

      expect(metadata.argsLength).toBe(1);
      expect(metadata.paramtypes).toBeUndefined();
    });

    it('D12(T) - returns the cached metadata on subsequent calls', () => {
      const harness = createHarness();
      const controller = new TestController();
      Reflect.defineMetadata(
        PARAM_ARGS_METADATA,
        { '3:0': { index: 0, data: undefined, pipes: [] } },
        TestController,
        'cached',
      );

      const first = harness.creator.getMetadata(
        controller,
        'cached',
        DEFAULT_METADATA,
        'rpc',
      );
      Reflect.defineMetadata(
        PARAM_ARGS_METADATA,
        { '3:4': { index: 4, data: undefined, pipes: [] } },
        TestController,
        'cached',
      );
      const second = harness.creator.getMetadata(
        controller,
        'cached',
        DEFAULT_METADATA,
        'rpc',
      );

      expect(second).toBe(first);
      expect(second.argsLength).toBe(1);
    });

    it('D14(T) - getParamsMetadata defaults contextId to STATIC_CONTEXT', () => {
      const harness = createHarness();
      const controller = new TestController();
      const exchangeKeys = vi
        .spyOn(harness.creator, 'exchangeKeysForValues')
        .mockReturnValue([] as any);

      const metadata = harness.creator.getMetadata(
        controller,
        'handle',
        DEFAULT_METADATA,
        'rpc',
      );
      metadata.getParamsMetadata('module');

      expect(exchangeKeys).toHaveBeenCalledWith(
        ['3:0'],
        DEFAULT_METADATA,
        'module',
        expect.anything(),
        expect.any(Function),
        STATIC_CONTEXT,
        undefined,
      );
    });

    it('D14(F) - getParamsMetadata forwards an explicit contextId and inquirerId', () => {
      const harness = createHarness();
      const controller = new TestController();
      const scopedContextId = { id: 5 } as any;
      const exchangeKeys = vi
        .spyOn(harness.creator, 'exchangeKeysForValues')
        .mockReturnValue([] as any);

      const metadata = harness.creator.getMetadata(
        controller,
        'handle',
        DEFAULT_METADATA,
        'rpc',
      );
      metadata.getParamsMetadata('module', scopedContextId, 'inquirer-2');

      expect(exchangeKeys).toHaveBeenCalledWith(
        ['3:0'],
        DEFAULT_METADATA,
        'module',
        expect.anything(),
        expect.any(Function),
        scopedContextId,
        'inquirer-2',
      );
    });
  });

  describe('reflectCallbackParamtypes', () => {
    // No decisions: forwards to Reflect.getMetadata(PARAMTYPES_METADATA).
    it('returns the reflected design:paramtypes', () => {
      const harness = createHarness();
      const controller = new TestController();
      Reflect.defineMetadata(
        PARAMTYPES_METADATA,
        [String, Number],
        controller,
        'typed',
      );

      expect(
        harness.creator.reflectCallbackParamtypes(controller, controller.typed),
      ).toEqual([String, Number]);
    });

    it('returns undefined when no paramtypes metadata exists', () => {
      const harness = createHarness();
      const controller = new TestController();

      expect(
        harness.creator.reflectCallbackParamtypes(
          controller,
          controller.handle,
        ),
      ).toBeUndefined();
    });
  });

  describe('createGuardsFn', () => {
    // D15 guards.length, D16 !canActivate.
    it('D15(F) - returns null for an empty guard list', () => {
      const harness = createHarness();
      const controller = new TestController();

      expect(
        harness.creator.createGuardsFn(
          [],
          controller,
          controller.handle,
          'rpc',
        ),
      ).toBeNull();
      expect(harness.guardsConsumer.tryActivate).not.toHaveBeenCalled();
    });

    it('D15(T) D16(F) - resolves when the guards consumer activates', async () => {
      const harness = createHarness();
      const controller = new TestController();
      const guard = { canActivate: () => true };
      const callback = controller.handle;

      const canActivateFn = harness.creator.createGuardsFn(
        [guard],
        controller,
        callback,
        'rpc',
      );

      await expect((canActivateFn as any)(['data'])).resolves.toBeUndefined();
      expect(harness.guardsConsumer.tryActivate).toHaveBeenCalledWith(
        [guard],
        ['data'],
        controller,
        callback,
        'rpc',
      );
    });

    it('D16(T) - throws RpcException when the guards consumer denies', async () => {
      const harness = createHarness();
      const controller = new TestController();
      harness.guardsConsumer.tryActivate.mockResolvedValue(false);

      const canActivateFn = harness.creator.createGuardsFn(
        [{ canActivate: () => false }],
        controller,
        controller.handle,
        'rpc',
      );

      await expect((canActivateFn as any)([])).rejects.toBeInstanceOf(
        RpcException,
      );
      await expect((canActivateFn as any)([])).rejects.toThrow(
        FORBIDDEN_MESSAGE,
      );
    });

    it('passes an undefined default contextType to the consumer', async () => {
      const harness = createHarness();
      const controller = new TestController();

      const canActivateFn = harness.creator.createGuardsFn(
        [{}],
        controller,
        controller.handle,
      );
      await (canActivateFn as any)([]);

      expect(
        harness.guardsConsumer.tryActivate.mock.calls[0][4],
      ).toBeUndefined();
    });
  });

  describe('exchangeKeysForValues', () => {
    // D17 custom-route key vs numeric key; setModuleContext is always called.
    it('D17(F) - builds numeric param extractors and calls setModuleContext', () => {
      const harness = createHarness();
      const schema = { '~standard': { validate: vi.fn() } };
      const paramsFactory = { exchangeKeyForValue: vi.fn(() => 'extracted') };
      harness.pipesContextCreator.createConcreteContext.mockReturnValueOnce([
        'concrete-pipe',
      ] as any);
      const metadata = {
        '3:0': {
          index: 0,
          data: 'name',
          pipes: ['meta-pipe'],
          schema,
        },
      };
      const contextFactory = vi.fn(() => 'context-host');

      const result = harness.creator.exchangeKeysForValues(
        ['3:0'],
        metadata,
        'module-key',
        paramsFactory as any,
        contextFactory,
      );

      expect(harness.pipesContextCreator.setModuleContext).toHaveBeenCalledWith(
        'module-key',
      );
      expect(
        harness.pipesContextCreator.createConcreteContext,
      ).toHaveBeenCalledWith(['meta-pipe'], STATIC_CONTEXT, undefined);
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        index: 0,
        type: 3,
        data: 'name',
        pipes: ['concrete-pipe'],
        schema,
      });
      expect(result[0].extractValue('argument')).toBe('extracted');
      expect(paramsFactory.exchangeKeyForValue).toHaveBeenCalledWith(
        3,
        'name',
        ['argument'],
      );
    });

    it('D17(T) - builds a custom-route extractor from the factory', () => {
      const harness = createHarness();
      const factory = vi.fn(
        (data: unknown, context: unknown) => `${data}/${context}`,
      );
      const paramsFactory = { exchangeKeyForValue: vi.fn() };
      const metadata = {
        [`${CUSTOM_ROUTE_ARGS_METADATA}:7`]: {
          index: 0,
          data: 'trace',
          pipes: [],
          factory,
        },
      };
      const contextFactory = vi.fn(() => 'CTX');

      const result = harness.creator.exchangeKeysForValues(
        [`${CUSTOM_ROUTE_ARGS_METADATA}:7`],
        metadata,
        'module-key',
        paramsFactory as any,
        contextFactory,
      );

      expect(result[0].type).toBe(CUSTOM_ROUTE_ARGS_METADATA);
      expect(result[0].extractValue('ignored')).toBe('trace/CTX');
      expect(factory).toHaveBeenCalledWith('trace', 'CTX');
      expect(contextFactory).toHaveBeenCalledWith(['ignored']);
      expect(paramsFactory.exchangeKeyForValue).not.toHaveBeenCalled();
    });

    it('D17(T) - a non-function custom factory extracts null', () => {
      const harness = createHarness();
      const metadata = {
        [`${CUSTOM_ROUTE_ARGS_METADATA}:0`]: {
          index: 0,
          data: undefined,
          pipes: [],
          factory: undefined,
        },
      };

      const result = harness.creator.exchangeKeysForValues(
        [`${CUSTOM_ROUTE_ARGS_METADATA}:0`],
        metadata,
        'module-key',
        { exchangeKeyForValue: vi.fn() } as any,
        () => 'CTX',
      );

      expect(result[0].extractValue('argument')).toBeNull();
    });

    it('forwards an explicit contextId and inquirerId to createConcreteContext', () => {
      const harness = createHarness();
      const scopedContextId = { id: 4 } as any;

      harness.creator.exchangeKeysForValues(
        ['3:0'],
        { '3:0': { index: 0, data: undefined, pipes: [] } },
        'module-key',
        { exchangeKeyForValue: vi.fn() } as any,
        () => 'ctx',
        scopedContextId,
        'inquirer-3',
      );

      expect(
        harness.pipesContextCreator.createConcreteContext,
      ).toHaveBeenCalledWith([], scopedContextId, 'inquirer-3');
    });
  });

  describe('createPipesFn', () => {
    // D18 paramsOptions.length; getParamValue D19 both sides.
    it('D18(F) - returns null when there are no params', () => {
      const harness = createHarness();

      expect(harness.creator.createPipesFn([], [])).toBeNull();
    });

    it('D18(T) D19(T) - resolves a param without pipes directly', async () => {
      const harness = createHarness();
      const extractValue = vi.fn(() => 'raw-value');
      const param = {
        index: 0,
        type: 3,
        data: 'name',
        metatype: String,
        pipes: [],
        extractValue,
        schema: undefined,
      };

      const pipesFn = harness.creator.createPipesFn([], [param]);
      const initialArgs: unknown[] = [];
      await pipesFn!(initialArgs, 'payload');

      expect(extractValue).toHaveBeenCalledWith('payload');
      expect(initialArgs[0]).toBe('raw-value');
      expect(harness.pipesConsumer.apply).not.toHaveBeenCalled();
    });

    it('D18(T) D19(F) - concatenates global and param pipes and applies them', async () => {
      const harness = createHarness();
      const globalPipe = { transform: vi.fn() };
      const paramPipe = { transform: vi.fn() };
      const param = {
        index: 0,
        type: 3,
        data: 'name',
        metatype: String,
        pipes: [paramPipe],
        extractValue: vi.fn(() => 'raw-value'),
        schema: undefined,
      };

      const pipesFn = harness.creator.createPipesFn([globalPipe], [param]);
      const initialArgs: unknown[] = [];
      await pipesFn!(initialArgs, 'payload');

      expect(harness.pipesConsumer.apply).toHaveBeenCalledWith(
        'raw-value',
        {
          metatype: String,
          type: 3,
          data: 'name',
          schema: undefined,
        },
        [globalPipe, paramPipe],
      );
      expect(initialArgs[0]).toBe('applied:raw-value');
    });

    it('D18(T) - resolves every param index concurrently', async () => {
      const harness = createHarness();
      const params = [0, 1].map(index => ({
        index,
        type: 3,
        data: undefined,
        metatype: undefined,
        pipes: [],
        extractValue: vi.fn(() => `value-${index}`),
        schema: undefined,
      }));

      const pipesFn = harness.creator.createPipesFn([], params);
      const initialArgs: unknown[] = [];
      await pipesFn!(initialArgs, 'payload');

      expect(initialArgs).toEqual(['value-0', 'value-1']);
    });
  });

  describe('getParamValue', () => {
    // D19 isEmptyArray(pipes).
    it('D19(T) - returns the value untouched for an empty pipe list', async () => {
      const harness = createHarness();
      const metadata = { type: 3 } as any;

      const result = await harness.creator.getParamValue('value', metadata, []);

      expect(result).toBe('value');
      expect(harness.pipesConsumer.apply).not.toHaveBeenCalled();
    });

    it('D19(F) - delegates to the pipes consumer for a non-empty list', async () => {
      const harness = createHarness();
      const metadata = { type: 3, data: 'name' } as any;
      const pipes = [{ transform: vi.fn() }] as any;

      const result = await harness.creator.getParamValue(
        'value',
        metadata,
        pipes,
      );

      expect(result).toBe('applied:value');
      expect(harness.pipesConsumer.apply).toHaveBeenCalledWith(
        'value',
        metadata,
        pipes,
      );
    });
  });

  describe('getHandlerObservableNotifier', () => {
    // D20 isObject(context): primitive vs object, plus the WeakMap miss.
    it.each([['string' as unknown], [42], [undefined], [null]])(
      'D20(F) - returns undefined for the primitive context %p',
      context => {
        expect(getHandlerObservableNotifier(context)).toBeUndefined();
      },
    );

    it('D20(T) - returns undefined for an object without a notifier', () => {
      expect(getHandlerObservableNotifier({})).toBeUndefined();
    });

    it('D20(T) - returns the notifier created for the context', () => {
      const harness = createHarness();
      const context = {};
      const notifier = (harness.creator as any).attachHandlerObservableNotifier(
        context,
      );

      expect(getHandlerObservableNotifier(context)).toBe(notifier);
    });
  });

  describe('attachHandlerObservableNotifier (private)', () => {
    // D21 isObject, D22 cached notifier.
    it('D21(F) - returns undefined for primitive contexts', () => {
      const harness = createHarness();

      expect(
        (harness.creator as any).attachHandlerObservableNotifier('context'),
      ).toBeUndefined();
      expect(
        (harness.creator as any).attachHandlerObservableNotifier(undefined),
      ).toBeUndefined();
    });

    it('D21(T) D22(F) - creates a ReplaySubject for a new object context', () => {
      const harness = createHarness();
      const context = {};

      const notifier = (harness.creator as any).attachHandlerObservableNotifier(
        context,
      );

      expect(notifier).toBeDefined();
      expect(typeof notifier.next).toBe('function');
      notifier.next();
      const replayed = vi.fn();
      notifier.subscribe(replayed);
      expect(replayed).toHaveBeenCalledOnce();
    });

    it('D22(T) - returns the cached notifier for the same context', () => {
      const harness = createHarness();
      const context = {};

      const first = (harness.creator as any).attachHandlerObservableNotifier(
        context,
      );
      const second = (harness.creator as any).attachHandlerObservableNotifier(
        context,
      );

      expect(second).toBe(first);
    });

    it('creates distinct notifiers for distinct contexts', () => {
      const harness = createHarness();
      const first = (harness.creator as any).attachHandlerObservableNotifier(
        {},
      );
      const second = (harness.creator as any).attachHandlerObservableNotifier(
        {},
      );

      expect(first).not.toBe(second);
    });
  });

  describe('notifyIfObservable (private)', () => {
    // D23 isObservable(result), D24 result instanceof Promise, D25 the value
    // the promise resolves to.
    const buildNotifier = (harness: any) =>
      (harness.creator as any).attachHandlerObservableNotifier({});

    it('D23(T) - notifies for an Observable result', () => {
      const harness = createHarness();
      const notifier = buildNotifier(harness);
      const next = vi.spyOn(notifier, 'next');

      (harness.creator as any).notifyIfObservable(of('value'), notifier);

      expect(next).toHaveBeenCalledOnce();
    });

    it('D23(F) D24(F) - ignores a plain value', () => {
      const harness = createHarness();
      const notifier = buildNotifier(harness);
      const next = vi.spyOn(notifier, 'next');

      (harness.creator as any).notifyIfObservable('plain', notifier);

      expect(next).not.toHaveBeenCalled();
    });

    it('D23(F) D24(T) D25(T) - notifies when a promise resolves to an Observable', async () => {
      const harness = createHarness();
      const notifier = buildNotifier(harness);
      const next = vi.spyOn(notifier, 'next');

      (harness.creator as any).notifyIfObservable(
        Promise.resolve(of('value')),
        notifier,
      );
      await Promise.resolve();
      await Promise.resolve();

      expect(next).toHaveBeenCalledOnce();
    });

    it('D23(F) D24(T) D25(F) - ignores a promise resolving to a plain value', async () => {
      const harness = createHarness();
      const notifier = buildNotifier(harness);
      const next = vi.spyOn(notifier, 'next');

      (harness.creator as any).notifyIfObservable(
        Promise.resolve('plain'),
        notifier,
      );
      await Promise.resolve();
      await Promise.resolve();

      expect(next).not.toHaveBeenCalled();
    });

    it('D24(T) rejection handler - a rejected promise is swallowed and does not notify', async () => {
      const harness = createHarness();
      const notifier = buildNotifier(harness);
      const next = vi.spyOn(notifier, 'next');

      (harness.creator as any).notifyIfObservable(
        Promise.reject(new Error('rejected')),
        notifier,
      );
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(next).not.toHaveBeenCalled();
    });
  });
});
