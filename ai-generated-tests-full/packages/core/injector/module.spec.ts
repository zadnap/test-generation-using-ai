import { describe, expect, it, vi } from 'vitest';
import {
  ENTRY_PROVIDER_WATERMARK,
  SCOPE_OPTIONS_METADATA,
} from '../../../../packages/common/constants.js';
import { Scope } from '../../../../packages/common/interfaces/scope-options.interface.js';
import { ApplicationConfig } from '../../../../packages/core/application-config.js';
import { InvalidClassException } from '../../../../packages/core/errors/exceptions/invalid-class.exception.js';
import { InvalidProviderException } from '../../../../packages/core/errors/exceptions/invalid-provider.exception.js';
import { RuntimeException } from '../../../../packages/core/errors/exceptions/runtime.exception.js';
import { UnknownExportException } from '../../../../packages/core/errors/exceptions/unknown-export.exception.js';
import { CONTROLLER_ID_KEY } from '../../../../packages/core/injector/constants.js';
import { Module } from '../../../../packages/core/injector/module.js';
import { ModuleRef } from '../../../../packages/core/injector/module-ref.js';

function createContainer(options: { contextOptions?: any } = {}) {
  return {
    applicationConfig: { id: 'config' },
    contextOptions: options.contextOptions,
  } as any;
}

function createModule(options: { contextOptions?: any; name?: string } = {}) {
  class ModuleA {}
  if (options.name) {
    Object.defineProperty(ModuleA, 'name', { value: options.name });
  }
  return new Module(ModuleA, createContainer(options));
}

