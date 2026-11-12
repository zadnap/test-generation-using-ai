import type { FactoryProvider, Provider } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { MULTIPART_MODULE_OPTIONS } from '../../../../packages/platform-fastify/multipart/files.constants.js';
import { MULTIPART_MODULE_ID } from '../../../../packages/platform-fastify/multipart/multipart.constants.js';
import { MultipartModule } from '../../../../packages/platform-fastify/multipart/multipart.module.js';

/**
 * CFG (C3) for MultipartModule:
 *   1c1 options.useExisting || options.useFactory
 *   1c2 options.useFactory (only when useExisting False)
 *   2   options.useFactory
 *   3   options.inject || []
 *   4   options.useExisting || options.useClass
 * Both T/F of every condition are exercised below.
 */
describe('MultipartModule', () => {
  describe('register', () => {
    it('should provide the options and a random module id', () => {
      const options = { dest: '/tmp' };
      const dynamicModule = MultipartModule.register(options);

      expect(dynamicModule.module).toBe(MultipartModule);
      expect(dynamicModule.providers).toHaveLength(2);
      expect(dynamicModule.imports).toBeUndefined();
      expect(dynamicModule.exports).toContain(MULTIPART_MODULE_OPTIONS);

      const optionsProvider = dynamicModule.providers!.find(
        p => 'useFactory' in p && p.provide === MULTIPART_MODULE_OPTIONS,
      ) as FactoryProvider;
      expect(optionsProvider.useFactory()).toBe(options);

      const idProvider = dynamicModule.providers!.find(
        p => p.provide === MULTIPART_MODULE_ID,
      ) as any;
      expect(typeof idProvider.useValue).toBe('string');
      expect(idProvider.useValue.length).toBeGreaterThan(0);
    });

    it('should default to empty options', () => {
      const dynamicModule = MultipartModule.register();
      const optionsProvider = dynamicModule.providers!.find(
        p => 'useFactory' in p && p.provide === MULTIPART_MODULE_OPTIONS,
      ) as FactoryProvider;
      expect(optionsProvider.useFactory()).toEqual({});
    });

    it('should create a distinct module id per registration', () => {
      const id = (m: any) =>
        m.providers.find((p: any) => p.provide === MULTIPART_MODULE_ID)
          .useValue;
      expect(id(MultipartModule.register())).not.toBe(id(MultipartModule.register()));
    });
  });

  describe('registerAsync', () => {
    const optionsProvider = (providers: Provider[] = []) =>
      providers.find(
        p => 'provide' in p && p.provide === MULTIPART_MODULE_OPTIONS,
      ) as any;

    it('should provide the options from useFactory', () => {
      const useFactory = () => ({});
      const dynamicModule = MultipartModule.registerAsync({
        useFactory,
        inject: ['X'],
      });

      expect(dynamicModule.providers).toHaveLength(2);
      expect(dynamicModule.exports).toContain(MULTIPART_MODULE_OPTIONS);
      expect(optionsProvider(dynamicModule.providers)).toMatchObject({
        provide: MULTIPART_MODULE_OPTIONS,
        useFactory,
        inject: ['X'],
      });
    });

    it('should default the useFactory inject list', () => {
      const dynamicModule = MultipartModule.registerAsync({
        useFactory: () => ({}),
      });
      expect(optionsProvider(dynamicModule.providers).inject).toEqual([]);
    });

    it('should provide the options from useExisting', async () => {
      const dynamicModule = MultipartModule.registerAsync({
        useExisting: Object as any,
      });
      expect(dynamicModule.providers).toHaveLength(2);

      const provider = optionsProvider(dynamicModule.providers);
      expect(provider.inject).toEqual([Object]);
      const factory = { createMultipartOptions: vi.fn(() => ({ dest: '/x' })) };
      await expect(provider.useFactory(factory)).resolves.toEqual({ dest: '/x' });
      expect(factory.createMultipartOptions).toHaveBeenCalled();
    });

    it('should register the class and call "createMultipartOptions" for useClass', async () => {
      const dynamicModule = MultipartModule.registerAsync({
        useClass: Object as any,
      });
      expect(dynamicModule.providers).toHaveLength(3);
      expect(dynamicModule.providers).toContainEqual({
        provide: Object,
        useClass: Object,
      });

      const optionsFactory = { createMultipartOptions: vi.fn(() => ({})) };
      await optionsProvider(dynamicModule.providers).useFactory(optionsFactory);
      expect(optionsFactory.createMultipartOptions).toHaveBeenCalled();
    });

    it('should prefer useFactory when both useExisting and useFactory are set', () => {
      const useFactory = () => ({});
      const dynamicModule = MultipartModule.registerAsync({
        useExisting: Object as any,
        useFactory,
      });
      expect(dynamicModule.providers).toHaveLength(2);
      expect(optionsProvider(dynamicModule.providers).useFactory).toBe(useFactory);
    });

    it('should pass through imports', () => {
      class ConfigModule {}
      const dynamicModule = MultipartModule.registerAsync({
        imports: [ConfigModule],
        useFactory: () => ({}),
      });
      expect(dynamicModule.imports).toEqual([ConfigModule]);
    });

    it('should keep an empty imports array', () => {
      const dynamicModule = MultipartModule.registerAsync({
        imports: [],
        useFactory: () => ({}),
      });
      expect(dynamicModule.imports).toEqual([]);
    });

    it('should build the useClass provider when neither useExisting nor useFactory is set', () => {
      const dynamicModule = MultipartModule.registerAsync({} as any);
      expect(dynamicModule.providers).toHaveLength(3);
      expect(dynamicModule.providers).toContainEqual({
        provide: undefined,
        useClass: undefined,
      });
    });
  });
});
