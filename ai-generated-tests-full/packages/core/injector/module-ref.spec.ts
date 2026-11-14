import { describe, expect, it, vi } from 'vitest';
import { Scope } from '../../../../packages/common/interfaces/scope-options.interface.js';
import { RequestScopedCreateException } from '../../../../packages/core/errors/exceptions/request-scoped-create.exception.js';
import { ModuleRef } from '../../../../packages/core/injector/module-ref.js';
import { InstanceWrapper } from '../../../../packages/core/injector/instance-wrapper.js';

class TestModuleRef extends ModuleRef {
  public get(..._args: any[]): any {
    return 'get';
  }

  public resolve(..._args: any[]): any {
    return Promise.resolve('resolve');
  }

  public create(..._args: any[]): any {
    return Promise.resolve('create');
  }

  public instantiate(type: any, moduleRef: any, contextId?: any) {
    return this.instantiateClass(type, moduleRef, contextId);
  }

  public setLinks(links: any) {
    (this as any)._instanceLinksHost = links;
  }
}

function createRef(contextOptions?: any) {
  return new TestModuleRef({
    contextOptions,
    getModules: () => new Map(),
  } as any);
}

describe('ModuleRef', () => {
  it('creates an injector from the context options', () => {
    const ref = createRef({ preview: true, snapshot: true });

    expect((ref as any).injector).toBeDefined();
  });

  it('xc1(T): lazily creates the instance links host', () => {
    const ref = createRef();
    const host = ref as any;

    expect(host.instanceLinksHost).toBe(host.instanceLinksHost);
  });

  it('xc1(F): caches the instance links host', () => {
    const ref = createRef();
    const first = (ref as any).instanceLinksHost;
    const second = (ref as any).instanceLinksHost;

    expect(first).toBe(second);
  });

  it('xc2(T): reports the default scope', () => {
    const ref = createRef();
    ref.setLinks({
      get: () => ({
        wrapperRef: {
          isDependencyTreeStatic: () => true,
          isTransient: false,
        },
      }),
    });

    expect(ref.introspect('token')).toEqual({ scope: Scope.DEFAULT });
  });

  it('xc2(F), xc3(T): reports request scope for non-static trees', () => {
    const ref = createRef();
    ref.setLinks({
      get: () => ({
        wrapperRef: {
          isDependencyTreeStatic: () => false,
          isTransient: false,
        },
      }),
    });

    expect(ref.introspect('token')).toEqual({ scope: Scope.REQUEST });
  });

  it('xc3(F): reports transient scope for static transients', () => {
    const ref = createRef();
    ref.setLinks({
      get: () => ({
        wrapperRef: {
          isDependencyTreeStatic: () => true,
          isTransient: true,
        },
      }),
    });

    expect(ref.introspect('token')).toEqual({ scope: Scope.TRANSIENT });
  });

  it('registers request providers on the container', () => {
    const registerRequestProvider = vi.fn();
    const ref = new TestModuleRef({ registerRequestProvider } as any);
    const contextId = { id: 1 };

    ref.registerRequestByContextId('request', contextId);

    expect(registerRequestProvider).toHaveBeenCalledWith(
      'request',
      contextId,
    );
  });

  describe('instantiateClass', () => {
    it('xc1(T): creates the instance with resolved dependencies', async () => {
      const ref = createRef();
      const injector = (ref as any).injector;
      injector.resolveConstructorParams = vi.fn(
        async (_wrapper: any, _module: any, _args: any, callback: any) => {
          await callback([]);
        },
      );
      injector.resolveProperties = vi.fn(async () => []);
      injector.waitForDeferredLoads = vi.fn(async () => undefined);
      injector.applyProperties = vi.fn();
      class Provider {}

      const instance = await ref.instantiate(Provider, {} as any);

      expect(instance).toBeInstanceOf(Provider);
      expect(injector.applyProperties).toHaveBeenCalledWith(instance, []);
    });

    it('xc1(F): rejects when the constructor callback is skipped', async () => {
      const ref = createRef();
      const injector = (ref as any).injector;
      injector.resolveConstructorParams = vi.fn(async () => undefined);
      class Provider {}

      await expect(ref.instantiate(Provider, {} as any)).rejects.toThrow(
        RequestScopedCreateException,
      );
    });

    it('xc2(T): rejects when dependency resolution fails', async () => {
      const ref = createRef();
      const error = new Error('dependency');
      const injector = (ref as any).injector;
      injector.resolveConstructorParams = vi.fn(async () => {
        throw error;
      });
      class Provider {}

      await expect(ref.instantiate(Provider, {} as any)).rejects.toThrow(
        error,
      );
    });

    it('xc2(F): detaches the wrapper after creation', async () => {
      const ref = createRef();
      const injector = (ref as any).injector;
      injector.resolveConstructorParams = vi.fn(
        async (_wrapper: any, _module: any, _args: any, callback: any) => {
          await callback([]);
        },
      );
      injector.resolveProperties = vi.fn(async () => []);
      injector.waitForDeferredLoads = vi.fn(async () => undefined);
      injector.applyProperties = vi.fn();
      const spy = vi.spyOn(InstanceWrapper.prototype, 'detachFromDependencies');
      class Provider {}

      await ref.instantiate(Provider, {} as any);

      expect(spy).toHaveBeenCalled();
    });
  });
});
