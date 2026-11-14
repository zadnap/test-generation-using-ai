import { describe, expect, it, vi } from 'vitest';
import {
  OPTIONAL_DEPS_METADATA,
  OPTIONAL_PROPERTY_DEPS_METADATA,
  PARAMTYPES_METADATA,
  PROPERTY_DEPS_METADATA,
  SELF_DECLARED_DEPS_METADATA,
} from '../../../../packages/common/constants.js';
import { Scope } from '../../../../packages/common/interfaces/scope-options.interface.js';
import { CircularDependencyException } from '../../../../packages/core/errors/exceptions/circular-dependency.exception.js';
import { RuntimeException } from '../../../../packages/core/errors/exceptions/runtime.exception.js';
import { UndefinedDependencyException } from '../../../../packages/core/errors/exceptions/undefined-dependency.exception.js';
import { UnknownDependenciesException } from '../../../../packages/core/errors/exceptions/unknown-dependencies.exception.js';
import { STATIC_CONTEXT } from '../../../../packages/core/injector/constants.js';
import { INQUIRER } from '../../../../packages/core/injector/inquirer/index.js';
import { Injector } from '../../../../packages/core/injector/injector.js';
import { InstanceWrapper } from '../../../../packages/core/injector/instance-wrapper.js';
import { SettlementSignal } from '../../../../packages/core/injector/settlement-signal.js';

const requestContext = { id: 1 } as any;

let moduleId = 0;

function createModule(options: any = {}) {
  return {
    id: options.id ?? `module-${moduleId++}`,
    metatype: { name: 'ModuleA' },
    providers: options.providers ?? new Map(),
    injectables: options.injectables ?? new Map(),
    controllers: options.controllers ?? new Map(),
    imports: options.imports ?? new Set(),
    exports: options.exports ?? new Set(),
  } as any;
}

function createInjector(options: any = {}) {
  return new Injector({ preview: false, ...options });
}

