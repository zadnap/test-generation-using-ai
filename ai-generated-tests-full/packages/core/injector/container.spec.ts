import { describe, expect, it, vi } from 'vitest';
import { GLOBAL_MODULE_METADATA } from '../../../../packages/common/constants.js';
import { CircularDependencyException } from '../../../../packages/core/errors/exceptions/circular-dependency.exception.js';
import { UndefinedForwardRefException } from '../../../../packages/core/errors/exceptions/undefined-forwardref.exception.js';
import { UnknownModuleException } from '../../../../packages/core/errors/exceptions/unknown-module.exception.js';
import { InitializeOnPreviewAllowlist } from '../../../../packages/core/inspector/initialize-on-preview.allowlist.js';
import { NestContainer } from '../../../../packages/core/injector/container.js';
import { DeepHashedModuleOpaqueKeyFactory } from '../../../../packages/core/injector/opaque-key-factory/deep-hashed-module-opaque-key-factory.js';
import { ByReferenceModuleOpaqueKeyFactory } from '../../../../packages/core/injector/opaque-key-factory/by-reference-module-opaque-key-factory.js';
import { Module } from '../../../../packages/core/injector/module.js';

function setCompiler(container: NestContainer, compile: any) {
  (container as any).moduleCompiler = { compile: vi.fn(compile) };
}

function createContainer(options: any = {}) {
  return new NestContainer(options.applicationConfig, options.contextOptions);
}

