import { describe, expect, it, vi } from 'vitest';
import { STATIC_CONTEXT } from '../../../../packages/core/injector/constants.js';
import { ContextCreator } from '../../../../packages/core/helpers/context-creator.js';

class TestContextCreator extends ContextCreator {
  public createConcreteContext<T extends any[], R extends any[]>(
    metadata: T,
  ): R {
    return ((metadata as any[]) ?? []).map(item => ({ item })) as R;
  }
}

describe('ContextCreator', () => {
  it('xc1(T), xc2(T): combines global, class and method metadata', () => {
    class Controller {}
    const callback = () => undefined;
    Reflect.defineMetadata('key', ['class'], Controller);
    Reflect.defineMetadata('key', ['method'], callback);

    const creator = new TestContextCreator();
    creator.getGlobalMetadata = vi.fn(() => ['global'] as any);

    const context = creator.createContext(
      new Controller() as any,
      callback,
      'key',
    );

    expect(context).toEqual([
      { item: 'global' },
      { item: 'class' },
      { item: 'method' },
    ]);
    expect(creator.getGlobalMetadata).toHaveBeenCalledWith(
      STATIC_CONTEXT,
      undefined,
    );
  });

  it('xc1(F), xc2(F): uses an empty list when no global metadata exists', () => {
    class Controller {}
    const callback = () => undefined;

    const context = new TestContextCreator().createContext(
      new Controller() as any,
      callback,
      'missing',
    );

    expect(context).toEqual([]);
  });

  it('reflects class and method metadata', () => {
    class Controller {}
    const callback = () => undefined;
    Reflect.defineMetadata('class-key', 'class-value', Controller);
    Reflect.defineMetadata('method-key', 'method-value', callback);
    const creator = new TestContextCreator();

    expect(
      creator.reflectClassMetadata(new Controller() as any, 'class-key'),
    ).toBe('class-value');
    expect(creator.reflectMethodMetadata(callback, 'method-key')).toBe(
      'method-value',
    );
  });

  it('xc3(T): delegates context id creation to the parent resolver', () => {
    const creator = new TestContextCreator();
    const parent = { id: 2 };
    const contextId = {
      id: 1,
      getParent: vi.fn(() => parent),
    } as any;
    const wrapper = {
      token: 'TOKEN',
      isDependencyTreeDurable: () => true,
    } as any;

    expect((creator as any).getContextId(contextId, wrapper)).toBe(parent);
    expect(contextId.getParent).toHaveBeenCalledWith({
      token: 'TOKEN',
      isTreeDurable: true,
    });
  });

  it('xc3(F): returns the same context id without a parent resolver', () => {
    const creator = new TestContextCreator();
    const contextId = { id: 1 } as any;
    const wrapper = {
      token: 'TOKEN',
      isDependencyTreeDurable: () => false,
    } as any;

    expect((creator as any).getContextId(contextId, wrapper)).toBe(contextId);
  });
});
