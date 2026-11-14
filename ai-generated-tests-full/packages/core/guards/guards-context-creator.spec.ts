import { describe, expect, it, vi } from 'vitest';
import { GUARDS_METADATA } from '../../../../packages/common/constants.js';
import { STATIC_CONTEXT } from '../../../../packages/core/injector/constants.js';
import { GuardsContextCreator } from '../../../../packages/core/guards/guards-context-creator.js';

class Guard {
  canActivate() {
    return true;
  }
}

describe('GuardsContextCreator', () => {
  it('creates a context for the module', () => {
    const creator = new GuardsContextCreator({} as any);
    class Controller {}
    const callback = () => undefined;
    Reflect.defineMetadata(GUARDS_METADATA, [], Controller);

    const guards = creator.create(
      new Controller() as any,
      callback,
      'module',
      STATIC_CONTEXT,
    );

    expect(guards).toEqual([]);
    expect((creator as any).moduleContext).toBe('module');
  });

  it('xc1(T): returns an empty list for empty metadata', () => {
    const creator = new GuardsContextCreator({} as any);

    expect(creator.createConcreteContext([])).toEqual([]);
  });

  it('xc1(F), xc2(T): keeps guard instances', () => {
    const guard = new Guard();
    const creator = new GuardsContextCreator({} as any);

    expect(creator.createConcreteContext([guard])).toEqual([guard]);
  });

  it('xc2(F): drops invalid guard values', () => {
    const creator = new GuardsContextCreator({} as any);

    expect(creator.createConcreteContext([{}, null] as any)).toEqual([]);
  });

  it('xc3(T): resolves guard classes from the container', () => {
    const guard = new Guard();
    const wrapper = {
      getInstanceByContextId: vi.fn(() => ({ instance: guard })),
    };
    const container = {
      getModules: () =>
        new Map([['module', { injectables: new Map([[Guard, wrapper]]) }]]),
    };
    const creator = new GuardsContextCreator(container as any);
    (creator as any).moduleContext = 'module';

    expect(creator.createConcreteContext([Guard])).toEqual([guard]);
  });

  it('xc3(F): drops guard classes that cannot be resolved', () => {
    const container = {
      getModules: () => new Map([['module', { injectables: new Map() }]]),
    };
    const creator = new GuardsContextCreator(container as any);
    (creator as any).moduleContext = 'module';

    expect(creator.createConcreteContext([Guard])).toEqual([]);
  });

  it('xc4(T): returns an object guard unchanged', () => {
    const guard = { canActivate: vi.fn() };
    const creator = new GuardsContextCreator({} as any);

    expect(creator.getGuardInstance(guard as any)).toBe(guard);
  });

  it('xc4(F): returns null for an unregistered guard class', () => {
    const creator = new GuardsContextCreator({} as any);

    expect(creator.getGuardInstance(Guard)).toBeNull();
  });

  it('returns undefined when there is no module context', () => {
    const creator = new GuardsContextCreator({} as any);

    expect(creator.getInstanceByMetatype(Guard)).toBeUndefined();
  });

  it('returns undefined when the module is missing', () => {
    const creator = new GuardsContextCreator({
      getModules: () => new Map(),
    } as any);
    (creator as any).moduleContext = 'missing';

    expect(creator.getInstanceByMetatype(Guard)).toBeUndefined();
  });

  it('xc5(T): returns no global guards without a config', () => {
    const creator = new GuardsContextCreator({} as any);

    expect(creator.getGlobalMetadata()).toEqual([]);
  });

  it('xc5(F), xc6(T): returns global guards for the static context', () => {
    const globalGuards = [{ canActivate: vi.fn() }];
    const config = { getGlobalGuards: () => globalGuards };
    const creator = new GuardsContextCreator({} as any, config as any);

    expect(creator.getGlobalMetadata()).toBe(globalGuards);
  });

  it('xc6(F): combines global and scoped guards', () => {
    const globalGuard = { canActivate: vi.fn() };
    const scopedGuard = { canActivate: vi.fn() };
    const wrapper = {
      getInstanceByContextId: vi.fn(() => ({ instance: scopedGuard })),
    };
    const missingWrapper = {
      getInstanceByContextId: vi.fn(() => null),
    };
    const config = {
      getGlobalGuards: () => [globalGuard],
      getGlobalRequestGuards: () => [wrapper, missingWrapper],
    };
    const creator = new GuardsContextCreator({} as any, config as any);

    expect(creator.getGlobalMetadata({ id: 2 } as any)).toEqual([
      globalGuard,
      scopedGuard,
    ]);
  });
});