describe('NestContainer', () => {
  describe('construction', () => {
    it('xc1(T): uses the deep hashed factory for deep-hash', () => {
      const container = createContainer({
        contextOptions: { moduleIdGeneratorAlgorithm: 'deep-hash' },
      });

      expect(container.getModuleTokenFactory()).toBeInstanceOf(
        DeepHashedModuleOpaqueKeyFactory,
      );
    });

    it('xc1(F), xc2(T): uses shallow keys for snapshots', () => {
      const container = createContainer({
        contextOptions: { snapshot: true },
      });

      expect(container.getModuleTokenFactory()).toBeInstanceOf(
        ByReferenceModuleOpaqueKeyFactory,
      );
    });

    it('xc2(F): uses random keys by default', () => {
      const container = createContainer();

      expect(container.getModuleTokenFactory()).toBeInstanceOf(
        ByReferenceModuleOpaqueKeyFactory,
      );
    });

    it('exposes the application config and context options', () => {
      const applicationConfig = { id: 'config' } as any;
      const contextOptions = { preview: true } as any;
      const container = createContainer({ applicationConfig, contextOptions });

      expect(container.applicationConfig).toBe(applicationConfig);
      expect(container.contextOptions).toBe(contextOptions);
      expect(container.serializedGraph).toBeDefined();
    });
  });

  describe('http adapter', () => {
    it('sets the adapter on the storage and host', () => {
      const container = createContainer();
      const adapter = { get: () => 'x' } as any;

      container.setHttpAdapter(adapter);

      expect(container.getHttpAdapterRef()).toBe(adapter);
      expect(container.getHttpAdapterHostRef().httpAdapter).toBe(adapter);
    });

    it('exposes the http adapter host', () => {
      expect(createContainer().getHttpAdapterHostRef()).toBeDefined();
    });
  });

  describe('addModule', () => {
    it('xc1(T): throws for an undefined module', async () => {
      const container = createContainer();

      await expect(
        container.addModule(undefined as any, []),
      ).rejects.toThrow(UndefinedForwardRefException);
    });

    it('xc1(F), xc2(T): returns an existing module', async () => {
      const container = createContainer();
      class ModuleA {}
      setCompiler(container, async () => ({
        type: ModuleA,
        token: 'token',
        dynamicMetadata: undefined,
      }));
      const first = await container.addModule(ModuleA, []);
      const second = await container.addModule(ModuleA, []);

      expect(second).toEqual({ moduleRef: first!.moduleRef, inserted: false });
    });

    it('xc2(F): inserts a new module', async () => {
      const container = createContainer();
      class ModuleA {}
      setCompiler(container, async () => ({
        type: ModuleA,
        token: 'token',
        dynamicMetadata: undefined,
      }));
      const inserted: Module[] = [];

      const result = await container.addModule(ModuleA, [], inserted);

      expect(result!.inserted).toBe(true);
      expect(result!.moduleRef.token).toBe('token');
      expect(inserted).toEqual([result!.moduleRef]);
      expect(container.getModuleByKey('token')).toBe(result!.moduleRef);
    });

    it('xc3(T): adds dynamic metadata and imported modules', async () => {
      const container = createContainer();
      class ModuleA {}
      class Imported {}
      const compile = vi.fn(async (value: any) =>
        value === ModuleA
          ? {
              type: ModuleA,
              token: 'token',
              dynamicMetadata: { imports: [Imported] },
            }
          : {
              type: Imported,
              token: 'imported',
              dynamicMetadata: undefined,
            },
      );
      setCompiler(container, compile);

      const result = await container.addModule(ModuleA, []);

      expect(container.getDynamicMetadataByToken('token')).toEqual({
        imports: [Imported],
      });
      expect(container.getModuleByKey('imported')).toBeDefined();
      expect(result!.moduleRef).toBeDefined();
    });

    it('xc3(F), xc4(T): marks dynamic global modules', async () => {
      const container = createContainer();
      class ModuleA {}
      setCompiler(container, async () => ({
        type: ModuleA,
        token: 'token',
        dynamicMetadata: { global: true },
      }));

      const result = await container.addModule(ModuleA, []);

      expect(result!.moduleRef.isGlobal).toBe(true);
      expect(result!.moduleRef.distance).toBe(Number.MAX_VALUE);
    });

    it('xc4(F), xc5(T): detects modules marked with the global decorator', async () => {
      const container = createContainer();
      class ModuleA {}
      Reflect.defineMetadata(GLOBAL_MODULE_METADATA, true, ModuleA);
      setCompiler(container, async () => ({
        type: ModuleA,
        token: 'token',
        dynamicMetadata: undefined,
      }));

      const result = await container.addModule(ModuleA, []);

      expect(result!.moduleRef.isGlobal).toBe(true);
    });

    it('xc5(F): leaves regular modules non-global', async () => {
      const container = createContainer();
      class ModuleA {}
      setCompiler(container, async () => ({
        type: ModuleA,
        token: 'token',
        dynamicMetadata: undefined,
      }));

      const result = await container.addModule(ModuleA, []);

      expect(result!.moduleRef.isGlobal).toBe(false);
    });
  });

  describe('replaceModule', () => {
    it('xc1(T): throws when the old module is missing', async () => {
      const container = createContainer();

      await expect(
        container.replaceModule(undefined as any, class {}, []),
      ).rejects.toThrow(UndefinedForwardRefException);
    });

    it('xc1(F), xc2(T): throws when the new module is missing', async () => {
      const container = createContainer();

      await expect(
        container.replaceModule(class {}, undefined as any, []),
      ).rejects.toThrow(UndefinedForwardRefException);
    });

    it('xc2(F): replaces the module definition', async () => {
      const container = createContainer();
      class Old {}
      class New {}
      const compile = vi.fn(async (value: any) => ({
        type: value,
        token: value === Old ? 'old-token' : 'new-token',
        dynamicMetadata: undefined,
      }));
      setCompiler(container, compile);

      const result = await container.replaceModule(Old, New, []);

      expect(result!.inserted).toBe(true);
      expect(result!.moduleRef.metatype).toBe(New);
      expect(container.getModuleByKey('old-token')).toBe(result!.moduleRef);
    });
  });

  describe('dynamic metadata', () => {
    it('xc1(T): ignores missing metadata', async () => {
      const container = createContainer();

      await expect(
        container.addDynamicMetadata('token', undefined as any, []),
      ).resolves.toBeUndefined();
    });

    it('xc1(F): stores metadata', async () => {
      const container = createContainer();

      await container.addDynamicMetadata('token', { providers: [] }, []);

      expect(container.getDynamicMetadataByToken('token')).toEqual({
        providers: [],
      });
    });

    it('xc2(T): ignores missing imports', async () => {
      const container = createContainer();

      await expect(
        container.addDynamicModules(undefined as any, []),
      ).resolves.toBeUndefined();
    });

    it('xc2(F), xc3(T): adds every import', async () => {
      const container = createContainer();
      class Imported {}
      setCompiler(container, async () => ({
        type: Imported,
        token: 'imported',
        dynamicMetadata: undefined,
      }));

      await container.addDynamicModules([Imported], []);

      expect(container.getModuleByKey('imported')).toBeDefined();
    });

    it('xc3(F): rethrows the first rejected import', async () => {
      const container = createContainer();
      const error = new Error('import');
      setCompiler(container, async () => {
        throw error;
      });

      await expect(
        container.addDynamicModules([class {}], []),
      ).rejects.toThrow(error);
    });

    it('xc4(T): returns metadata by key', () => {
      const container = createContainer();
      (container as any).dynamicModulesMetadata.set('token', {
        providers: ['a'],
      });

      expect(container.getDynamicMetadataByToken('token', 'providers')).toEqual(
        ['a'],
      );
    });

    it('xc4(F), xc5(T): defaults missing keys to an empty array', () => {
      const container = createContainer();
      (container as any).dynamicModulesMetadata.set('token', {});

      expect(container.getDynamicMetadataByToken('token', 'providers')).toEqual(
        [],
      );
    });

    it('xc5(F): returns undefined for unknown tokens', () => {
      expect(
        createContainer().getDynamicMetadataByToken('missing'),
      ).toBeUndefined();
    });
  });

  describe('global modules', () => {
    it('xc1(T): accepts dynamic global modules', () => {
      const container = createContainer();

      expect(
        container.isGlobalModule(class {} as any, { global: true }),
      ).toBe(true);
    });

    it('xc1(F), xc2(T): accepts decorated global modules', () => {
      const container = createContainer();
      class ModuleA {}
      Reflect.defineMetadata(GLOBAL_MODULE_METADATA, true, ModuleA);

      expect(container.isGlobalModule(ModuleA)).toBe(true);
    });

    it('xc2(F): rejects regular modules', () => {
      expect(createContainer().isGlobalModule(class {} as any)).toBe(false);
    });

    it('binds globals to imports', () => {
      const container = createContainer();
      const target = { addImport: vi.fn() } as any;
      const globalModule = { addImport: vi.fn() } as any;
      (container as any).globalModules.add(globalModule);

      container.bindGlobalsToImports(target);

      expect(target.addImport).toHaveBeenCalledWith(globalModule);
    });

    it('xc3(T): skips the global module itself', () => {
      const container = createContainer();
      const globalModule = { addImport: vi.fn() } as any;

      container.bindGlobalModuleToModule(globalModule, globalModule);

      expect(globalModule.addImport).not.toHaveBeenCalled();
    });

    it('xc3(F), xc4(T): skips the internal core module', () => {
      const container = createContainer();
      const internalCoreModule = { addImport: vi.fn() } as any;
      (container as any).internalCoreModule = internalCoreModule;

      container.bindGlobalModuleToModule(internalCoreModule, {
        addImport: vi.fn(),
      } as any);

      expect(internalCoreModule.addImport).not.toHaveBeenCalled();
    });

    it('xc4(F): binds a global module to a regular module', () => {
      const container = createContainer();
      const target = { addImport: vi.fn() } as any;
      const globalModule = { addImport: vi.fn() } as any;

      container.bindGlobalModuleToModule(target, globalModule);

      expect(target.addImport).toHaveBeenCalledWith(globalModule);
    });

    it('binds global scope to all modules', () => {
      const container = createContainer();
      const target = { addImport: vi.fn() } as any;
      const globalModule = { addImport: vi.fn() } as any;
      (container as any).globalModules.add(globalModule);
      container.getModules().set('m', target);

      container.bindGlobalScope();

      expect(target.addImport).toHaveBeenCalledWith(globalModule);
    });
  });

  describe('imports', () => {
    it('xc1(T): ignores unknown tokens', async () => {
      const container = createContainer();

      await expect(
        container.addImport(class {} as any, 'missing'),
      ).resolves.toBeUndefined();
    });

    it('xc1(F): adds the compiled import', async () => {
      const container = createContainer();
      class Related {}
      class Target {}
      setCompiler(container, async (value: any) => ({
        type: value,
        token: value === Target ? 'target' : 'related',
        dynamicMetadata: undefined,
      }));
      const result = await container.addModule(Target, []);
      await container.addModule(Related, []);

      await container.addImport(Related, 'target');

      expect(result!.moduleRef.imports.size).toBe(1);
    });
  });

  describe('providers', () => {
    async function setupModule() {
      const container = createContainer();
      class ModuleA {}
      setCompiler(container, async () => ({
        type: ModuleA,
        token: 'token',
        dynamicMetadata: undefined,
      }));
      const { moduleRef } = (await container.addModule(ModuleA, []))!;
      return { container, moduleRef };
    }

    it('xc1(T): throws for a null provider', async () => {
      const { container } = await setupModule();

      expect(() => container.addProvider(null as any, 'token')).toThrow(
        CircularDependencyException,
      );
    });

    it('xc1(F), xc2(T): throws for an unknown module', () => {
      const container = createContainer();

      expect(() =>
        container.addProvider({ provide: 'p', useValue: 1 } as any, 'missing'),
      ).toThrow(UnknownModuleException);
    });

    it('xc2(F): adds providers to the module', async () => {
      const { container, moduleRef } = await setupModule();

      const key = container.addProvider(
        { provide: 'p', useValue: 1 } as any,
        'token',
      );

      expect(key).toBe('p');
      expect(moduleRef.getProviderByKey('p')).toBeDefined();
    });

    it('xc3(T): throws for injectables on unknown modules', () => {
      const container = createContainer();

      expect(() =>
        container.addInjectable(class {}, 'missing', 'guard'),
      ).toThrow(UnknownModuleException);
    });

    it('xc3(F): adds injectables to the module', async () => {
      const { container, moduleRef } = await setupModule();
      class Guard {}

      const wrapper = container.addInjectable(Guard, 'token', 'guard');

      expect(wrapper).toBe(moduleRef.injectables.get(Guard));
    });
  });

  describe('exports and controllers', () => {
    async function setupModule() {
      const container = createContainer();
      class ModuleA {}
      setCompiler(container, async () => ({
        type: ModuleA,
        token: 'token',
        dynamicMetadata: undefined,
      }));
      const { moduleRef } = (await container.addModule(ModuleA, []))!;
      return { container, moduleRef };
    }

    it('xc1(T): throws for exports on unknown modules', async () => {
      const { container } = await setupModule();

      expect(() =>
        container.addExportedProviderOrModule(class {}, 'missing'),
      ).toThrow(UnknownModuleException);
    });

    it('xc1(F), xc2(T): throws for nil exports', async () => {
      const { container } = await setupModule();

      expect(() =>
        container.addExportedProviderOrModule(null as any, 'token'),
      ).toThrow(CircularDependencyException);
    });

    it('xc2(F): exports providers', async () => {
      const { container, moduleRef } = await setupModule();
      container.addProvider({ provide: 'p', useValue: 1 } as any, 'token');

      container.addExportedProviderOrModule('p' as any, 'token');

      expect(moduleRef.exports.has('p')).toBe(true);
    });

    it('xc3(T): throws for controllers on unknown modules', () => {
      const container = createContainer();

      expect(() => container.addController(class {}, 'missing')).toThrow(
        UnknownModuleException,
      );
    });

    it('xc3(F), xc4(T): throws for nil controllers', async () => {
      const { container } = await setupModule();

      expect(() => container.addController(null as any, 'token')).toThrow(
        CircularDependencyException,
      );
    });

    it('xc4(F): adds controllers', async () => {
      const { container, moduleRef } = await setupModule();
      class Controller {}

      container.addController(Controller, 'token');

      expect(moduleRef.controllers.get(Controller)).toBeDefined();
    });
  });

  describe('module lifecycle helpers', () => {
    it('clears modules', () => {
      const container = createContainer();
      container.getModules().set('m', {} as any);

      container.clear();

      expect(container.getModules().size).toBe(0);
    });

    it('xc1(T): skips modules replaced by another instance', () => {
      const container = createContainer();
      const moduleRef = { token: 'token', imports: new Map() } as any;
      container.getModules().set('token', { id: 'other' } as any);

      container.removeModules([moduleRef]);

      expect(container.getModules().size).toBe(1);
    });

    it('xc1(F): removes matching modules and their links', async () => {
      const container = createContainer();
      class ModuleA {}
      setCompiler(container, async () => ({
        type: ModuleA,
        token: 'token',
        dynamicMetadata: undefined,
      }));
      const { moduleRef } = (await container.addModule(ModuleA, []))!;
      const other = new Module(class Other {}, container);
      other.token = 'other';
      container.getModules().set('other', other);
      other.addImport(moduleRef);

      container.removeModules([moduleRef]);

      expect(container.getModules().has('token')).toBe(false);
      expect(other.imports.has(moduleRef)).toBe(false);
    });

    it('xc2(T): removes dynamic metadata', async () => {
      const container = createContainer();
      class ModuleA {}
      setCompiler(container, async () => ({
        type: ModuleA,
        token: 'token',
        dynamicMetadata: { providers: [] },
      }));
      const { moduleRef } = (await container.addModule(ModuleA, []))!;

      container.removeModules([moduleRef]);

      expect(container.getDynamicMetadataByToken('token')).toBeUndefined();
    });

    it('xc2(F): removes global modules', async () => {
      const container = createContainer();
      class ModuleA {}
      Reflect.defineMetadata(GLOBAL_MODULE_METADATA, true, ModuleA);
      setCompiler(container, async () => ({
        type: ModuleA,
        token: 'token',
        dynamicMetadata: undefined,
      }));
      const { moduleRef } = (await container.addModule(ModuleA, []))!;

      container.removeModules([moduleRef]);

      expect((container as any).globalModules.has(moduleRef)).toBe(false);
    });

    it('replaces tokens in every module', () => {
      const container = createContainer();
      const replace = vi.fn();
      container.getModules().set('m', { replace } as any);

      container.replace('token', { scope: null });

      expect(replace).toHaveBeenCalledWith('token', { scope: null });
    });

    it('registers the internal core module', () => {
      const container = createContainer();
      const moduleRef = {} as any;

      container.registerCoreModuleRef(moduleRef);

      expect(container.getInternalCoreModuleRef()).toBe(moduleRef);
      expect((container.getModules() as any).InternalCoreModule).toBe(
        moduleRef,
      );
    });

    it('registers request providers on the core module', () => {
      const container = createContainer();
      const setInstanceByContextId = vi.fn();
      (container as any).internalCoreModule = {
        getProviderByKey: () => ({ setInstanceByContextId }),
      };
      const contextId = { id: 1 };

      container.registerRequestProvider('request', contextId);

      expect(setInstanceByContextId).toHaveBeenCalledWith(contextId, {
        instance: 'request',
        isResolved: true,
      });
    });

    it('xc5(T): marks allowlisted modules for preview initialization', async () => {
      const container = createContainer();
      class ModuleA {}
      InitializeOnPreviewAllowlist.add(ModuleA);
      setCompiler(container, async () => ({
        type: ModuleA,
        token: 'token',
        dynamicMetadata: undefined,
      }));

      const result = await container.addModule(ModuleA, []);

      expect(result!.moduleRef.initOnPreview).toBe(true);
    });

    it('xc5(F): does not mark other modules', async () => {
      const container = createContainer();
      class ModuleA {}
      setCompiler(container, async () => ({
        type: ModuleA,
        token: 'token',
        dynamicMetadata: undefined,
      }));

      const result = await container.addModule(ModuleA, []);

      expect(result!.moduleRef.initOnPreview).toBe(false);
    });
  });
});