describe('Injector', () => {
  describe('loadPrototype', () => {
    it('xc1(T): returns when there is no collection', () => {
      const injector = createInjector();
      const wrapper = new InstanceWrapper({ token: 'a', name: 'a' });

      expect(() =>
        injector.loadPrototype(wrapper, undefined as any),
      ).not.toThrow();
    });

    it('xc1(F), xc2(T): stores the created prototype', () => {
      class Provider {}
      const wrapper = new InstanceWrapper({
        token: Provider,
        name: 'Provider',
        metatype: Provider,
        isResolved: false,
      });
      const collection = new Map([[Provider, wrapper]]);
      const injector = createInjector();

      injector.loadPrototype(wrapper, collection);

      expect(wrapper.instance).toBeInstanceOf(Provider);
    });

    it('xc2(F): keeps the instance when no prototype is created', () => {
      const wrapper = new InstanceWrapper({
        token: 'a',
        name: 'a',
        metatype: class {},
        isResolved: true,
      });
      const collection = new Map([['a', wrapper]]);

      createInjector().loadPrototype(wrapper, collection);

      expect(wrapper.instance).toBeUndefined();
    });
  });

  describe('settlement signals', () => {
    it('applies a settlement signal to the host', () => {
      const wrapper = new InstanceWrapper();
      const host = { instance: null } as any;

      const signal = createInjector().applySettlementSignal(host, wrapper);

      expect(host.isPending).toBe(true);
      expect(host.settlementSignal).toBe(signal);
      expect(wrapper.settlementSignal).toBe(signal);
      expect(host.donePromise).toBe(signal.asPromise());
    });
  });

  describe('loadInstance', () => {
    it('xc1(T): throws for a circular pending load', async () => {
      const wrapper = new InstanceWrapper({ token: 'a', name: 'a' });
      const inquirer = new InstanceWrapper({ name: 'inquirer' });
      const signal = new SettlementSignal();
      vi.spyOn(signal, 'isCycle').mockReturnValue(true);
      wrapper.setInstanceByContextId(STATIC_CONTEXT, {
        instance: null,
        isPending: true,
        donePromise: Promise.resolve(),
        settlementSignal: signal,
      });
      const collection = new Map([['a', wrapper]]);

      await expect(
        createInjector().loadInstance(wrapper, collection, createModule(), {
          contextId: STATIC_CONTEXT,
          inquirer,
        }),
      ).rejects.toThrow(CircularDependencyException);
    });

    it('xc1(F): waits for a pending load', async () => {
      const wrapper = new InstanceWrapper({ token: 'a', name: 'a' });
      wrapper.setInstanceByContextId(STATIC_CONTEXT, {
        instance: null,
        isPending: true,
        donePromise: Promise.resolve(),
      });
      const collection = new Map([['a', wrapper]]);

      await expect(
        createInjector().loadInstance(wrapper, collection, createModule()),
      ).resolves.toBeUndefined();
    });

    it('xc2(T): throws when the target wrapper is missing', async () => {
      const wrapper = new InstanceWrapper({ token: 'a', name: 'a' });

      await expect(
        createInjector().loadInstance(
          wrapper,
          new Map(),
          createModule(),
        ),
      ).rejects.toThrow(RuntimeException);
    });

    it('xc2(F), xc3(T): completes already resolved instances', async () => {
      const wrapper = new InstanceWrapper({ token: 'a', name: 'a' });
      wrapper.setInstanceByContextId(STATIC_CONTEXT, {
        instance: 'value',
        isResolved: true,
      });
      const collection = new Map([['a', wrapper]]);

      await expect(
        createInjector().loadInstance(wrapper, collection, createModule()),
      ).resolves.toBeUndefined();
    });

    it('xc3(F), xc4(T): resolves through the constructor callback', async () => {
      class Provider {
        value = 'instance';
      }
      const wrapper = new InstanceWrapper({
        token: Provider,
        name: 'Provider',
        metatype: Provider,
        instance: null,
        isResolved: false,
      });
      const collection = new Map([[Provider, wrapper]]);
      const injector = createInjector();
      injector.resolveConstructorParams = vi.fn(
        async (_wrapper: any, _module: any, _inject: any, callback: any) => {
          await callback([]);
        },
      );

      await injector.loadInstance(wrapper, collection, createModule());

      expect(wrapper.instance).toBeInstanceOf(Provider);
    });

    it('xc4(F): removes the instance and rethrows failures', async () => {
      const error = new Error('load');
      const wrapper = new InstanceWrapper({
        token: 'a',
        name: 'a',
        instance: null,
        isResolved: false,
      });
      const collection = new Map([['a', wrapper]]);
      const injector = createInjector();
      injector.resolveConstructorParams = vi.fn(async () => {
        throw error;
      });

      await expect(
        injector.loadInstance(wrapper, collection, createModule()),
      ).rejects.toThrow(error);
      expect(wrapper.instance).toBeNull();
    });
  });

  describe('resolveConstructorParams', () => {
    it('xc1(T): uses dense constructor metadata', async () => {
      const dependency = new InstanceWrapper({ instance: 'dep' });
      const wrapper = new InstanceWrapper({
        token: 'a',
        name: 'a',
        metatype: class {
          constructor(_dep: unknown) {}
        },
        inject: ['dep'],
      });
      wrapper.addCtorMetadata(0, dependency);
      const injector = createInjector();
      injector.loadCtorMetadata = vi.fn(async () => ['dep-instance']);
      const callback = vi.fn();

      await injector.resolveConstructorParams(
        wrapper,
        createModule(),
        ['dep'],
        callback,
        { contextId: requestContext },
      );

      expect(callback).toHaveBeenCalledWith(['dep-instance']);
    });

    it('xc1(F), xc2(T): resolves class dependencies', async () => {
      class Dep {}
      class Provider {
        constructor(_dep: Dep) {}
      }
      Reflect.defineMetadata(PARAMTYPES_METADATA, [Dep], Provider);
      const wrapper = new InstanceWrapper({
        token: Provider,
        name: 'Provider',
        metatype: Provider,
      });
      const depWrapper = new InstanceWrapper({
        token: Dep,
        name: 'Dep',
        metatype: Dep,
        instance: 'dep',
        isResolved: true,
      });
      const injector = createInjector();
      injector.resolveSingleParam = vi.fn(async () => depWrapper);
      injector.resolveComponentHost = vi.fn(async (_m: any, w: any) => w);
      const callback = vi.fn();

      await injector.resolveConstructorParams(
        wrapper,
        createModule(),
        undefined,
        callback,
      );

      expect(callback).toHaveBeenCalledWith(['dep'], 0);
    });

    it('xc2(F), xc3(T): resolves factory dependencies', async () => {
      const wrapper = new InstanceWrapper({
        token: 'token',
        name: 'token',
        metatype: () => 'value',
        inject: ['dep'],
      });
      const depWrapper = new InstanceWrapper({
        token: 'dep',
        name: 'dep',
        instance: 'dep',
        isResolved: true,
      });
      const injector = createInjector();
      injector.resolveSingleParam = vi.fn(async () => depWrapper);
      injector.resolveComponentHost = vi.fn(async (_m: any, w: any) => w);
      const callback = vi.fn();

      await injector.resolveConstructorParams(
        wrapper,
        createModule(),
        ['dep'],
        callback,
      );

      expect(callback).toHaveBeenCalledWith(['dep'], 0);
    });

    it('xc3(F), xc4(T): injects the parent inquirer', async () => {
      const wrapper = new InstanceWrapper({
        token: 'token',
        name: 'token',
        metatype: class {},
        inject: [INQUIRER],
      });
      const parentInquirer = new InstanceWrapper({ instance: 'inquirer' });
      const injector = createInjector();
      const callback = vi.fn();

      await injector.resolveConstructorParams(
        wrapper,
        createModule(),
        [INQUIRER],
        callback,
        { contextId: STATIC_CONTEXT },
        parentInquirer,
      );

      expect(callback).toHaveBeenCalledWith(['inquirer'], 0);
    });

    it('xc4(F), xc5(T): ignores optional dependency failures', async () => {
      class Dep {}
      class Provider {
        constructor(_dep: Dep) {}
      }
      Reflect.defineMetadata(PARAMTYPES_METADATA, [Dep], Provider);
      Reflect.defineMetadata(OPTIONAL_DEPS_METADATA, [0], Provider);
      const wrapper = new InstanceWrapper({
        token: Provider,
        name: 'Provider',
        metatype: Provider,
      });
      const injector = createInjector();
      injector.resolveSingleParam = vi.fn(async () => {
        throw new Error('missing');
      });
      const callback = vi.fn();

      await injector.resolveConstructorParams(
        wrapper,
        createModule(),
        undefined,
        callback,
      );

      expect(callback).toHaveBeenCalledWith([undefined], 0);
    });

    it('xc5(F): rethrows required dependency failures', async () => {
      class Dep {}
      class Provider {
        constructor(_dep: Dep) {}
      }
      Reflect.defineMetadata(PARAMTYPES_METADATA, [Dep], Provider);
      const wrapper = new InstanceWrapper({
        token: Provider,
        name: 'Provider',
        metatype: Provider,
      });
      const injector = createInjector();
      injector.resolveSingleParam = vi.fn(async () => {
        throw new Error('missing');
      });

      await expect(
        injector.resolveConstructorParams(
          wrapper,
          createModule(),
          undefined,
          vi.fn(),
        ),
      ).rejects.toThrow('missing');
    });
  });

  describe('dependency metadata', () => {
    it('xc1(T): returns class dependencies', () => {
      class Dep {}
      class Provider {
        constructor(_dep: Dep) {}
      }
      Reflect.defineMetadata(PARAMTYPES_METADATA, [Dep], Provider);
      const injector = createInjector();

      const [deps, optional] = injector.getClassDependencies(
        new InstanceWrapper({ metatype: Provider }),
      );

      expect(deps).toEqual([Dep]);
      expect(optional).toEqual([]);
    });

    it('xc1(F): warns for missing decorator metadata', () => {
      class Provider {
        constructor(_a: unknown, _b: unknown) {}
      }
      Reflect.defineMetadata('custom', true, Provider);
      const injector = createInjector();
      const warn = vi.spyOn((injector as any).logger, 'warn');

      injector.getClassDependencies(new InstanceWrapper({ metatype: Provider }));

      expect(warn).toHaveBeenCalledTimes(1);
    });

    it('does not warn without constructor parameters', () => {
      class Provider {}
      Reflect.defineMetadata('custom', true, Provider);
      const injector = createInjector();
      const warn = vi.spyOn((injector as any).logger, 'warn');

      injector.getClassDependencies(new InstanceWrapper({ metatype: Provider }));

      expect(warn).not.toHaveBeenCalled();
    });

    it('does not warn for classes without metadata', () => {
      class Provider {
        constructor(_a: unknown) {}
      }
      const injector = createInjector();
      const warn = vi.spyOn((injector as any).logger, 'warn');

      injector.getClassDependencies(new InstanceWrapper({ metatype: Provider }));

      expect(warn).not.toHaveBeenCalled();
    });

    it('does not warn when paramtypes metadata exists', () => {
      class Provider {
        constructor(_a: unknown) {}
      }
      Reflect.defineMetadata(PARAMTYPES_METADATA, [Object], Provider);
      const injector = createInjector();
      const warn = vi.spyOn((injector as any).logger, 'warn');

      injector.getClassDependencies(new InstanceWrapper({ metatype: Provider }));

      expect(warn).not.toHaveBeenCalled();
    });

    it('does not warn for optional parameters', () => {
      class Provider {
        constructor(_a: unknown) {}
      }
      Reflect.defineMetadata('custom', true, Provider);
      Reflect.defineMetadata(OPTIONAL_DEPS_METADATA, [0], Provider);
      const injector = createInjector();
      const warn = vi.spyOn((injector as any).logger, 'warn');

      injector.getClassDependencies(new InstanceWrapper({ metatype: Provider }));

      expect(warn).not.toHaveBeenCalled();
    });

    it('warns only once per class', () => {
      class Provider {
        constructor(_a: unknown) {}
      }
      Reflect.defineMetadata('custom', true, Provider);
      const injector = createInjector();
      const warn = vi.spyOn((injector as any).logger, 'warn');
      const wrapper = new InstanceWrapper({ metatype: Provider });

      injector.getClassDependencies(wrapper);
      injector.getClassDependencies(wrapper);

      expect(warn).toHaveBeenCalledTimes(1);
    });

    it('xc2(T): returns factory dependencies', () => {
      const wrapper = new InstanceWrapper({
        name: 'factory',
        metatype: () => undefined,
        inject: ['dep'],
      });

      expect(createInjector().getFactoryProviderDependencies(wrapper)).toEqual([
        ['dep'],
        [],
      ]);
    });

    it('xc2(F), xc3(T): marks optional factory dependencies', () => {
      const wrapper = new InstanceWrapper({
        name: 'factory',
        metatype: () => undefined,
        inject: [{ token: 'dep', optional: true }],
      });

      expect(createInjector().getFactoryProviderDependencies(wrapper)).toEqual([
        ['dep'],
        [0],
      ]);
    });

    it('xc3(F): keeps wrapped non-optional dependencies', () => {
      const dependency = { token: 'dep' };
      const wrapper = new InstanceWrapper({
        name: 'factory',
        metatype: () => undefined,
        inject: [dependency],
      });

      expect(createInjector().getFactoryProviderDependencies(wrapper)).toEqual([
        [dependency],
        [],
      ]);
    });

    it('xc4(T): throws for undefined factory tokens', () => {
      const wrapper = new InstanceWrapper({
        name: 'factory',
        metatype: () => undefined,
        inject: [undefined],
      });

      expect(() =>
        createInjector().getFactoryProviderDependencies(wrapper),
      ).toThrow(UndefinedDependencyException);
    });

    it('xc4(F): defaults missing factory inject to an empty list', () => {
      const wrapper = new InstanceWrapper({
        name: 'factory',
        metatype: () => undefined,
      });

      expect(createInjector().getFactoryProviderDependencies(wrapper)).toEqual([
        [],
        [],
      ]);
    });

    it('reflects constructor params with self params', () => {
      class Provider {}
      Reflect.defineMetadata(PARAMTYPES_METADATA, ['a', 'b'], Provider);
      Reflect.defineMetadata(
        SELF_DECLARED_DEPS_METADATA,
        [{ index: 1, param: 'self' }],
        Provider,
      );

      expect(createInjector().reflectConstructorParams(Provider)).toEqual([
        'a',
        'self',
      ]);
    });

    it('reflects optional params', () => {
      class Provider {}
      Reflect.defineMetadata(OPTIONAL_DEPS_METADATA, [1], Provider);

      expect(createInjector().reflectOptionalParams(Provider)).toEqual([1]);
    });

    it('xc1(T): inherits optional params from a parent constructor', () => {
      class Parent {
        constructor(_a: unknown) {}
      }
      Reflect.defineMetadata(OPTIONAL_DEPS_METADATA, [0], Parent);
      class Child extends Parent {}

      expect(createInjector().reflectOptionalParams(Child)).toEqual([0]);
    });

    it('xc1(F), xc2(T): uses the child constructor metadata', () => {
      class Parent {
        constructor(_a: unknown) {}
      }
      Reflect.defineMetadata(OPTIONAL_DEPS_METADATA, [0], Parent);
      class Child extends Parent {
        constructor(_a: unknown) {
          super(_a);
        }
      }
      Reflect.defineMetadata(OPTIONAL_DEPS_METADATA, [1], Child);

      expect(createInjector().reflectOptionalParams(Child)).toEqual([1]);
    });

    it('xc2(F): falls back to the given type', () => {
      class Provider {}

      expect(createInjector().reflectOptionalParams(Provider)).toEqual([]);
    });

    it('reflects self params', () => {
      class Provider {}
      Reflect.defineMetadata(
        SELF_DECLARED_DEPS_METADATA,
        [{ index: 0, param: 'self' }],
        Provider,
      );

      expect(createInjector().reflectSelfParams(Provider)).toEqual([
        { index: 0, param: 'self' },
      ]);
    });
  });

  describe('resolveSingleParam', () => {
    it('xc1(T): throws for an undefined parameter', async () => {
      const wrapper = new InstanceWrapper({ name: 'Provider' });
      const injector = createInjector();

      await expect(
        injector.resolveSingleParam(
          wrapper,
          undefined as any,
          { index: 0, dependencies: [] },
          createModule(),
          0,
        ),
      ).rejects.toThrow(UndefinedDependencyException);
    });

    it('xc1(F): resolves the component wrapper', async () => {
      const wrapper = new InstanceWrapper({ name: 'Provider' });
      const injector = createInjector();
      const resolved = new InstanceWrapper({ name: 'Dep' });
      injector.resolveComponentWrapper = vi.fn(async () => resolved);

      await expect(
        injector.resolveSingleParam(wrapper, 'dep', {}, createModule()),
      ).resolves.toBe(resolved);
    });

    it('xc2(T): resolves forward references', () => {
      class Dep {}
      const wrapper = new InstanceWrapper();

      expect(
        createInjector().resolveParamToken(wrapper, { forwardRef: () => Dep }),
      ).toBe(Dep);
      expect(wrapper.forwardRef).toBe(true);
    });

    it('xc2(F): returns plain tokens', () => {
      const wrapper = new InstanceWrapper();

      expect(createInjector().resolveParamToken(wrapper, 'token')).toBe(
        'token',
      );
      expect(wrapper.forwardRef).toBeUndefined();
    });
  });

  describe('component lookup', () => {
    it('xc1(T): throws when a wrapper depends on itself', async () => {
      const wrapper = new InstanceWrapper({ token: 'a', name: 'a' });

      await expect(
        createInjector().lookupComponent(
          new Map(),
          createModule(),
          { name: 'a', index: 0, dependencies: [] },
          wrapper,
        ),
      ).rejects.toThrow(UnknownDependenciesException);
    });

    it('xc1(F), xc2(T): finds the component in the module', async () => {
      const wrapper = new InstanceWrapper({ token: 'a', name: 'a' });
      const dependency = new InstanceWrapper({ token: 'dep', name: 'dep' });
      const providers = new Map([['dep', dependency]]);
      const injector = createInjector();
      const addMetadata = vi.spyOn(injector as any, 'addDependencyMetadata');

      await expect(
        injector.lookupComponent(
          providers,
          createModule(),
          { name: 'dep' },
          wrapper,
        ),
      ).resolves.toBe(dependency);
      expect(addMetadata).toHaveBeenCalled();
    });

    it('xc2(F): looks in parent modules', async () => {
      const wrapper = new InstanceWrapper({ token: 'a', name: 'a' });
      const dependency = new InstanceWrapper({ token: 'dep', name: 'dep' });
      const injector = createInjector();
      injector.lookupComponentInParentModules = vi.fn(async () => dependency);

      await expect(
        injector.lookupComponent(
          new Map(),
          createModule(),
          { name: 'dep' },
          wrapper,
        ),
      ).resolves.toBe(dependency);
    });

    it('xc3(T): throws when parent modules cannot resolve', async () => {
      const wrapper = new InstanceWrapper({ token: 'a', name: 'a' });
      const injector = createInjector();
      injector.lookupComponentInImports = vi.fn(async () => null);

      await expect(
        injector.lookupComponentInParentModules(
          { name: 'dep', index: 0, dependencies: [] },
          createModule(),
          wrapper,
        ),
      ).rejects.toThrow(UnknownDependenciesException);
    });

    it('xc3(F): returns parent module matches', async () => {
      const wrapper = new InstanceWrapper({ token: 'a', name: 'a' });
      const dependency = new InstanceWrapper({ token: 'dep', name: 'dep' });
      const injector = createInjector();
      injector.lookupComponentInImports = vi.fn(async () => dependency);

      await expect(
        injector.lookupComponentInParentModules(
          { name: 'dep' },
          createModule(),
          wrapper,
        ),
      ).resolves.toBe(dependency);
    });

    it('xc4(T): skips null imports', async () => {
      const wrapper = new InstanceWrapper({ token: 'a', name: 'a' });
      const moduleRef = createModule({ imports: new Set([null]) });

      await expect(
        createInjector().lookupComponentInImports(
          moduleRef,
          'dep',
          wrapper,
        ),
      ).resolves.toBeNull();
    });

    it('xc4(F), xc5(T): skips imports not exported while traversing', async () => {
      const wrapper = new InstanceWrapper({ token: 'a', name: 'a' });
      const imported = createModule();
      const moduleRef = createModule({ imports: new Set([imported]) });

      await expect(
        createInjector().lookupComponentInImports(
          moduleRef,
          'dep',
          wrapper,
          new Set(),
          { contextId: STATIC_CONTEXT },
          undefined,
          true,
        ),
      ).resolves.toBeNull();
    });

    it('xc5(F), xc6(T): skips already visited modules', async () => {
      const wrapper = new InstanceWrapper({ token: 'a', name: 'a' });
      const imported = createModule();
      const moduleRef = createModule({ imports: new Set([imported]) });

      await expect(
        createInjector().lookupComponentInImports(
          moduleRef,
          'dep',
          wrapper,
          new Set([imported.id]),
        ),
      ).resolves.toBeNull();
    });

    it('xc6(F), xc7(T): recurses into nested imports', async () => {
      const wrapper = new InstanceWrapper({ token: 'a', name: 'a' });
      const dependency = new InstanceWrapper({ token: 'dep', name: 'dep' });
      const leaf = createModule({
        providers: new Map([['dep', dependency]]),
        exports: new Set(['dep']),
      });
      const middle = createModule({
        imports: new Set([leaf]),
        exports: new Set([leaf.metatype]),
      });
      const root = createModule({ imports: new Set([middle]) });

      await expect(
        createInjector().lookupComponentInImports(root, 'dep', wrapper),
      ).resolves.toBe(dependency);
    });

    it('xc7(F): returns directly exported providers', async () => {
      const wrapper = new InstanceWrapper({ token: 'a', name: 'a' });
      const dependency = new InstanceWrapper({ token: 'dep', name: 'dep' });
      const imported = createModule({
        providers: new Map([['dep', dependency]]),
        exports: new Set(['dep']),
      });
      const moduleRef = createModule({ imports: new Set([imported]) });

      await expect(
        createInjector().lookupComponentInImports(moduleRef, 'dep', wrapper),
      ).resolves.toBe(dependency);
    });
  });

  describe('properties', () => {
    it('xc1(T): returns no properties for factory providers', async () => {
      const wrapper = new InstanceWrapper({ metatype: () => undefined });

      await expect(
        createInjector().resolveProperties(wrapper, createModule(), ['dep']),
      ).resolves.toEqual([]);
    });

    it('xc1(F), xc2(T): uses complete property metadata', async () => {
      class Provider {
        dep!: unknown;
      }
      Reflect.defineMetadata(
        PROPERTY_DEPS_METADATA,
        [{ key: 'dep', type: 'dep' }],
        Provider,
      );
      const wrapper = new InstanceWrapper({ metatype: Provider });
      const dependency = new InstanceWrapper({ token: 'dep', name: 'dep' });
      wrapper.addPropertiesMetadata('dep', dependency);
      const injector = createInjector();
      injector.loadPropertiesMetadata = vi.fn(async () => [
        { key: 'dep', name: 'dep', instance: 'dep-instance' },
      ]);

      await expect(
        injector.resolveProperties(wrapper, createModule(), undefined, {
          contextId: requestContext,
        }),
      ).resolves.toEqual([
        { key: 'dep', name: 'dep', instance: 'dep-instance' },
      ]);
    });

    it('xc2(F), xc3(T): resolves properties from metadata', async () => {
      class Provider {
        dep!: unknown;
      }
      Reflect.defineMetadata(
        PROPERTY_DEPS_METADATA,
        [{ key: 'dep', type: 'dep' }],
        Provider,
      );
      const wrapper = new InstanceWrapper({ metatype: Provider });
      const dependency = new InstanceWrapper({
        token: 'dep',
        name: 'dep',
        instance: 'dep-instance',
      });
      const injector = createInjector();
      injector.resolveSingleParam = vi.fn(async () => dependency);
      injector.resolveComponentHost = vi.fn(async (_m: any, w: any) => w);

      await expect(
        injector.resolveProperties(wrapper, createModule()),
      ).resolves.toEqual([
        {
          key: 'dep',
          type: 'dep',
          name: 'dep',
          instance: 'dep-instance',
          isOptional: false,
        },
      ]);
    });

    it('xc3(F), xc4(T): injects the parent inquirer', async () => {
      class Provider {
        dep!: unknown;
      }
      Reflect.defineMetadata(
        PROPERTY_DEPS_METADATA,
        [{ key: 'dep', type: INQUIRER }],
        Provider,
      );
      const wrapper = new InstanceWrapper({ metatype: Provider });
      const parentInquirer = new InstanceWrapper({ instance: 'inquirer' });

      await expect(
        createInjector().resolveProperties(
          wrapper,
          createModule(),
          undefined,
          { contextId: STATIC_CONTEXT },
          parentInquirer,
        ),
      ).resolves.toEqual([
        {
          key: 'dep',
          type: INQUIRER,
          name: INQUIRER,
          instance: 'inquirer',
          isOptional: false,
        },
      ]);
    });

    it('xc4(F), xc5(T): ignores optional property failures', async () => {
      class Provider {
        dep!: unknown;
      }
      Reflect.defineMetadata(
        PROPERTY_DEPS_METADATA,
        [{ key: 'dep', type: 'dep' }],
        Provider,
      );
      Reflect.defineMetadata(OPTIONAL_PROPERTY_DEPS_METADATA, ['dep'], Provider);
      const wrapper = new InstanceWrapper({ metatype: Provider });
      const injector = createInjector();
      injector.resolveSingleParam = vi.fn(async () => {
        throw new Error('missing');
      });

      await expect(
        injector.resolveProperties(wrapper, createModule()),
      ).resolves.toEqual([
        {
          key: 'dep',
          type: 'dep',
          name: 'dep',
          instance: undefined,
          isOptional: true,
        },
      ]);
    });

    it('xc5(F): rethrows required property failures', async () => {
      class Provider {
        dep!: unknown;
      }
      Reflect.defineMetadata(
        PROPERTY_DEPS_METADATA,
        [{ key: 'dep', type: 'dep' }],
        Provider,
      );
      const wrapper = new InstanceWrapper({ metatype: Provider });
      const injector = createInjector();
      injector.resolveSingleParam = vi.fn(async () => {
        throw new Error('missing');
      });

      await expect(
        injector.resolveProperties(wrapper, createModule()),
      ).rejects.toThrow('missing');
    });

    it('reflects optional properties', () => {
      class Provider {}
      Reflect.defineMetadata(
        PROPERTY_DEPS_METADATA,
        [{ key: 'dep', type: 'dep' }],
        Provider,
      );
      Reflect.defineMetadata(OPTIONAL_PROPERTY_DEPS_METADATA, ['dep'], Provider);

      expect(createInjector().reflectProperties(Provider)).toEqual([
        { key: 'dep', type: 'dep', name: 'dep', isOptional: true },
      ]);
    });

    it('xc1(T): ignores non-object instances', () => {
      expect(() =>
        createInjector().applyProperties('value' as any, [
          { key: 'dep', name: 'dep', instance: 1 },
        ]),
      ).not.toThrow();
    });

    it('xc1(F), xc2(T): applies non-nil properties', () => {
      const instance: any = {};

      createInjector().applyProperties(instance, [
        { key: 'first', name: 'first', instance: 1 },
        { key: 'second', name: 'second', instance: undefined },
      ]);

      expect(instance).toEqual({ first: 1 });
    });

    it('xc2(F): applies arrays as objects', () => {
      const instance: any = [];
      instance.extra = 0;

      createInjector().applyProperties(instance, [
        { key: 'extra', name: 'extra', instance: 2 },
      ]);

      expect(instance.extra).toBe(2);
    });
  });

  describe('instantiateClass', () => {
    it('xc1(T): returns the instance in preview mode', async () => {
      const injector = createInjector({ preview: true });
      const wrapper = new InstanceWrapper({
        metatype: class Provider {},
        host: { initOnPreview: false } as any,
      });
      const target = new InstanceWrapper({ token: 'p', instance: 'preview' });
      target.setInstanceByContextId(STATIC_CONTEXT, {
        instance: 'preview',
        isResolved: false,
      });

      await expect(
        injector.instantiateClass([], wrapper, target),
      ).resolves.toBe('preview');
    });

    it('xc1(F), xc2(T): constructs classes', async () => {
      class Provider {
        value = 'instance';
      }
      const wrapper = new InstanceWrapper({
        metatype: Provider,
        host: { initOnPreview: true } as any,
      });
      const target = new InstanceWrapper({ token: Provider, metatype: Provider });
      target.setInstanceByContextId(STATIC_CONTEXT, {
        instance: undefined,
        isResolved: false,
      });

      const instance = await createInjector().instantiateClass(
        [],
        wrapper,
        target,
      );

      expect(instance).toBeInstanceOf(Provider);
    });

    it('xc2(F), xc3(T): merges forward reference instances', async () => {
      class Provider {
        value = 'instance';
      }
      const wrapper = new InstanceWrapper({
        metatype: Provider,
        forwardRef: true,
        host: { initOnPreview: true } as any,
      });
      const target = new InstanceWrapper({ token: Provider, metatype: Provider });
      target.setInstanceByContextId(STATIC_CONTEXT, {
        instance: { existing: true },
        isResolved: false,
      });

      const instance = await createInjector().instantiateClass(
        [],
        wrapper,
        target,
      );

      expect(instance).toMatchObject({ existing: true, value: 'instance' });
    });

    it('xc3(F), xc4(T): calls factory providers', async () => {
      const wrapper = new InstanceWrapper({
        metatype: () => 'ignored',
        inject: [],
        host: { initOnPreview: true } as any,
      });
      const target = new InstanceWrapper({
        token: 'token',
        metatype: (value: string) => value,
      });
      target.setInstanceByContextId(STATIC_CONTEXT, {
        instance: undefined,
        isResolved: false,
      });

      await expect(
        createInjector().instantiateClass(['factory'], wrapper, target),
      ).resolves.toBe('factory');
    });

    it('xc4(F): applies the instance decorator', async () => {
      class Provider {}
      const injector = createInjector({
        instanceDecorator: (instance: any) => ({ decorated: instance }),
      });
      const wrapper = new InstanceWrapper({
        metatype: Provider,
        host: { initOnPreview: true } as any,
      });
      const target = new InstanceWrapper({ token: Provider, metatype: Provider });
      target.setInstanceByContextId(STATIC_CONTEXT, {
        instance: undefined,
        isResolved: false,
      });

      const instance = await injector.instantiateClass([], wrapper, target);

      expect(instance).toEqual({ decorated: expect.any(Provider) });
    });

    it('skips construction outside the context', async () => {
      class Provider {}
      const wrapper = new InstanceWrapper({
        metatype: Provider,
      });
      const target = new InstanceWrapper({
        token: Provider,
        metatype: Provider,
      });
      target.setInstanceByContextId(STATIC_CONTEXT, {
        instance: 'placeholder',
        isResolved: false,
      });

      const instance = await createInjector().instantiateClass(
        [],
        wrapper,
        target,
        { contextId: requestContext },
      );

      expect(instance).toBe('placeholder');
    });
  });

  describe('loadPerContext', () => {
    it('xc1(T): finds the wrapper by constructor', async () => {
      class Provider {}
      const wrapper = new InstanceWrapper({ token: Provider, name: 'Provider', scope: Scope.REQUEST });
      const collection = new Map([[Provider, wrapper]]);
      const injector = createInjector();
      injector.loadInstance = vi.fn(async () => undefined);
      injector.loadEnhancersPerContext = vi.fn(async () => undefined);
      injector.waitForDeferredLoads = vi.fn(async () => undefined);
      wrapper.setInstanceByContextId(requestContext, { instance: 'value' });

      await expect(
        injector.loadPerContext(new Provider(), createModule(), collection, requestContext),
      ).resolves.toBe('value');
    });

    it('xc1(F): finds the wrapper by instance', async () => {
      const instance = {};
      const wrapper = new InstanceWrapper({
        token: 'other',
        name: 'other',
        instance,
        scope: Scope.REQUEST,
      });
      const collection = new Map([['other', wrapper]]);
      const injector = createInjector();
      injector.loadInstance = vi.fn(async () => undefined);
      injector.loadEnhancersPerContext = vi.fn(async () => undefined);
      injector.waitForDeferredLoads = vi.fn(async () => undefined);
      wrapper.setInstanceByContextId(requestContext, { instance: 'value' });

      await expect(
        injector.loadPerContext(instance as any, createModule(), collection, requestContext),
      ).resolves.toBe('value');
    });

    it('xc2(T): uses the provided wrapper', async () => {
      const wrapper = new InstanceWrapper({
        token: 'token',
        name: 'token',
        scope: Scope.REQUEST,
      });
      const collection = new Map([['token', wrapper]]);
      const injector = createInjector();
      injector.loadInstance = vi.fn(async () => undefined);
      injector.loadEnhancersPerContext = vi.fn(async () => undefined);
      injector.waitForDeferredLoads = vi.fn(async () => undefined);
      wrapper.setInstanceByContextId(requestContext, { instance: 'value' });

      await expect(
        injector.loadPerContext(
          {} as any,
          createModule(),
          collection,
          requestContext,
          wrapper,
        ),
      ).resolves.toBe('value');
    });

    it('xc2(F): falls back to the given wrapper', async () => {
      const wrapper = new InstanceWrapper({
        token: 'token',
        name: 'token',
        scope: Scope.REQUEST,
      });
      const injector = createInjector();
      injector.loadInstance = vi.fn(async () => undefined);
      injector.loadEnhancersPerContext = vi.fn(async () => undefined);
      injector.waitForDeferredLoads = vi.fn(async () => undefined);
      wrapper.setInstanceByContextId(requestContext, { instance: 'value' });

      await expect(
        injector.loadPerContext(
          {} as any,
          createModule(),
          new Map(),
          requestContext,
          wrapper,
        ),
      ).resolves.toBe('value');
    });
  });

  describe('deferred loads', () => {
    it('xc1(T): returns without deferred loads', async () => {
      await expect(
        createInjector().waitForDeferredLoads(requestContext),
      ).resolves.toBeUndefined();
    });

    it('xc1(F), xc2(T): waits and clears deferred loads', async () => {
      const injector = createInjector();
      const load = Promise.resolve();
      (injector as any).deferredLoads.set(requestContext, new Set([load]));

      await injector.waitForDeferredLoads(requestContext);

      expect((injector as any).deferredLoads.get(requestContext).size).toBe(0);
    });

    it('xc2(F): propagates deferred load failures', async () => {
      const injector = createInjector();
      const error = new Error('deferred');
      (injector as any).deferredLoads.set(
        requestContext,
        new Set([Promise.reject(error)]),
      );

      await expect(
        injector.waitForDeferredLoads(requestContext),
      ).rejects.toThrow(error);
    });
  });

  describe('enhancers', () => {
    it('xc1(T): skips enhancers in the static context', async () => {
      const injector = createInjector();
      const wrapper = new InstanceWrapper();
      const spy = vi.spyOn(injector as any, 'loadEnhancers');

      await injector.loadEnhancersPerContext(wrapper, STATIC_CONTEXT);

      expect(spy).not.toHaveBeenCalled();
    });

    it('xc1(F): loads enhancers per context', async () => {
      const injector = createInjector();
      const enhancer = new InstanceWrapper({
        token: 'e',
        name: 'e',
        host: createModule({ injectables: new Map([['e', new InstanceWrapper()]]) }),
      });
      injector.loadInstance = vi.fn(async () => undefined);

      await injector.loadEnhancersPerContext(
        new InstanceWrapper(),
        requestContext,
        new InstanceWrapper(),
        [enhancer],
      );

      expect(injector.loadInstance).toHaveBeenCalled();
    });
  });

  describe('loadProvider', () => {
    it('xc1(T): skips static bootstrap providers without an inquirer', async () => {
      const wrapper = new InstanceWrapper({
        token: 't',
        name: 't',
        scope: Scope.TRANSIENT,
      });
      const injector = createInjector();
      const lookup = vi
        .spyOn(injector as any, 'lookupSkippedProviderDependencies')
        .mockResolvedValue(undefined);

      await injector.loadProvider(wrapper, createModule());

      expect(lookup).toHaveBeenCalled();
    });

    it('xc1(F), xc2(T): skips with an inquirer without lookup', async () => {
      const wrapper = new InstanceWrapper({
        token: 't',
        name: 't',
        scope: Scope.TRANSIENT,
      });
      const injector = createInjector();
      const lookup = vi
        .spyOn(injector as any, 'lookupSkippedProviderDependencies')
        .mockResolvedValue(undefined);

      await injector.loadProvider(wrapper, createModule(), {
        contextId: STATIC_CONTEXT,
        inquirer: new InstanceWrapper({ scope: Scope.REQUEST }),
      });

      expect(lookup).not.toHaveBeenCalled();
    });

    it('xc2(F), xc3(T): loads regular providers', async () => {
      const wrapper = new InstanceWrapper({ token: 't', name: 't' });
      const injector = createInjector();
      injector.loadInstance = vi.fn(async () => undefined);
      injector.loadEnhancers = vi.fn(async () => undefined);

      await injector.loadProvider(wrapper, createModule());

      expect(injector.loadInstance).toHaveBeenCalled();
    });

    it('xc3(F), xc4(T): loads transient enhancers for static providers', async () => {
      const enhancer = new InstanceWrapper({ scope: Scope.TRANSIENT });
      const wrapper = new InstanceWrapper({ token: 't', name: 't' });
      wrapper.addEnhancerMetadata(enhancer);
      const injector = createInjector();
      injector.loadInstance = vi.fn(async () => undefined);
      injector.loadEnhancers = vi.fn(async () => undefined);

      await injector.loadProvider(wrapper, createModule());

      expect(injector.loadEnhancers).toHaveBeenCalledWith(
        STATIC_CONTEXT,
        wrapper,
        [enhancer],
      );
    });

    it('xc4(F): loads enhancers per context otherwise', async () => {
      const wrapper = new InstanceWrapper({ token: 't', name: 't' });
      const injector = createInjector();
      injector.loadInstance = vi.fn(async () => undefined);
      injector.loadEnhancersPerContext = vi.fn(async () => undefined);

      await injector.loadProvider(wrapper, createModule(), {
        contextId: requestContext,
      });

      expect(injector.loadEnhancersPerContext).toHaveBeenCalled();
    });
  });

  describe('lookupSkippedProviderDependencies', () => {
    it('xc1(T): ignores non-function metatypes', async () => {
      const wrapper = new InstanceWrapper({ metatype: null });
      const injector = createInjector();
      const spy = vi.spyOn(injector, 'getClassDependencies');

      await (injector as any).lookupSkippedProviderDependencies(
        wrapper,
        createModule(),
      );

      expect(spy).not.toHaveBeenCalled();
    });

    it('xc1(F), xc2(T): looks up factory dependencies', async () => {
      const wrapper = new InstanceWrapper({
        name: 'factory',
        metatype: () => undefined,
        inject: ['dep'],
      });
      const injector = createInjector();
      injector.resolveSingleParam = vi.fn(async () => new InstanceWrapper());

      await (injector as any).lookupSkippedProviderDependencies(
        wrapper,
        createModule(),
      );

      expect(injector.resolveSingleParam).toHaveBeenCalled();
    });

    it('xc2(F), xc3(T): looks up class dependencies and properties', async () => {
      class Provider {
        constructor(_dep: unknown) {}
        prop!: unknown;
      }
      Reflect.defineMetadata(PARAMTYPES_METADATA, ['dep'], Provider);
      Reflect.defineMetadata(
        PROPERTY_DEPS_METADATA,
        [{ key: 'prop', type: 'prop' }],
        Provider,
      );
      const wrapper = new InstanceWrapper({ name: 'Provider', metatype: Provider });
      const injector = createInjector();
      injector.resolveSingleParam = vi.fn(async () => new InstanceWrapper());

      await (injector as any).lookupSkippedProviderDependencies(
        wrapper,
        createModule(),
      );

      expect(injector.resolveSingleParam).toHaveBeenCalledTimes(2);
    });

    it('xc3(F), xc4(T): ignores optional lookup failures', async () => {
      class Provider {
        constructor(_dep: unknown) {}
      }
      Reflect.defineMetadata(PARAMTYPES_METADATA, ['dep'], Provider);
      Reflect.defineMetadata(OPTIONAL_DEPS_METADATA, [0], Provider);
      const wrapper = new InstanceWrapper({ name: 'Provider', metatype: Provider });
      const injector = createInjector();
      injector.resolveSingleParam = vi.fn(async () => {
        throw new Error('missing');
      });

      await expect(
        (injector as any).lookupSkippedProviderDependencies(
          wrapper,
          createModule(),
        ),
      ).resolves.toBeUndefined();
    });

    it('xc4(F): throws the first required failure', async () => {
      class Provider {
        constructor(_dep: unknown) {}
      }
      Reflect.defineMetadata(PARAMTYPES_METADATA, ['dep'], Provider);
      const wrapper = new InstanceWrapper({ name: 'Provider', metatype: Provider });
      const injector = createInjector();
      injector.resolveSingleParam = vi.fn(async () => {
        throw new Error('missing');
      });

      await expect(
        (injector as any).lookupSkippedProviderDependencies(
          wrapper,
          createModule(),
        ),
      ).rejects.toThrow('missing');
    });
  });

  describe('controllers, injectables and middleware', () => {
    it('xc1(T): loads static controller enhancers', async () => {
      const wrapper = new InstanceWrapper({ token: 'c', name: 'c' });
      const injector = createInjector();
      injector.loadInstance = vi.fn(async () => undefined);
      injector.loadEnhancers = vi.fn(async () => undefined);

      await injector.loadController(wrapper, createModule());

      expect(injector.loadEnhancers).toHaveBeenCalledWith(
        STATIC_CONTEXT,
        wrapper,
        [],
      );
    });

    it('xc1(F): loads per-context controller enhancers', async () => {
      const wrapper = new InstanceWrapper({
        token: 'c',
        name: 'c',
        scope: Scope.REQUEST,
      });
      const injector = createInjector();
      injector.loadInstance = vi.fn(async () => undefined);
      injector.loadEnhancersPerContext = vi.fn(async () => undefined);

      await injector.loadController(wrapper, createModule());

      expect(injector.loadEnhancersPerContext).toHaveBeenCalled();
    });

    it('loads injectables', async () => {
      const wrapper = new InstanceWrapper({ token: 'i', name: 'i' });
      const injector = createInjector();
      injector.loadInstance = vi.fn(async () => undefined);

      await injector.loadInjectable(wrapper, createModule());

      expect(injector.loadInstance).toHaveBeenCalled();
    });

    it('xc1(T): skips middleware that already has an instance', async () => {
      const wrapper = new InstanceWrapper({ token: 'm', name: 'm' });
      const collection = new Map([['m', wrapper]]);
      wrapper.instance = 'existing';
      const injector = createInjector();
      injector.loadInstance = vi.fn(async () => undefined);

      await injector.loadMiddleware(wrapper, collection, createModule());

      expect(injector.loadInstance).not.toHaveBeenCalled();
    });

    it('xc1(F): creates and loads middleware instances', async () => {
      class Middleware {}
      const wrapper = new InstanceWrapper({
        token: Middleware,
        name: 'Middleware',
        metatype: Middleware,
      });
      const collection = new Map([[Middleware, wrapper]]);
      const injector = createInjector();
      injector.loadInstance = vi.fn(async () => undefined);

      await injector.loadMiddleware(wrapper, collection, createModule());

      expect(wrapper.instance).toBeInstanceOf(Middleware);
      expect(injector.loadInstance).toHaveBeenCalled();
    });
  });

  describe('context helpers', () => {
    it('xc1(T): maps the context through getParent', () => {
      const parent = { id: 2 };
      const contextId = { id: 1, getParent: vi.fn(() => parent) };
      const wrapper = new InstanceWrapper({
        token: 't',
        name: 't',
        scope: Scope.REQUEST,
      });

      expect((createInjector() as any).getContextId(contextId, wrapper)).toBe(
        parent,
      );
      expect(contextId.getParent).toHaveBeenCalledWith({
        token: 't',
        isTreeDurable: false,
      });
    });

    it('xc1(F): returns the same context without getParent', () => {
      const contextId = { id: 1 };

      expect(
        (createInjector() as any).getContextId(contextId, new InstanceWrapper()),
      ).toBe(contextId);
    });

    it('xc2(T): adds property metadata for string keys', () => {
      const wrapper = new InstanceWrapper();
      const dependency = new InstanceWrapper();

      (createInjector() as any).addDependencyMetadata(
        'key',
        wrapper,
        dependency,
      );

      expect(wrapper.getPropertiesMetadata()).toEqual([
        { key: 'key', wrapper: dependency },
      ]);
    });

    it('xc2(F): adds constructor metadata for numeric keys', () => {
      const wrapper = new InstanceWrapper();
      const dependency = new InstanceWrapper();

      (createInjector() as any).addDependencyMetadata(0, wrapper, dependency);

      expect(wrapper.getCtorMetadata()).toEqual([dependency]);
    });
  });

  describe('debug logging', () => {
    it('xc1(T): logs dependency resolution in debug mode', () => {
      process.env.NEST_DEBUG = '1';
      const injector = createInjector();
      const log = vi.spyOn((injector as any).logger, 'log');

      (injector as any).printResolvingDependenciesLog('token', {
        name: 'provider',
      });

      expect(log).toHaveBeenCalled();
      delete process.env.NEST_DEBUG;
    });

    it('xc1(F): does not log without debug mode', () => {
      delete process.env.NEST_DEBUG;
      const injector = createInjector();
      const log = vi.spyOn((injector as any).logger, 'log');

      (injector as any).printResolvingDependenciesLog('token');

      expect(log).not.toHaveBeenCalled();
    });

    it('logs looking-for-provider messages in debug mode', () => {
      process.env.NEST_DEBUG = '1';
      const injector = createInjector();
      const log = vi.spyOn((injector as any).logger, 'log');

      (injector as any).printLookingForProviderLog('token', createModule());

      expect(log).toHaveBeenCalled();
      delete process.env.NEST_DEBUG;
    });

    it('logs found messages in debug mode', () => {
      process.env.NEST_DEBUG = '1';
      const injector = createInjector();
      const log = vi.spyOn((injector as any).logger, 'log');

      (injector as any).printFoundInModuleLog('token', createModule());

      expect(log).toHaveBeenCalled();
      delete process.env.NEST_DEBUG;
    });
  });
});
