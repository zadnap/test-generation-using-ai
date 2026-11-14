import { describe, expect, it, vi } from 'vitest';
import { PIPES_METADATA } from '../../../../packages/common/constants.js';
import { STATIC_CONTEXT } from '../../../../packages/core/injector/constants.js';
import { PipesContextCreator } from '../../../../packages/core/pipes/pipes-context-creator.js';

class Pipe {
  transform(value: unknown) {
    return value;
  }
}

describe('PipesContextCreator', () => {
  it('creates a context for the module', () => {
    const creator = new PipesContextCreator({} as any);
    class Controller {}
    const callback = () => undefined;
    Reflect.defineMetadata(PIPES_METADATA, [], Controller);

    const pipes = creator.create(
      new Controller() as any,
      callback,
      'module',
      STATIC_CONTEXT,
    );

    expect(pipes).toEqual([]);
    expect((creator as any).moduleContext).toBe('module');
  });

  it('xc1(T): returns an empty list for empty metadata', () => {
    const creator = new PipesContextCreator({} as any);

    expect(creator.createConcreteContext([])).toEqual([]);
  });

  it('xc1(F), xc2(T): keeps pipe instances', () => {
    const pipe = new Pipe();
    const creator = new PipesContextCreator({} as any);

    expect(creator.createConcreteContext([pipe])).toEqual([pipe]);
  });

  it('xc2(F): drops invalid pipe values', () => {
    const creator = new PipesContextCreator({} as any);

    expect(creator.createConcreteContext([{}, null] as any)).toEqual([]);
  });

  it('xc3(T): resolves pipe classes from the container', () => {
    const pipe = new Pipe();
    const wrapper = {
      getInstanceByContextId: vi.fn(() => ({ instance: pipe })),
    };
    const container = {
      getModules: () =>
        new Map([['module', { injectables: new Map([[Pipe, wrapper]]) }]]),
    };
    const creator = new PipesContextCreator(container as any);
    (creator as any).moduleContext = 'module';

    expect(creator.createConcreteContext([Pipe])).toEqual([pipe]);
  });

  it('xc3(F): drops pipe classes that cannot be resolved', () => {
    const container = {
      getModules: () => new Map([['module', { injectables: new Map() }]]),
    };
    const creator = new PipesContextCreator(container as any);
    (creator as any).moduleContext = 'module';

    expect(creator.createConcreteContext([Pipe])).toEqual([]);
  });

  it('xc4(T): returns an object pipe unchanged', () => {
    const pipe = { transform: vi.fn() };
    const creator = new PipesContextCreator({} as any);

    expect(creator.getPipeInstance(pipe as any)).toBe(pipe);
  });

  it('xc4(F): returns null for an unregistered pipe class', () => {
    const creator = new PipesContextCreator({} as any);

    expect(creator.getPipeInstance(Pipe)).toBeNull();
  });

  it('returns undefined when there is no module context', () => {
    const creator = new PipesContextCreator({} as any);

    expect(creator.getInstanceByMetatype(Pipe)).toBeUndefined();
  });

  it('returns undefined when the module is missing', () => {
    const creator = new PipesContextCreator({
      getModules: () => new Map(),
    } as any);
    (creator as any).moduleContext = 'missing';

    expect(creator.getInstanceByMetatype(Pipe)).toBeUndefined();
  });

  it('xc5(T): returns no global pipes without a config', () => {
    const creator = new PipesContextCreator({} as any);

    expect(creator.getGlobalMetadata()).toEqual([]);
  });

  it('xc5(F), xc6(T): returns global pipes for the static context', () => {
    const globalPipes = [{ transform: vi.fn() }];
    const config = { getGlobalPipes: () => globalPipes };
    const creator = new PipesContextCreator({} as any, config as any);

    expect(creator.getGlobalMetadata()).toBe(globalPipes);
  });

  it('xc6(F): combines global and scoped pipes', () => {
    const globalPipe = { transform: vi.fn() };
    const scopedPipe = { transform: vi.fn() };
    const wrapper = {
      getInstanceByContextId: vi.fn(() => ({ instance: scopedPipe })),
    };
    const missingWrapper = {
      getInstanceByContextId: vi.fn(() => null),
    };
    const config = {
      getGlobalPipes: () => [globalPipe],
      getGlobalRequestPipes: () => [wrapper, missingWrapper],
    };
    const creator = new PipesContextCreator({} as any, config as any);

    expect(creator.getGlobalMetadata({ id: 2 } as any)).toEqual([
      globalPipe,
      scopedPipe,
    ]);
  });

  it('updates the module context', () => {
    const creator = new PipesContextCreator({} as any);

    creator.setModuleContext('next');

    expect((creator as any).moduleContext).toBe('next');
  });
});
