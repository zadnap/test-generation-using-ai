import { describe, expect, it } from 'vitest';
import { MulterModule } from '../../../../packages/platform-node/multer/multer.module.js';
import {
  MULTER_MODULE_OPTIONS,
} from '../../../../packages/platform-node/multer/files.constants.js';
import { MULTER_MODULE_ID } from '../../../../packages/platform-node/multer/multer.constants.js';

// CFG (C3) of MulterModule:
//   register: options default parameter
//   registerAsync: options.imports present/absent
//   createAsyncProviders: useExisting || useFactory   T/F
//     (short-circuit: useExisting T; useExisting F/useFactory T; both F)
//   createAsyncOptionsProvider: useFactory            T/F
//   createAsyncOptionsProvider: options.inject        T/F
//   createAsyncOptionsProvider: useExisting || useClass  T/F
function providerOf(providers: any[], token: any) {
  return providers.find(provider => provider.provide === token);
}

describe('MulterModule', () => {
  describe('register', () => {
    it('should create a dynamic module with a factory provider', () => {
      const options = { dest: 'uploads' };
      const module = MulterModule.register(options);
      expect(module.module).toBe(MulterModule);
      const optionsProvider = providerOf(module.providers!, MULTER_MODULE_OPTIONS);
      expect(optionsProvider.useFactory!()).toBe(options);
      expect(providerOf(module.providers!, MULTER_MODULE_ID)).toBeDefined();
      expect(module.exports).toEqual([MULTER_MODULE_OPTIONS]);
    });

    it('should use an empty options object by default', () => {
      const module = MulterModule.register();
      const optionsProvider = providerOf(module.providers!, MULTER_MODULE_OPTIONS);
      expect(optionsProvider.useFactory!()).toEqual({});
    });

    it('should give each module a unique id', () => {
      const a = providerOf(MulterModule.register().providers!, MULTER_MODULE_ID);
      const b = providerOf(MulterModule.register().providers!, MULTER_MODULE_ID);
      expect(a.useValue).not.toBe(b.useValue);
    });
  });

  describe('registerAsync', () => {
    it('should copy imports and export the options token', () => {
      const imports = [class ModuleA {}];
      const module = MulterModule.registerAsync({
        imports,
        useFactory: () => ({}),
      });
      expect(module.imports).toBe(imports);
      expect(module.module).toBe(MulterModule);
      expect(module.exports).toEqual([MULTER_MODULE_OPTIONS]);
    });

    it('should create only the async options provider for useFactory', () => {
      const useFactory = () => ({});
      const inject = ['DEP'];
      const module = MulterModule.registerAsync({ useFactory, inject });
      expect(module.providers).toHaveLength(2);
      const optionsProvider = providerOf(module.providers!, MULTER_MODULE_OPTIONS);
      expect(optionsProvider.useFactory).toBe(useFactory);
      expect(optionsProvider.inject).toBe(inject);
    });

    it('should default inject to an empty array', () => {
      const module = MulterModule.registerAsync({ useFactory: () => ({}) });
      expect(
        providerOf(module.providers!, MULTER_MODULE_OPTIONS).inject,
      ).toEqual([]);
    });

    it('should create only the async options provider for useExisting', async () => {
      class OptionsFactory {
        createMulterOptions() {
          return { dest: 'existing' };
        }
      }
      const module = MulterModule.registerAsync({ useExisting: OptionsFactory });
      expect(module.providers).toHaveLength(2);
      const optionsProvider = providerOf(module.providers!, MULTER_MODULE_OPTIONS);
      expect(optionsProvider.inject).toEqual([OptionsFactory]);
      const factory = await optionsProvider.useFactory(new OptionsFactory());
      expect(factory).toEqual({ dest: 'existing' });
    });

    it('should register useClass and delegate to it via useExisting of the class', () => {
      class OptionsFactory {
        createMulterOptions() {
          return { dest: 'class' };
        }
      }
      const module = MulterModule.registerAsync({ useClass: OptionsFactory });
      expect(module.providers).toHaveLength(3);
      expect(
        module.providers!.some(
          (provider: any) =>
            provider.provide === OptionsFactory &&
            provider.useClass === OptionsFactory,
        ),
      ).toBe(true);
      const optionsProvider = providerOf(module.providers!, MULTER_MODULE_OPTIONS);
      expect(optionsProvider.inject).toEqual([OptionsFactory]);
    });
  });
});
