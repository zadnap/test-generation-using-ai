import { describe, expect, it, vi } from 'vitest';
import { STATIC_CONTEXT } from '../../../../packages/core/injector/constants.js';
import { ExternalExceptionFilterContext } from '../../../../packages/core/exceptions/external-exception-filter-context.js';

describe('ExternalExceptionFilterContext.create', () => {
  it('xc1(T): returns a handler without filters when there are none', () => {
    const context = new ExternalExceptionFilterContext({} as any);
    vi.spyOn(context, 'createContext').mockReturnValue([] as any);

    const handler = context.create({} as any, (() => undefined) as any, 'm');

    expect((handler as any).filters).toEqual([]);
  });

  it('xc1(F): reverses and applies the collected filters', () => {
    const context = new ExternalExceptionFilterContext({} as any);
    const filters = [{ func: vi.fn(), exceptionMetatypes: [] }] as any[];
    vi.spyOn(context, 'createContext').mockReturnValue(filters as any);

    const handler = context.create({} as any, (() => undefined) as any, 'm');

    expect((handler as any).filters).toBe(filters);
    expect((context as any).moduleContext).toBe('m');
  });
});

describe('ExternalExceptionFilterContext.getGlobalMetadata', () => {
  it('xc1(T): returns an empty list without a config', () => {
    const context = new ExternalExceptionFilterContext({} as any);

    expect(context.getGlobalMetadata()).toEqual([]);
  });

  it('xc1(F), xc2(T): returns global filters for the static context', () => {
    const globalFilters = [{ func: vi.fn() }];
    const config = {
      getGlobalFilters: () => globalFilters,
    };
    const context = new ExternalExceptionFilterContext(
      {} as any,
      config as any,
    );

    expect(context.getGlobalMetadata()).toBe(globalFilters);
  });

  it('xc2(F): combines global and scoped filters', () => {
    const globalFilters = [{ func: vi.fn() }];
    const scopedInstance = { func: vi.fn() };
    const wrapper = {
      getInstanceByContextId: vi.fn(() => ({ instance: scopedInstance })),
    };
    const missingWrapper = {
      getInstanceByContextId: vi.fn(() => null),
    };
    const config = {
      getGlobalFilters: () => globalFilters,
      getGlobalRequestFilters: () => [wrapper, missingWrapper],
    };
    const context = new ExternalExceptionFilterContext(
      {} as any,
      config as any,
    );

    const result = context.getGlobalMetadata({ id: 2 } as any);

    expect(result).toEqual([...globalFilters, scopedInstance]);
    expect(wrapper.getInstanceByContextId).toHaveBeenCalled();
    expect(missingWrapper.getInstanceByContextId).toHaveBeenCalled();
  });

  it('xc2(F): returns scoped filters when a non-static context has no inquirer', () => {
    const scopedInstance = { func: vi.fn() };
    const wrapper = {
      getInstanceByContextId: vi.fn(() => ({ instance: scopedInstance })),
    };
    const config = {
      getGlobalFilters: () => [],
      getGlobalRequestFilters: () => [wrapper],
    };
    const context = new ExternalExceptionFilterContext(
      {} as any,
      config as any,
    );

    expect(context.getGlobalMetadata(STATIC_CONTEXT, 'inquirer')).toEqual([
      scopedInstance,
    ]);
  });
});