describe('Module', () => {
  it('adds the core providers on creation', () => {
    const module = createModule();

    expect(module.providers.has(module.metatype)).toBe(true);
    expect(module.providers.has(ModuleRef)).toBe(true);
    expect(module.providers.has(ApplicationConfig)).toBe(true);
    expect(module.id).toHaveLength(21);
  });

  it('exposes the metatype name', () => {
    expect(createModule({ name: 'MyModule' }).name).toBe('MyModule');
  });

  it('xc1(T): returns the module instance', () => {
    const module = createModule();
    module.providers.get(module.metatype)!.instance = { ready: true };

    expect(module.instance).toEqual({ ready: true });
  });

  it('xc1(F): throws when the module provider is missing', () => {
    const module = createModule();
    module.providers.delete(module.metatype);

    expect(() => module.instance).toThrow(RuntimeException);
  });

  it('xc2(T): reports an instantiated module', () => {
    const module = createModule();
    module.providers.get(module.metatype)!.instance = {};

    expect(module.isInstantiated).toBe(true);
  });

  it('xc2(F): reports a non-instantiated module', () => {
    expect(createModule().isInstantiated).toBe(false);
  });

  it('gets and sets the token, distance and flags', () => {
    const module = createModule();

    module.token = 'token';
    module.distance = 4;
    module.isGlobal = true;
    module.initOnPreview = true;

    expect(module.token).toBe('token');
    expect(module.distance).toBe(4);
    expect(module.isGlobal).toBe(true);
    expect(module.initOnPreview).toBe(true);
  });

  describe('addInjectable', () => {
    it('xc1(T): adds custom injectable providers', () => {
      const module = createModule();

      module.addInjectable(
        { provide: 'token', useValue: 1 },
        'guard',
      );

      expect(module.injectables.get('token')).toBeDefined();
    });

    it('xc1(F): creates a wrapper for class injectables', () => {
      class Guard {}
      const module = createModule();

      const wrapper = module.addInjectable(Guard, 'guard');

      expect(wrapper.metatype).toBe(Guard);
      expect(wrapper.subtype).toBe('guard');
      expect(module.injectables.get(Guard)).toBe(wrapper);
    });

    it('reuses an existing injectable wrapper', () => {
      class Guard {}
      const module = createModule();
      const first = module.addInjectable(Guard, 'guard');
      const second = module.addInjectable(Guard, 'guard');

      expect(second).toBe(first);
    });

    it('xc2(T): links the injectable to a controller host', () => {
      class Guard {}
      class Controller {}
      const module = createModule();
      module.addController(Controller);

      const wrapper = module.addInjectable(Guard, 'guard', Controller);

      expect(
        module.controllers.get(Controller)!.getEnhancersMetadata(),
      ).toEqual([wrapper]);
    });

    it('xc2(F): ignores unknown hosts', () => {
      class Guard {}
      const module = createModule();

      expect(() => module.addInjectable(Guard, 'guard', 'missing')).not.toThrow();
    });
  });

  describe('addProvider', () => {
    it('xc1(T): adds custom providers and tracks entry providers', () => {
      const module = createModule();
      class Entry {}
      Reflect.defineMetadata(ENTRY_PROVIDER_WATERMARK, true, Entry);

      module.addProvider({ provide: Entry, useValue: 1 } as any);

      expect(module.entryProviders).toEqual([module.providers.get(Entry)]);
    });

    it('xc1(F), xc2(T): adds plain class providers', () => {
      class Provider {}
      const module = createModule();

      expect(module.addProvider(Provider)).toBe(Provider);
      expect(module.providers.get(Provider)!.metatype).toBe(Provider);
    });

    it('xc2(F), xc3(T): keeps an already declared transient provider', () => {
      class Provider {}
      Reflect.defineMetadata(
        SCOPE_OPTIONS_METADATA,
        { scope: Scope.TRANSIENT },
        Provider,
      );
      const module = createModule();
      module.addProvider(Provider);
      const wrapper = module.providers.get(Provider);

      expect(module.addProvider(Provider)).toBe(Provider);
      expect(module.providers.get(Provider)).toBe(wrapper);
    });

    it('xc3(F), xc4(T): keeps an already declared request-scoped provider', () => {
      class Provider {}
      Reflect.defineMetadata(
        SCOPE_OPTIONS_METADATA,
        { scope: Scope.REQUEST },
        Provider,
      );
      const module = createModule();
      module.addProvider(Provider);
      const wrapper = module.providers.get(Provider);

      expect(module.addProvider(Provider)).toBe(Provider);
      expect(module.providers.get(Provider)).toBe(wrapper);
    });

    it('xc4(F): replaces an already declared default provider', () => {
      class Provider {}
      const module = createModule();
      module.addProvider(Provider);
      const wrapper = module.providers.get(Provider);

      module.addProvider(Provider);

      expect(module.providers.get(Provider)).not.toBe(wrapper);
    });

    it('tracks plain class entry providers', () => {
      class Provider {}
      Reflect.defineMetadata(ENTRY_PROVIDER_WATERMARK, true, Provider);
      const module = createModule();

      module.addProvider(Provider);

      expect(module.entryProviders).toEqual([module.providers.get(Provider)]);
    });
  });

  describe('custom providers', () => {
    it('xc1(T): detects custom providers', () => {
      const module = createModule();

      expect(module.isCustomProvider({ provide: 'token' } as any)).toBe(true);
    });

    it('xc1(F): rejects plain classes', () => {
      expect(createModule().isCustomProvider(class {} as any)).toBe(false);
    });

    it('xc2(T): adds custom classes', () => {
      class Provider {}
      const module = createModule();

      module.addCustomProvider(
        { provide: 'token', useClass: Provider },
        module.providers,
      );

      expect(module.providers.get('token')!.metatype).toBe(Provider);
    });

    it('xc2(F), xc3(T): adds custom values', () => {
      const module = createModule();

      module.addCustomProvider(
        { provide: 'token', useValue: 42 },
        module.providers,
      );

      expect(module.providers.get('token')!.instance).toBe(42);
    });

    it('xc3(F), xc4(T): adds custom factories', () => {
      const factory = () => 1;
      const module = createModule();

      module.addCustomProvider(
        { provide: 'token', useFactory: factory },
        module.providers,
      );

      expect(module.providers.get('token')!.inject).toEqual([]);
    });

    it('xc4(F), xc5(T): adds useExisting providers as aliases', () => {
      const module = createModule();

      module.addCustomProvider(
        { provide: 'token', useExisting: 'other' },
        module.providers,
      );

      expect(module.providers.get('token')!.isAlias).toBe(true);
    });

    it('xc5(F): throws for invalid providers', () => {
      const module = createModule();

      expect(() =>
        module.addCustomProvider({ provide: 'token' } as any, module.providers),
      ).toThrow(InvalidProviderException);
    });

    it('detects custom provider kinds', () => {
      const module = createModule();

      expect(module.isCustomClass({ provide: 't', useClass: class {} } as any)).toBe(true);
      expect(module.isCustomValue({ provide: 't', useValue: undefined } as any)).toBe(true);
      expect(module.isCustomValue(null as any)).toBe(false);
      expect(module.isCustomFactory({ provide: 't', useFactory: () => 1 } as any)).toBe(true);
      expect(module.isCustomUseExisting({ provide: 't', useExisting: 'o' } as any)).toBe(true);
    });

    it('detects dynamic modules', () => {
      const module = createModule();

      expect(module.isDynamicModule({ module: class {} } as any)).toBeTruthy();
      expect(module.isDynamicModule(class {} as any)).toBeFalsy();
    });

    it('xc6(T): uses explicit custom class scope', () => {
      class Provider {}
      const module = createModule();

      module.addCustomClass(
        {
          provide: 'token',
          useClass: Provider,
          scope: Scope.TRANSIENT,
          durable: true,
        },
        module.providers,
      );

      expect(module.providers.get('token')!.scope).toBe(Scope.TRANSIENT);
      expect(module.providers.get('token')!.durable).toBe(true);
    });

    it('xc6(F), xc7(T): resolves scope from the class metadata', () => {
      class Provider {}
      Reflect.defineMetadata(
        SCOPE_OPTIONS_METADATA,
        { scope: Scope.REQUEST },
        Provider,
      );
      const module = createModule();

      module.addCustomClass(
        { provide: 'token', useClass: Provider },
        module.providers,
      );

      expect(module.providers.get('token')!.scope).toBe(Scope.REQUEST);
    });

    it('xc7(F): names anonymous custom classes by the class itself', () => {
      const module = createModule();
      const useClass = new Function('return class {}')();
      const provider = { provide: 'token', useClass };

      module.addCustomClass(provider as any, module.providers);

      expect(module.providers.get('token')!.name).toBe(provider.useClass);
    });

    it('xc8(T): marks promise values as async', () => {
      const module = createModule();

      module.addCustomValue(
        { provide: 'token', useValue: Promise.resolve(1) },
        module.providers,
      );

      expect(module.providers.get('token')!.async).toBe(true);
    });

    it('xc8(F), xc9(T): applies instance decorators', () => {
      const module = createModule({
        contextOptions: {
          instrument: {
            instanceDecorator: (value: any) => `decorated:${value}`,
          },
        },
      });

      module.addCustomValue(
        { provide: 'token', useValue: 'value' },
        module.providers,
      );

      expect(module.providers.get('token')!.instance).toBe('decorated:value');
    });

    it('xc9(F): uses factory inject defaults', () => {
      const module = createModule();

      module.addCustomFactory(
        { provide: 'token', useFactory: () => 1, inject: undefined as any },
        module.providers,
      );

      expect(module.providers.get('token')!.inject).toEqual([]);
    });

    it('stores useExisting dependencies', () => {
      const module = createModule();

      module.addCustomUseExisting(
        { provide: 'token', useExisting: 'other' },
        module.providers,
      );

      expect(module.providers.get('token')!.inject).toEqual(['other']);
    });
  });

  describe('exports', () => {
    it('xc1(T): exports custom providers', () => {
      const module = createModule();
      module.addProvider({ provide: 'token', useValue: 1 } as any);

      module.addExportedProviderOrModule({
        provide: 'token',
        useValue: 1,
      } as any);

      expect(module.exports.has('token')).toBe(true);
    });

    it('xc1(F), xc2(T): exports string tokens', () => {
      const module = createModule();
      module.addProvider({ provide: 'token', useValue: 1 } as any);

      module.addExportedProviderOrModule('token');

      expect(module.exports.has('token')).toBe(true);
    });

    it('xc2(F), xc3(T): exports symbol tokens', () => {
      const symbol = Symbol('token');
      const module = createModule();
      module.addProvider({ provide: symbol, useValue: 1 } as any);

      module.addExportedProviderOrModule(symbol);

      expect(module.exports.has(symbol)).toBe(true);
    });

    it('xc3(F), xc4(T): exports dynamic modules by class', () => {
      class Exported {}
      const module = createModule();
      module.addImport({ metatype: Exported } as any);

      module.addExportedProviderOrModule({ module: Exported } as any);

      expect(module.exports.has(Exported)).toBe(true);
    });

    it('xc4(F): exports classes', () => {
      class Exported {}
      const module = createModule();
      module.addImport({ metatype: Exported } as any);

      module.addExportedProviderOrModule(Exported);

      expect(module.exports.has(Exported)).toBe(true);
    });

    it('xc5(T): accepts providers declared on the module', () => {
      const module = createModule();
      module.addProvider({ provide: 'token', useValue: 1 } as any);

      expect(module.validateExportedProvider('token')).toBe('token');
    });

    it('xc5(F), xc6(T): accepts imported module metatypes', () => {
      class Imported {}
      const module = createModule();
      module.addImport({ metatype: Imported } as any);

      expect(module.validateExportedProvider(Imported)).toBe(Imported);
    });

    it('xc6(F), xc7(T): throws for function tokens', () => {
      class Unknown {}
      const module = createModule();

      expect(() => module.validateExportedProvider(Unknown)).toThrow(
        UnknownExportException,
      );
    });

    it('xc7(F): throws for string tokens', () => {
      const module = createModule();

      expect(() => module.validateExportedProvider('unknown')).toThrow(
        UnknownExportException,
      );
    });

    it('xc8(T): exports custom string providers', () => {
      const module = createModule();
      module.addProvider({ provide: 'token', useValue: 1 } as any);

      module.addCustomExportedProvider({
        provide: 'token',
        useValue: 1,
      } as any);

      expect(module.exports.has('token')).toBe(true);
    });

    it('xc8(F): exports custom class providers', () => {
      class Provider {}
      const module = createModule();
      module.addProvider({ provide: Provider, useClass: Provider } as any);

      module.addCustomExportedProvider({
        provide: Provider,
        useClass: Provider,
      } as any);

      expect(module.exports.has(Provider)).toBe(true);
    });
  });

  describe('lookup and replacement', () => {
    it('adds controllers with a unique id', () => {
      class Controller {}
      const module = createModule();

      module.addController(Controller);

      expect(module.controllers.get(Controller)!.metatype).toBe(Controller);
      expect((Controller as any)[CONTROLLER_ID_KEY]).toHaveLength(21);
    });

    it('adds imports', () => {
      const module = createModule();
      const imported = createModule();

      module.addImport(imported);

      expect(module.imports.has(imported)).toBe(true);
    });

    it('xc1(T): replaces providers', () => {
      class Provider {}
      const module = createModule();
      module.addProvider(Provider);

      module.replace(Provider, { isProvider: true, useValue: 1 });

      expect(module.providers.get(Provider)!.instance).toBe(1);
    });

    it('xc1(F), xc2(T): replaces injectables', () => {
      class Guard {}
      const module = createModule();
      module.addInjectable(Guard, 'guard');

      module.replace(Guard, { isProvider: false, useValue: 2 });

      expect(module.injectables.get(Guard)!.instance).toBe(2);
    });

    it('xc2(F): ignores unknown replacements', () => {
      const module = createModule();

      expect(module.replace('missing', { isProvider: true })).toBeUndefined();
      expect(module.replace('missing', { isProvider: false })).toBeUndefined();
    });

    it('reports provider and injectable presence', () => {
      class Guard {}
      const module = createModule();
      module.addInjectable(Guard, 'guard');

      expect(module.hasProvider(Guard)).toBe(false);
      expect(module.hasInjectable(Guard)).toBe(true);
    });

    it('gets providers by key and id', () => {
      class Provider {}
      const module = createModule();
      module.addProvider(Provider);
      const wrapper = module.providers.get(Provider)!;

      expect(module.getProviderByKey(Provider)).toBe(wrapper);
      expect(module.getProviderById(wrapper.id)).toBe(wrapper);
      expect(module.getProviderById('missing')).toBeUndefined();
    });

    it('gets controllers, injectables and middlewares by id', () => {
      class Controller {}
      class Guard {}
      const module = createModule();
      module.addController(Controller);
      module.addInjectable(Guard, 'guard');
      const middleware = module.providers.get(ModuleRef)!;
      module.middlewares.set('middleware', middleware);

      expect(module.getControllerById(module.controllers.get(Controller)!.id)).toBe(
        module.controllers.get(Controller),
      );
      expect(module.getControllerById('missing')).toBeUndefined();
      expect(module.getInjectableById(module.injectables.get(Guard)!.id)).toBe(
        module.injectables.get(Guard),
      );
      expect(module.getInjectableById('missing')).toBeUndefined();
      expect(module.getMiddlewareById(middleware.id)).toBe(middleware);
      expect(module.getMiddlewareById('missing')).toBeUndefined();
    });

    it('xc3(T): filters aliases from non-alias providers', () => {
      const module = createModule();
      module.addCustomProvider(
        { provide: 'alias', useExisting: 'other' },
        module.providers,
      );

      expect(
        module.getNonAliasProviders().some(([token]) => token === 'alias'),
      ).toBe(false);
    });

    it('xc3(F): keeps regular providers in the non-alias list', () => {
      const module = createModule();

      expect(
        module.getNonAliasProviders().some(([token]) => token === ModuleRef),
      ).toBe(true);
    });
  });

  describe('module reference', () => {
    it('xc1(T): gets with strict defaults', () => {
      const module = createModule();
      const ModuleRefType = module.createModuleReferenceType();
      const ref = new ModuleRefType();
      const find = vi.fn(() => 'found');
      (ref as any).find = find;

      expect(ref.get('token')).toBe('found');
      expect(find).toHaveBeenCalledWith('token', {
        moduleId: module.id,
        each: false,
      });
    });

    it('xc1(F), xc2(T): passes options through in non-strict mode', () => {
      const module = createModule();
      const ref = new (module.createModuleReferenceType())();
      const find = vi.fn(() => 'found');
      (ref as any).find = find;

      ref.get('token', { strict: false, each: true });

      expect(find).toHaveBeenCalledWith('token', {
        strict: false,
        each: true,
      });
    });

    it('xc2(F): resolves with strict defaults', () => {
      const module = createModule();
      const ref = new (module.createModuleReferenceType())();
      const resolve = vi.fn(async () => 'resolved');
      (ref as any).resolvePerContext = resolve;

      return ref.resolve('token', { id: 1 }).then(result => {
        expect(result).toBe('resolved');
        expect(resolve).toHaveBeenCalledWith(
          'token',
          module,
          { id: 1 },
          { strict: true, each: false },
        );
      });
    });

    it('xc3(T): rejects invalid classes in create', async () => {
      const module = createModule();
      const ref = new (module.createModuleReferenceType())();

      await expect(ref.create(undefined as any)).rejects.toThrow(
        InvalidClassException,
      );
    });

    it('xc3(F): creates valid classes', async () => {
      const module = createModule();
      const ref = new (module.createModuleReferenceType())();
      const instance = { name: 'instance' };
      (ref as any).instantiateClass = vi.fn(async () => instance);
      class Provider {}

      await expect(ref.create(Provider)).resolves.toBe(instance);
    });
  });
});
