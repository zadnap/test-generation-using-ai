import { afterEach, describe, expect, it, vi } from 'vitest';
import { ExceptionFiltersContext } from '../../../../packages/microservices/context/exception-filters-context.js';
import { RpcExceptionsHandler } from '../../../../packages/microservices/exceptions/rpc-exceptions-handler.js';
import { EXCEPTION_FILTERS_METADATA } from '../../../../packages/common/constants.js';
import { STATIC_CONTEXT } from '../../../../packages/core/injector/constants.js';

/**
 * CFG / C3 decisions of ExceptionFiltersContext:
 * create:
 *   D1 isEmptyArray(filters) - false branch also calls setCustomFilters(reverse)
 * getGlobalMetadata:
 *   D2 contextId === STATIC_CONTEXT
 *   D3 !inquirerId (only evaluated when D2 is true)
 *   D4 !!host per scoped wrapper instance (falsy wrappers filtered out)
 * No infeasible path.
 */
describe('ExceptionFiltersContext', () => {
  const STATIC_MODULE = 'module-key';

  const buildConfig = (
    globalFilters: any[] = [],
    globalRequestFilters: any[] = [],
  ) =>
    ({
      getGlobalFilters: vi.fn(() => globalFilters),
      getGlobalRequestFilters: vi.fn(() => globalRequestFilters),
    }) as any;

  const buildContext = (config: any) =>
    new ExceptionFiltersContext({} as any, config);

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('create', () => {
    // D1(T): no filters -> plain handler, setCustomFilters is not called.
    it('D1(T) - returns a handler without custom filters when none are registered', () => {
      const config = buildConfig();
      const context = buildContext(config);
      const setCustomFilters = vi.spyOn(
        RpcExceptionsHandler.prototype,
        'setCustomFilters',
      );
      const controller = {};
      const callback = vi.fn();

      const handler = context.create(controller, callback, STATIC_MODULE);

      expect(handler).toBeInstanceOf(RpcExceptionsHandler);
      expect((handler as any).filters).toEqual([]);
      expect(setCustomFilters).not.toHaveBeenCalled();
      expect(config.getGlobalFilters).toHaveBeenCalled();
    });

    // D1(F): filters found -> reverse() then setCustomFilters.
    it('D1(F) - reverses global filters and installs them on the handler', () => {
      const filterOne = { catch: vi.fn() };
      const filterTwo = { catch: vi.fn() };
      const config = buildConfig([filterOne, filterTwo]);
      const context = buildContext(config);

      const handler = context.create({}, vi.fn(), STATIC_MODULE);

      const filters = (handler as any).filters as any[];
      expect(filters).toHaveLength(2);
      // reverse(): the second registered filter now runs first.
      filters[0].func('error', 'host');
      expect(filterTwo.catch).toHaveBeenCalledWith('error', 'host');
      expect(filterOne.catch).not.toHaveBeenCalled();
      expect(filterTwo.catch.mock.instances[0]).toBe(filterTwo);
      expect(filters[0].exceptionMetatypes).toEqual([]);
    });

    it('D1(F) - picks up method-level filter metadata', () => {
      const filter = { catch: vi.fn() };
      const config = buildConfig();
      const context = buildContext(config);
      const callback = vi.fn();
      Reflect.defineMetadata(EXCEPTION_FILTERS_METADATA, [filter], callback);

      const handler = context.create({}, callback, STATIC_MODULE);

      expect((handler as any).filters).toHaveLength(1);
    });

    it('D1(T) - filters that are not catchable objects are dropped', () => {
      const config = buildConfig([null, { noCatch: true }, 'string-filter']);
      const context = buildContext(config);
      const setCustomFilters = vi.spyOn(
        RpcExceptionsHandler.prototype,
        'setCustomFilters',
      );

      const handler = context.create({}, vi.fn(), STATIC_MODULE);

      expect((handler as any).filters).toEqual([]);
      expect(setCustomFilters).not.toHaveBeenCalled();
    });

    it('D2(F) - forwards a scoped contextId and inquirerId to the scoped filter lookup', () => {
      const scopedFilter = { catch: vi.fn() };
      const wrapper = {
        token: 'FILTER_TOKEN',
        isDependencyTreeDurable: () => false,
        getInstanceByContextId: vi.fn(() => ({ instance: scopedFilter })),
      };
      const config = buildConfig([], [wrapper]);
      const context = buildContext(config);
      const scopedContextId = { id: 7 } as any;

      const handler = context.create(
        {},
        vi.fn(),
        STATIC_MODULE,
        scopedContextId,
        'inquirer-1',
      );

      expect((handler as any).filters).toHaveLength(1);
      expect(wrapper.getInstanceByContextId).toHaveBeenCalledWith(
        scopedContextId,
        'inquirer-1',
      );
    });
  });

  describe('getGlobalMetadata', () => {
    // D2(T) D3(T): plain static lookup returns the configured global filters.
    it('D2(T) D3(T) - returns global filters for the static context without inquirer', () => {
      const globalFilters = [{ catch: vi.fn() }];
      const config = buildConfig(globalFilters);
      const context = buildContext(config);

      const result = context.getGlobalMetadata();

      expect(result).toBe(globalFilters);
      expect(config.getGlobalRequestFilters).not.toHaveBeenCalled();
    });

    // D2(T) D3(F): static context but an inquirer -> scoped wrappers too.
    it('D2(T) D3(F) - appends scoped filters when an inquirerId is present', () => {
      const globalFilter = { catch: vi.fn() };
      const scopedInstance = { catch: vi.fn() };
      const wrapper = {
        token: 'F',
        isDependencyTreeDurable: () => false,
        getInstanceByContextId: vi.fn(() => ({ instance: scopedInstance })),
      };
      const config = buildConfig([globalFilter], [wrapper]);
      const context = buildContext(config);

      const result = context.getGlobalMetadata(STATIC_CONTEXT, 'inquirer-1');

      expect(result).toEqual([globalFilter, scopedInstance]);
      expect(wrapper.getInstanceByContextId).toHaveBeenCalledWith(
        STATIC_CONTEXT,
        'inquirer-1',
      );
    });

    // D2(F): a non-static contextId goes through the scoped branch even
    // without an inquirerId (D3 is not evaluated).
    it('D2(F) - scoped contextId without inquirer still collects scoped filters', () => {
      const globalFilter = { catch: vi.fn() };
      const scopedInstance = { catch: vi.fn() };
      const scopedContextId = { id: 3 } as any;
      const wrapper = {
        token: 'F',
        isDependencyTreeDurable: () => false,
        getInstanceByContextId: vi.fn(() => ({ instance: scopedInstance })),
      };
      const config = buildConfig([globalFilter], [wrapper]);
      const context = buildContext(config);

      const result = context.getGlobalMetadata(scopedContextId);

      expect(result).toEqual([globalFilter, scopedInstance]);
      expect(wrapper.getInstanceByContextId).toHaveBeenCalledWith(
        scopedContextId,
        undefined,
      );
    });

    // D4(T)/D4(F): wrappers with no resolved host are filtered out.
    it('D4(T)/D4(F) - keeps only wrappers that resolve an instance host', () => {
      const first = { catch: vi.fn() };
      const second = { catch: vi.fn() };
      const wrappers = [
        {
          token: 'A',
          isDependencyTreeDurable: () => false,
          getInstanceByContextId: vi.fn(() => ({ instance: first })),
        },
        {
          token: 'B',
          isDependencyTreeDurable: () => false,
          getInstanceByContextId: vi.fn(() => undefined),
        },
        {
          token: 'C',
          isDependencyTreeDurable: () => false,
          getInstanceByContextId: vi.fn(() => null),
        },
        {
          token: 'D',
          isDependencyTreeDurable: () => false,
          getInstanceByContextId: vi.fn(() => ({ instance: second })),
        },
      ];
      const config = buildConfig([], wrappers);
      const context = buildContext(config);

      const result = context.getGlobalMetadata({ id: 2 } as any, 'inq');

      expect(result).toEqual([first, second]);
    });
  });
});
