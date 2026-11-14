import { Scope } from '../../../../packages/common/interfaces/scope-options.interface.js';
import { describe, expect, it, vi } from 'vitest';
import { AbstractInstanceResolver } from '../../../../packages/core/injector/abstract-instance-resolver.js';
import { InvalidClassScopeException } from '../../../../packages/core/errors/exceptions/invalid-class-scope.exception.js';
import { UnknownElementException } from '../../../../packages/core/errors/exceptions/unknown-element.exception.js';

function link(wrapperRef: any, collection = new Map()) {
  return { wrapperRef, collection, token: 'token', moduleId: 'module' };
}

class Resolver extends AbstractInstanceResolver {
  constructor(
    public instanceLinksHost: any,
    public injector: any,
  ) {
    super();
  }

  protected get(): any {
    return undefined;
  }

  findPublic(typeOrToken: any, options: any) {
    return this.find(typeOrToken, options);
  }

  resolvePublic(typeOrToken: any, contextModule: any, contextId: any, options?: any) {
    return this.resolvePerContext(typeOrToken, contextModule, contextId, options);
  }
}

describe('AbstractInstanceResolver', () => {
  it('xc1(T): throws for request-scoped wrappers', () => {
    const resolver = new Resolver(
      { get: () => link({ scope: Scope.REQUEST }) },
      {},
    );

    expect(() => resolver.findPublic('token', {})).toThrow(
      InvalidClassScopeException,
    );
  });

  it('xc1(F), xc2(T): throws for transient wrappers', () => {
    const resolver = new Resolver(
      { get: () => link({ scope: Scope.TRANSIENT }) },
      {},
    );

    expect(() => resolver.findPublic('token', {})).toThrow(
      InvalidClassScopeException,
    );
  });

  it('xc2(F), xc3(T): throws for non-static dependency trees', () => {
    const resolver = new Resolver(
      {
        get: () =>
          link({
            scope: Scope.DEFAULT,
            isDependencyTreeStatic: () => false,
          }),
      },
      {},
    );

    expect(() => resolver.findPublic('token', {})).toThrow(
      InvalidClassScopeException,
    );
  });

  it('xc3(F), xc4(T): returns a single instance', () => {
    const instance = { name: 'instance' };
    const resolver = new Resolver(
      {
        get: () =>
          link({
            scope: Scope.DEFAULT,
            isDependencyTreeStatic: () => true,
            instance,
          }),
      },
      {},
    );

    expect(resolver.findPublic('token', {})).toBe(instance);
  });

  it('xc4(F): maps an array of links to instances', () => {
    const first = { id: 1 };
    const second = { id: 2 };
    const resolver = new Resolver(
      {
        get: () => [
          link({
            scope: Scope.DEFAULT,
            isDependencyTreeStatic: () => true,
            instance: first,
          }),
          link({
            scope: Scope.DEFAULT,
            isDependencyTreeStatic: () => true,
            instance: second,
          }),
        ],
      },
      {},
    );

    expect(resolver.findPublic('token', { each: true })).toEqual([
      first,
      second,
    ]);
  });

  it('xc5(T): uses a strict module lookup', async () => {
    const instance = { id: 1 };
    const get = vi.fn(() =>
      link({
        isDependencyTreeStatic: () => true,
        isTransient: false,
        instance,
      }),
    );
    const resolver = new Resolver({ get }, {});
    const contextModule = { id: 'module-id' };

    await resolver.resolvePublic('token', contextModule, { id: 1 }, {
      strict: true,
      each: true,
    });

    expect(get).toHaveBeenCalledWith('token', {
      moduleId: 'module-id',
      each: true,
    });
  });

  it('xc5(F): uses a non-strict lookup', async () => {
    const instance = { id: 1 };
    const get = vi.fn(() =>
      link({
        isDependencyTreeStatic: () => true,
        isTransient: false,
        instance,
      }),
    );
    const resolver = new Resolver({ get }, {});

    await resolver.resolvePublic('token', { id: 'module-id' }, { id: 1 }, {
      each: true,
    });

    expect(get).toHaveBeenCalledWith('token', { each: true });
  });

  it('xc6(T): returns a static instance without loading', async () => {
    const instance = { id: 1 };
    const injector = { loadPerContext: vi.fn() };
    const resolver = new Resolver(
      {
        get: () =>
          link({
            isDependencyTreeStatic: () => true,
            isTransient: false,
            instance,
          }),
      },
      injector,
    );

    await expect(
      resolver.resolvePublic('token', { id: 'm' }, { id: 1 }),
    ).resolves.toBe(instance);
    expect(injector.loadPerContext).not.toHaveBeenCalled();
  });

  it('xc6(F), xc7(T): loads a transient instance per context', async () => {
    const loaded = { id: 2 };
    const host = { id: 'host' };
    const collection = new Map();
    const injector = { loadPerContext: vi.fn(async () => loaded) };
    const resolver = new Resolver(
      {
        get: () =>
          link(
            {
              isDependencyTreeStatic: () => true,
              isTransient: true,
              instance: { constructor: class C {} },
              host,
            },
            collection,
          ),
      },
      injector,
    );
    const contextId = { id: 1 };

    await expect(
      resolver.resolvePublic('token', { id: 'm' }, contextId),
    ).resolves.toBe(loaded);
    expect(injector.loadPerContext).toHaveBeenCalledWith(
      expect.anything(),
      host,
      collection,
      contextId,
      expect.anything(),
    );
  });

  it('xc7(F): falls back to the token constructor when there is no instance', async () => {
    const loaded = { id: 3 };
    class Token {}
    const injector = { loadPerContext: vi.fn(async () => loaded) };
    const resolver = new Resolver(
      {
        get: () =>
          link({
            isDependencyTreeStatic: () => false,
            isTransient: false,
            instance: undefined,
            host: {},
          }),
      },
      injector,
    );

    await resolver.resolvePublic(Token, { id: 'm' }, { id: 1 });

    expect(injector.loadPerContext.mock.calls[0][0]).toEqual({
      constructor: Token,
    });
  });

  it('xc8(T): throws when a per-context instance cannot be loaded', async () => {
    const resolver = new Resolver(
      {
        get: () =>
          link({
            isDependencyTreeStatic: () => false,
            isTransient: false,
            instance: undefined,
            host: {},
          }),
      },
      { loadPerContext: async () => undefined },
    );

    await expect(
      resolver.resolvePublic('token', { id: 'm' }, { id: 1 }),
    ).rejects.toThrow(UnknownElementException);
  });

  it('xc8(F): resolves every link in an array', async () => {
    const first = { id: 1 };
    const second = { id: 2 };
    const resolver = new Resolver(
      {
        get: () => [
          link({
            isDependencyTreeStatic: () => true,
            isTransient: false,
            instance: first,
          }),
          link({
            isDependencyTreeStatic: () => true,
            isTransient: false,
            instance: second,
          }),
        ],
      },
      {},
    );

    await expect(
      resolver.resolvePublic('token', { id: 'm' }, { id: 1 }, { each: true }),
    ).resolves.toEqual([first, second]);
  });
});
