import { describe, expect, it, vi } from 'vitest';
import { INTERCEPTORS_METADATA } from '../../../../packages/common/constants.js';
import { STATIC_CONTEXT } from '../../../../packages/core/injector/constants.js';
import { InterceptorsContextCreator } from '../../../../packages/core/interceptors/interceptors-context-creator.js';

class Interceptor {
  intercept() {
    return undefined;
  }
}

describe('InterceptorsContextCreator', () => {
  it('creates a context for the module', () => {
    const creator = new InterceptorsContextCreator({} as any);
    class Controller {}
    const callback = () => undefined;
    Reflect.defineMetadata(INTERCEPTORS_METADATA, [], Controller);

    const interceptors = creator.create(
      new Controller() as any,
      callback,
      'module',
      STATIC_CONTEXT,
    );

    expect(interceptors).toEqual([]);
    expect((creator as any).moduleContext).toBe('module');
  });

  it('xc1(T): returns an empty list for empty metadata', () => {
    const creator = new InterceptorsContextCreator({} as any);

    expect(creator.createConcreteContext([])).toEqual([]);
  });

  it('xc1(F), xc2(T): keeps interceptor instances', () => {
    const interceptor = new Interceptor();
    const creator = new InterceptorsContextCreator({} as any);

    expect(creator.createConcreteContext([interceptor])).toEqual([
      interceptor,
    ]);
  });

  it('xc2(F): drops invalid interceptor values', () => {
    const creator = new InterceptorsContextCreator({} as any);

    expect(creator.createConcreteContext([{}, null] as any)).toEqual([]);
  });

  it('xc3(T): resolves interceptor classes from the container', () => {
    const interceptor = new Interceptor();
    const wrapper = {
      getInstanceByContextId: vi.fn(() => ({ instance: interceptor })),
    };
    const container = {
      getModules: () =>
        new Map([
          ['module', { injectables: new Map([[Interceptor, wrapper]]) }],
        ]),
    };
    const creator = new InterceptorsContextCreator(container as any);
    (creator as any).moduleContext = 'module';

    expect(creator.createConcreteContext([Interceptor])).toEqual([
      interceptor,
    ]);
  });

  it('xc3(F): drops interceptor classes that cannot be resolved', () => {
    const container = {
      getModules: () => new Map([['module', { injectables: new Map() }]]),
    };
    const creator = new InterceptorsContextCreator(container as any);
    (creator as any).moduleContext = 'module';

    expect(creator.createConcreteContext([Interceptor])).toEqual([]);
  });

  it('xc4(T): returns an object interceptor unchanged', () => {
    const interceptor = { intercept: vi.fn() };
    const creator = new InterceptorsContextCreator({} as any);

    expect(creator.getInterceptorInstance(interceptor as any)).toBe(
      interceptor,
    );
  });

  it('xc4(F): returns null for an unregistered interceptor class', () => {
    const creator = new InterceptorsContextCreator({} as any);

    expect(creator.getInterceptorInstance(Interceptor)).toBeNull();
  });

  it('returns undefined when there is no module context', () => {
    const creator = new InterceptorsContextCreator({} as any);

    expect(creator.getInstanceByMetatype(Interceptor)).toBeUndefined();
  });

  it('returns undefined when the module is missing', () => {
    const creator = new InterceptorsContextCreator({
      getModules: () => new Map(),
    } as any);
    (creator as any).moduleContext = 'missing';

    expect(creator.getInstanceByMetatype(Interceptor)).toBeUndefined();
  });

  it('xc5(T): returns no global interceptors without a config', () => {
    const creator = new InterceptorsContextCreator({} as any);

    expect(creator.getGlobalMetadata()).toEqual([]);
  });

  it('xc5(F), xc6(T): returns global interceptors for the static context', () => {
    const globalInterceptors = [{ intercept: vi.fn() }];
    const config = { getGlobalInterceptors: () => globalInterceptors };
    const creator = new InterceptorsContextCreator(
      {} as any,
      config as any,
    );

    expect(creator.getGlobalMetadata()).toBe(globalInterceptors);
  });

  it('xc6(F): combines global and scoped interceptors', () => {
    const globalInterceptor = { intercept: vi.fn() };
    const scopedInterceptor = { intercept: vi.fn() };
    const wrapper = {
      getInstanceByContextId: vi.fn(() => ({ instance: scopedInterceptor })),
    };
    const missingWrapper = {
      getInstanceByContextId: vi.fn(() => null),
    };
    const config = {
      getGlobalInterceptors: () => [globalInterceptor],
      getGlobalRequestInterceptors: () => [wrapper, missingWrapper],
    };
    const creator = new InterceptorsContextCreator({} as any, config as any);

    expect(creator.getGlobalMetadata({ id: 2 } as any)).toEqual([
      globalInterceptor,
      scopedInterceptor,
    ]);
  });
});
