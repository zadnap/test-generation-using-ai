import { describe, expect, it, vi } from 'vitest';
import { FILTER_CATCH_EXCEPTIONS } from '../../../../packages/common/constants.js';
import { STATIC_CONTEXT } from '../../../../packages/core/injector/constants.js';
import { BaseExceptionFilterContext } from '../../../../packages/core/exceptions/base-exception-filter-context.js';

class Filter {
  catch() {}
}
class ErrorType extends Error {}

describe('BaseExceptionFilterContext', () => {
  it('xc1(T): returns an empty list for empty metadata', () => {
    const context = new BaseExceptionFilterContext({} as any);

    expect(context.createConcreteContext([])).toEqual([]);
    expect(context.createConcreteContext(undefined as any)).toEqual([]);
  });

  it('xc1(F), xc2(T): maps a filter instance to its catch function', () => {
    Reflect.defineMetadata(
      FILTER_CATCH_EXCEPTIONS,
      [ErrorType],
      Filter,
    );
    const filter = new Filter();
    const context = new BaseExceptionFilterContext({} as any);

    const result = context.createConcreteContext([filter]);

    expect(result).toHaveLength(1);
    expect(result[0].exceptionMetatypes).toEqual([ErrorType]);
    expect(result[0].func).toBeInstanceOf(Function);
  });

  it('xc3(F): filters out falsy entries', () => {
    const context = new BaseExceptionFilterContext({} as any);

    expect(context.createConcreteContext([null, undefined] as any)).toEqual(
      [],
    );
  });

  it('xc2(F): resolves a filter class through the container', () => {
    const filter = new Filter();
    const wrapper = {
      getInstanceByContextId: vi.fn(() => ({ instance: filter })),
    };
    const container = {
      getModules: () => new Map([['module', { injectables: new Map([[Filter, wrapper]]) }]]),
    };
    const context = new BaseExceptionFilterContext(container as any);
    (context as any).moduleContext = 'module';

    const result = context.createConcreteContext([Filter], STATIC_CONTEXT);

    expect(result).toHaveLength(1);
    expect(wrapper.getInstanceByContextId).toHaveBeenCalled();
  });

  it('xc4(T): drops a class that is not registered', () => {
    const container = {
      getModules: () => new Map([['module', { injectables: new Map() }]]),
    };
    const context = new BaseExceptionFilterContext(container as any);
    (context as any).moduleContext = 'module';

    expect(context.createConcreteContext([Filter])).toEqual([]);
  });

  it('xc4(F): returns null when no instance wrapper exists', () => {
    const context = new BaseExceptionFilterContext({} as any);

    expect(context.getInstanceByMetatype(Filter)).toBeUndefined();
  });

  it('returns undefined when the module is missing', () => {
    const container = { getModules: () => new Map() };
    const context = new BaseExceptionFilterContext(container as any);
    (context as any).moduleContext = 'missing';

    expect(context.getInstanceByMetatype(Filter)).toBeUndefined();
  });

  it('returns an object filter unchanged', () => {
    const filter = { catch: vi.fn() };
    const context = new BaseExceptionFilterContext({} as any);

    expect(context.getFilterInstance(filter as any)).toBe(filter);
  });

  it('returns null for an unregistered filter class', () => {
    const container = { getModules: () => new Map() };
    const context = new BaseExceptionFilterContext(container as any);
    (context as any).moduleContext = 'module';

    expect(context.getFilterInstance(Filter)).toBeNull();
  });

  it('xc1(T): reflects caught exceptions from the class prototype', () => {
    Reflect.defineMetadata(FILTER_CATCH_EXCEPTIONS, [ErrorType], Filter);
    const context = new BaseExceptionFilterContext({} as any);

    expect(context.reflectCatchExceptions(new Filter())).toEqual([ErrorType]);
  });

  it('xc1(F): returns an empty list without catch metadata', () => {
    class Plain {}
    const context = new BaseExceptionFilterContext({} as any);

    expect(context.reflectCatchExceptions(new Plain())).toEqual([]);
  });
});
