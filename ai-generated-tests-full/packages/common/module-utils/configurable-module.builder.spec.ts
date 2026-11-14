import { describe, expect, it, vi } from 'vitest';
import { ConfigurableModuleBuilder } from '../../../../packages/common/module-utils/configurable-module.builder.js';

describe('ConfigurableModuleBuilder', () => {
  it('builds a module host with defaults', () => {
    const host = new ConfigurableModuleBuilder<any>().build();
    const ModuleClass: any = host.ConfigurableModuleClass;

    expect(typeof ModuleClass.register).toBe('function');
    expect(typeof ModuleClass.registerAsync).toBe('function');
    expect(typeof host.MODULE_OPTIONS_TOKEN).toBe('string');
    expect(() => (host as any).OPTIONS_TYPE.value).toThrow(
      '"OPTIONS_TYPE" is not supposed to be used as a value.',
    );
    expect(() => (host as any).ASYNC_OPTIONS_TYPE.value).toThrow(
      '"ASYNC_OPTIONS_TYPE" is not supposed to be used as a value.',
    );
  });

  it.each([
    ['Cache', 'CACHE_MODULE_OPTIONS'],
    [' cache ', 'CACHE_MODULE_OPTIONS'],
    ['MyCache', 'MY_CACHE_MODULE_OPTIONS'],
  ])('derives the token from moduleName %s', (moduleName, expected) => {
    const host = new ConfigurableModuleBuilder<any>({ moduleName }).build();
    expect(host.MODULE_OPTIONS_TOKEN).toBe(expected);
  });

  it('honours a custom options injection token', () => {
    const token = Symbol('token');
    const host = new ConfigurableModuleBuilder<any>({
      optionsInjectionToken: token,
    }).build();
    expect(host.MODULE_OPTIONS_TOKEN).toBe(token);
  });

  it('creates the synchronous registration provider', () => {
    const host = new ConfigurableModuleBuilder<any>().build();
    const definition = (host.ConfigurableModuleClass as any).register({
      a: 1,
    });
    expect(definition.module).toBe(host.ConfigurableModuleClass);
    expect(definition.providers).toEqual([
      { provide: host.MODULE_OPTIONS_TOKEN, useValue: { a: 1 } },
    ]);
  });

  it('adds a transient id when alwaysTransient is set', () => {
    const host = new ConfigurableModuleBuilder<any>({
      alwaysTransient: true,
    }).build();
    const definition = (host.ConfigurableModuleClass as any).register({});
    expect(definition.providers).toHaveLength(2);
    expect(definition.providers[1].provide).toBe('CONFIGURABLE_MODULE_ID');
    expect(typeof definition.providers[1].useValue).toBe('string');
  });

  it('omits extras from module options and passes them to the transform', () => {
    const transform = vi.fn((definition, extras) => ({
      ...definition,
      global: extras.isGlobal,
    }));
    const host = new ConfigurableModuleBuilder<any>()
      .setExtras({ isGlobal: false }, transform)
      .build();
    const definition = (host.ConfigurableModuleClass as any).register({
      a: 1,
      isGlobal: true,
    });
    expect(definition.providers[0].useValue).toEqual({ a: 1 });
    expect(definition.global).toBe(true);
    expect(transform).toHaveBeenCalledWith(expect.anything(), {
      isGlobal: true,
      a: 1,
    });
  });

  it('keeps options untouched when no extras are configured', () => {
    const host = new ConfigurableModuleBuilder<any>().build();
    const options = { a: 1 };
    const definition = (host.ConfigurableModuleClass as any).register(options);
    expect(definition.providers[0].useValue).toBe(options);
  });

  it('supports a custom static method and factory method name', () => {
    const host = new ConfigurableModuleBuilder<any>()
      .setClassMethodName('forRoot')
      .setFactoryMethodName('createOptions')
      .build();
    const ModuleClass: any = host.ConfigurableModuleClass;
    expect(typeof ModuleClass.forRoot).toBe('function');
    expect(typeof ModuleClass.forRootAsync).toBe('function');

    const definition = ModuleClass.forRoot({ a: 1 });
    expect(definition.providers[0].useValue).toEqual({ a: 1 });
  });

  describe('registerAsync', () => {
    it('uses a factory with injected tokens', () => {
      const factory = () => ({ a: 1 });
      const host = new ConfigurableModuleBuilder<any>().build();
      const definition = (host.ConfigurableModuleClass as any).registerAsync({
        useFactory: factory,
        inject: ['DEP'],
      });
      expect(definition.imports).toEqual([]);
      expect(definition.providers[0]).toEqual({
        provide: host.MODULE_OPTIONS_TOKEN,
        useFactory: factory,
        inject: ['DEP'],
      });
    });

    it('includes imported providers for provideInjectionTokensFrom', () => {
      const dep = { provide: 'DEP', useValue: 1 };
      const host = new ConfigurableModuleBuilder<any>().build();
      const definition = (host.ConfigurableModuleClass as any).registerAsync({
        useFactory: () => ({}),
        inject: ['DEP'],
        provideInjectionTokensFrom: [dep],
      });
      expect(definition.providers).toHaveLength(2);
      expect(definition.providers[1]).toBe(dep);
    });

    it('supports useExisting', async () => {
      const host = new ConfigurableModuleBuilder<any>().build();
      const definition = (host.ConfigurableModuleClass as any).registerAsync({
        useExisting: 'Existing',
      });
      expect(definition.providers).toHaveLength(1);
      const provider = definition.providers[0];
      expect(provider.inject).toEqual(['Existing']);
      await expect(
        provider.useFactory({ create: () => 'created' }),
      ).resolves.toBe('created');
    });

    it('supports useClass', () => {
      class OptionsFactory {}
      const host = new ConfigurableModuleBuilder<any>().build();
      const definition = (host.ConfigurableModuleClass as any).registerAsync({
        useClass: OptionsFactory,
      });
      expect(definition.providers).toHaveLength(2);
      expect(definition.providers[1]).toEqual({
        provide: OptionsFactory,
        useClass: OptionsFactory,
      });
    });

    it('forwards imports and extracts extras from async options', () => {
      const transform = vi.fn((definition, extras) => ({
        ...definition,
        global: extras.isGlobal,
      }));
      const host = new ConfigurableModuleBuilder<any>()
        .setExtras({ isGlobal: false }, transform)
        .build();
      const definition = (host.ConfigurableModuleClass as any).registerAsync({
        useFactory: () => ({}),
        imports: ['Import'],
        isGlobal: true,
      });
      expect(definition.imports).toEqual(['Import']);
      expect(definition.global).toBe(true);
    });

    it('adds a transient id when alwaysTransient is set', () => {
      const host = new ConfigurableModuleBuilder<any>({
        alwaysTransient: true,
      }).build();
      const definition = (host.ConfigurableModuleClass as any).registerAsync({
        useFactory: () => ({}),
      });
      expect(definition.providers.some(p => p.provide === 'CONFIGURABLE_MODULE_ID')).toBe(
        true,
      );
    });
  });
});
