import { describe, expect, it, vi } from 'vitest';
import { Provider } from '../../../../packages/common/interfaces/index.js';
import { ConfigurableModuleBuilder } from '../../../../packages/common/module-utils/configurable-module.builder.js';
import { CONFIGURABLE_MODULE_ID } from '../../../../packages/common/module-utils/constants.js';

describe('ConfigurableModuleBuilder (C3)', () => {
  describe('constructor and builder chaining', () => {
    it('constructs top-level builder with default empty options', () => {
      const builder = new ConfigurableModuleBuilder();
      expect(builder).toBeInstanceOf(ConfigurableModuleBuilder);
    });

    it('inherits properties from parent builder across chain', () => {
      const builder = new ConfigurableModuleBuilder({ moduleName: 'TestModule' })
        .setClassMethodName('forRoot')
        .setFactoryMethodName('createConfig')
        .setExtras({ extra: 1 }, def => ({ ...def, extraApplied: true }));

      const host = builder.build();

      expect(host.ConfigurableModuleClass.forRoot).toBeTypeOf('function');
      expect(host.ConfigurableModuleClass.forRootAsync).toBeTypeOf('function');
      expect(host.MODULE_OPTIONS_TOKEN).toBe('TEST_MODULE_MODULE_OPTIONS');
    });

    it('uses default transformDefinition (identity) when not supplied to setExtras', () => {
      const { ConfigurableModuleClass } = new ConfigurableModuleBuilder()
        .setExtras({ defaultExtra: true })
        .build();

      const def = ConfigurableModuleClass.register({ defaultExtra: false });
      expect(def.module).toBe(ConfigurableModuleClass);
    });
  });

  describe('build options and token generation', () => {
    it.each([
      ['explicit optionsInjectionToken provided', { optionsInjectionToken: 'MY_CUSTOM_TOKEN' }, 'MY_CUSTOM_TOKEN'],
      ['explicit symbol optionsInjectionToken', { optionsInjectionToken: Symbol('CUSTOM_SYM') }, expect.any(Symbol)],
      ['moduleName PascalCase', { moduleName: 'UserAuth' }, 'USER_AUTH_MODULE_OPTIONS'],
      ['moduleName with whitespace', { moduleName: '  PaymentGateway  ' }, 'PAYMENT_GATEWAY_MODULE_OPTIONS'],
    ])('resolves injection token for %s', (_label, options, expectedToken) => {
      const { MODULE_OPTIONS_TOKEN } = new ConfigurableModuleBuilder(options as any).build();
      if (typeof expectedToken === 'symbol') {
        expect(typeof MODULE_OPTIONS_TOKEN).toBe('symbol');
      } else {
        expect(MODULE_OPTIONS_TOKEN).toEqual(expectedToken);
      }
    });

    it('auto-generates random injection token when neither token nor moduleName is provided', () => {
      const { MODULE_OPTIONS_TOKEN } = new ConfigurableModuleBuilder().build();
      expect(typeof MODULE_OPTIONS_TOKEN).toBe('string');
      expect(MODULE_OPTIONS_TOKEN).toMatch(/^CONFIGURABLE_MODULE_OPTIONS\[.+\]$/);
    });
  });

  describe('createTypeProxy behavior', () => {
    it.each([
      ['OPTIONS_TYPE', (host: any) => host.OPTIONS_TYPE.testProp],
      ['ASYNC_OPTIONS_TYPE', (host: any) => host.ASYNC_OPTIONS_TYPE.testProp],
    ])('throws error when accessing property on %s', (name, accessor) => {
      const host = new ConfigurableModuleBuilder().build();
      expect(() => accessor(host)).toThrowError(
        `"${name}" is not supposed to be used as a value.`,
      );
    });
  });

  describe('static registration method [staticMethodKey]', () => {
    describe('alwaysTransient condition', () => {
      it('adds CONFIGURABLE_MODULE_ID provider when alwaysTransient is true', () => {
        const { ConfigurableModuleClass } = new ConfigurableModuleBuilder({
          alwaysTransient: true,
        }).build();

        const definition = ConfigurableModuleClass.register({});
        const idProvider = definition.providers?.find(
          (p: any) => p.provide === CONFIGURABLE_MODULE_ID,
        );

        expect(idProvider).toBeDefined();
        expect(typeof (idProvider as any).useValue).toBe('string');
      });

      it('does not add CONFIGURABLE_MODULE_ID provider when alwaysTransient is false or omitted', () => {
        const { ConfigurableModuleClass } = new ConfigurableModuleBuilder({
          alwaysTransient: false,
        }).build();

        const definition = ConfigurableModuleClass.register({});
        const idProvider = definition.providers?.find(
          (p: any) => p.provide === CONFIGURABLE_MODULE_ID,
        );

        expect(idProvider).toBeUndefined();
      });
    });

    describe('omitExtras condition in static method', () => {
      it('returns input untouched when extras is undefined (no setExtras call)', () => {
        const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN } =
          new ConfigurableModuleBuilder().build();

        const rawInput = { apiKey: 'key123', timeout: 5000 };
        const definition = ConfigurableModuleClass.register(rawInput);
        const optionsProvider = definition.providers?.find(
          (p: any) => p.provide === MODULE_OPTIONS_TOKEN,
        );

        expect((optionsProvider as any).useValue).toEqual(rawInput);
      });

      it('omits keys present in extras from options provider value', () => {
        const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN } =
          new ConfigurableModuleBuilder()
            .setExtras(
              { isGlobal: false, extraTag: 'default' },
              (def, extras) => ({ ...def, global: extras.isGlobal }),
            )
            .build();

        const input = { apiKey: 'secret', isGlobal: true, extraTag: 'custom' };
        const definition = ConfigurableModuleClass.register(input);

        const optionsProvider = definition.providers?.find(
          (p: any) => p.provide === MODULE_OPTIONS_TOKEN,
        );

        expect((optionsProvider as any).useValue).toEqual({ apiKey: 'secret' });
        expect(definition.global).toBe(true);
      });
    });
  });

  describe('async registration method [asyncMethodKey]', () => {
    describe('alwaysTransient condition in async method', () => {
      it('adds CONFIGURABLE_MODULE_ID provider when alwaysTransient is true', () => {
        const { ConfigurableModuleClass } = new ConfigurableModuleBuilder({
          alwaysTransient: true,
        }).build();

        const definition = ConfigurableModuleClass.registerAsync({
          useFactory: () => ({}),
        });

        const idProvider = definition.providers?.find(
          (p: any) => p.provide === CONFIGURABLE_MODULE_ID,
        );
        expect(idProvider).toBeDefined();
      });

      it('does not add CONFIGURABLE_MODULE_ID provider when alwaysTransient is omitted', () => {
        const { ConfigurableModuleClass } = new ConfigurableModuleBuilder().build();

        const definition = ConfigurableModuleClass.registerAsync({
          useFactory: () => ({}),
        });

        const idProvider = definition.providers?.find(
          (p: any) => p.provide === CONFIGURABLE_MODULE_ID,
        );
        expect(idProvider).toBeUndefined();
      });
    });

    describe('imports condition in async method', () => {
      it('preserves provided imports array', () => {
        const { ConfigurableModuleClass } = new ConfigurableModuleBuilder().build();
        const fakeImport = class FakeImportModule {};

        const definition = ConfigurableModuleClass.registerAsync({
          imports: [fakeImport as any],
          useFactory: () => ({}),
        });

        expect(definition.imports).toEqual([fakeImport]);
      });

      it('defaults imports to empty array when omitted', () => {
        const { ConfigurableModuleClass } = new ConfigurableModuleBuilder().build();

        const definition = ConfigurableModuleClass.registerAsync({
          useFactory: () => ({}),
        });

        expect(definition.imports).toEqual([]);
      });
    });

    describe('extractExtrasFromAsyncOptions condition in async method', () => {
      it('returns empty object when extras is undefined (no setExtras call)', () => {
        const { ConfigurableModuleClass } = new ConfigurableModuleBuilder().build();

        const definition = ConfigurableModuleClass.registerAsync({
          useFactory: () => ({}),
        });

        expect(definition).toBeDefined();
      });

      it('extracts non-metadata extras correctly while filtering ASYNC_OPTIONS_METADATA_KEYS', () => {
        let capturedExtras: any;
        const { ConfigurableModuleClass } = new ConfigurableModuleBuilder()
          .setExtras({ customTag: 'default' }, (def, extras) => {
            capturedExtras = extras;
            return def;
          })
          .build();

        ConfigurableModuleClass.registerAsync({
          useFactory: () => ({}),
          inject: ['someToken'],
          imports: [],
          customTag: 'overrideTag',
        } as any);

        expect(capturedExtras).toEqual({ customTag: 'overrideTag' });
      });
    });

    describe('createAsyncProviders branching (useFactory, useExisting, useClass)', () => {
      describe('when useFactory is provided', () => {
        it('resolves injection providers when both inject and provideInjectionTokensFrom are supplied', () => {
          const { ConfigurableModuleClass } = new ConfigurableModuleBuilder().build();
          const upstreamProvider: Provider = {
            provide: 'depToken',
            useValue: 'depVal',
          };

          const definition = ConfigurableModuleClass.registerAsync({
            useFactory: () => ({}),
            inject: ['depToken'],
            provideInjectionTokensFrom: [upstreamProvider],
          });

          expect(definition.providers).toContainEqual(upstreamProvider);
        });

        it('returns only options provider when inject is supplied without provideInjectionTokensFrom', () => {
          const { ConfigurableModuleClass } = new ConfigurableModuleBuilder().build();

          const definition = ConfigurableModuleClass.registerAsync({
            useFactory: () => ({}),
            inject: ['depToken'],
          });

          expect(definition.providers).toHaveLength(1);
          expect((definition.providers![0] as any).inject).toEqual(['depToken']);
        });

        it('defaults inject to empty array when inject is omitted', () => {
          const { ConfigurableModuleClass } = new ConfigurableModuleBuilder().build();

          const definition = ConfigurableModuleClass.registerAsync({
            useFactory: () => ({}),
          });

          expect(definition.providers).toHaveLength(1);
          expect((definition.providers![0] as any).inject).toEqual([]);
        });
      });

      describe('when useExisting is provided', () => {
        it('creates async options provider delegating to existing provider and factory method', async () => {
          const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN } =
            new ConfigurableModuleBuilder()
              .setFactoryMethodName('createOptions')
              .build();

          const existingToken = 'EXISTING_CONFIG_SERVICE';
          const definition = ConfigurableModuleClass.registerAsync({
            useExisting: existingToken,
          });

          expect(definition.providers).toHaveLength(1);
          const provider: any = definition.providers![0];
          expect(provider.provide).toBe(MODULE_OPTIONS_TOKEN);
          expect(provider.inject).toEqual([existingToken]);

          // Test execution of the factory method inside provider.useFactory
          const mockOptionsFactory = {
            createOptions: vi.fn().mockResolvedValue({ loaded: true }),
          };
          const generatedOptions = await provider.useFactory(mockOptionsFactory);

          expect(mockOptionsFactory.createOptions).toHaveBeenCalledOnce();
          expect(generatedOptions).toEqual({ loaded: true });
        });
      });

      describe('when useClass is provided', () => {
        it('creates async options provider plus useClass provider', async () => {
          const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN } =
            new ConfigurableModuleBuilder().build();

          class ConfigFactoryClass {
            create() {
              return { url: 'http://localhost' };
            }
          }

          const definition = ConfigurableModuleClass.registerAsync({
            useClass: ConfigFactoryClass,
          });

          expect(definition.providers).toHaveLength(2);

          const optionsProvider: any = definition.providers?.find(
            (p: any) => p.provide === MODULE_OPTIONS_TOKEN,
          );
          const classProvider: any = definition.providers?.find(
            (p: any) => p.provide === ConfigFactoryClass,
          );

          expect(optionsProvider).toBeDefined();
          expect(optionsProvider.inject).toEqual([ConfigFactoryClass]);

          expect(classProvider).toEqual({
            provide: ConfigFactoryClass,
            useClass: ConfigFactoryClass,
          });

          const factoryInstance = new ConfigFactoryClass();
          const result = await optionsProvider.useFactory(factoryInstance);
          expect(result).toEqual({ url: 'http://localhost' });
        });
      });
    });
  });
});
