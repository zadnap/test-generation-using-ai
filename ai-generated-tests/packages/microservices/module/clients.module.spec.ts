import { ValueProvider } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { ClientProxy } from '../../../../packages/microservices/client/client-proxy.js';
import { ClientsModule } from '../../../../packages/microservices/module/clients.module.js';

const asAny = <T>(value: T) => value as any;

const clientOptions = (name: string) => ({
  name,
  options: {},
});

const providerValue = (providers: any[], name: string) =>
  (
    providers.find(
      provider => 'useValue' in provider && provider.provide === name,
    ) as ValueProvider
  ).useValue as ClientProxy;

/**
 * `register` decisions:
 *   D1 `Array.isArray(options)`? array -> options are the clients; object ->
 *      `options.clients` is read (and `isGlobal` respected).
 *   D2 `clientsOptions || []`? defined (array/object list) or the empty
 *      fallback for an object without `clients`.
 *   D3 `isGlobal` value on the object form (true/false).
 * Every client also gets the shutdown hook assigned.
 */
describe('ClientsModule.register', () => {
  it('registers an array of clients as non-global providers (D1 array)', () => {
    const dynamicModule = ClientsModule.register([
      clientOptions('first'),
      clientOptions('second'),
    ]);

    expect(dynamicModule.module).toBe(ClientsModule);
    expect(dynamicModule.global).toBe(false);
    expect(dynamicModule.providers).toHaveLength(2);
    expect(dynamicModule.exports).toBe(dynamicModule.providers);

    const first = providerValue(dynamicModule.providers!, 'first');
    expect(first).toBeInstanceOf(ClientProxy);
    expect(asAny(first).onApplicationShutdown).toBe(first.close);
  });

  it('registers the clients of the object form and honours isGlobal true (D1 object, D2 defined, D3 true)', () => {
    const dynamicModule = ClientsModule.register({
      clients: [clientOptions('first')],
      isGlobal: true,
    } as any);

    expect(dynamicModule.global).toBe(true);
    expect(dynamicModule.providers).toHaveLength(1);
    expect(providerValue(dynamicModule.providers!, 'first')).toBeInstanceOf(
      ClientProxy,
    );
  });

  it('keeps isGlobal false on the object form (D3 false)', () => {
    const dynamicModule = ClientsModule.register({
      clients: [],
      isGlobal: false,
    } as any);

    expect(dynamicModule.global).toBe(false);
    expect(dynamicModule.providers).toEqual([]);
  });

  it('falls back to no clients when the object has no clients list (D2 false)', () => {
    const dynamicModule = ClientsModule.register({ isGlobal: true } as any);

    expect(dynamicModule.providers).toEqual([]);
    expect(dynamicModule.exports).toEqual([]);
  });
});

/**
 * `registerAsync` decisions:
 *   D1 `Array.isArray(options)`? array vs object form (`isGlobal`).
 *   D2 `item.extraProviders || []`? present or absent.
 *   D3 `option.imports` present? absent -> reducer keeps the accumulator.
 *   D4 imported item already in the accumulator? true -> skipped, false ->
 *      appended (duplicates across options are removed).
 */
describe('ClientsModule.registerAsync', () => {
  const useFactory = () => clientOptions('test');

  it('registers async providers of the array form (D1 array, D3 false)', () => {
    const dynamicModule = ClientsModule.registerAsync([
      { name: 'test', useFactory } as any,
    ]);

    expect(dynamicModule.module).toBe(ClientsModule);
    expect(dynamicModule.global).toBe(false);
    expect(dynamicModule.imports).toEqual([]);
    expect(dynamicModule.providers).toHaveLength(1);
    expect(dynamicModule.exports).toBe(dynamicModule.providers);
  });

  it('merges extra providers and imports without duplicates (D1 object, D2 true, D4 both)', () => {
    class FirstModule {}
    class SecondModule {}
    const extra = { provide: 'extra', useValue: 'extra' };
    const dynamicModule = ClientsModule.registerAsync({
      isGlobal: true,
      clients: [
        {
          name: 'a',
          useFactory,
          imports: [FirstModule, SecondModule],
          extraProviders: [extra],
        },
        {
          name: 'b',
          useFactory,
          imports: [SecondModule],
        },
      ],
    } as any);

    expect(dynamicModule.global).toBe(true);
    expect(dynamicModule.providers).toHaveLength(3);
    expect(dynamicModule.providers).toContain(extra);
    expect(dynamicModule.imports).toEqual([FirstModule, SecondModule]);
  });

  it('leaves imports empty when an option has none (D3 false)', () => {
    const dynamicModule = ClientsModule.registerAsync([
      { name: 'test', useFactory } as any,
    ]);

    expect(dynamicModule.imports).toEqual([]);
  });
});

/**
 * `createAsyncProviders` decisions:
 *   D1 `options.useExisting` truthy?
 *   D2 `options.useFactory` truthy? (evaluated only when D1 is false)
 *   true -> only the options provider; false -> also a useClass provider.
 */
describe('ClientsModule.createAsyncProviders', () => {
  const create = (options: any) =>
    ClientsModule['createAsyncProviders'](options);

  it('creates one provider for useFactory (D1 false, D2 true)', () => {
    const providers = create({ name: 'a', useFactory: vi.fn() });

    expect(providers).toHaveLength(1);
    expect(providers[0].provide).toBe('a');
  });

  it('creates one provider for useExisting (D1 true)', () => {
    class OptionsFactory {}
    const providers = create({ name: 'a', useExisting: OptionsFactory });

    expect(providers).toHaveLength(1);
    expect((providers[0] as any).inject).toEqual([OptionsFactory]);
  });

  it('creates the useClass provider when neither is given (D1 false, D2 false)', () => {
    class OptionsFactory {}
    const providers = create({ name: 'a', useClass: OptionsFactory });

    expect(providers).toHaveLength(2);
    expect(providers[1]).toEqual({
      provide: OptionsFactory,
      useClass: OptionsFactory,
    });
  });
});

/**
 * `createAsyncOptionsProvider` decisions:
 *   D1 `options.useFactory` truthy? true -> the factory provider, otherwise the
 *      `createClientOptions` wrapper.
 *   D2 `options.inject || []`? inject defined or the empty fallback.
 *   D3 `options.useExisting || options.useClass`? existing token versus class.
 */
describe('ClientsModule.createAsyncOptionsProvider', () => {
  const create = (options: any) =>
    ClientsModule['createAsyncOptionsProvider'](options);

  it('builds the useFactory provider with the given inject list (D1 true, D2 defined)', () => {
    const useFactory = vi.fn(() => clientOptions('a'));
    const provider = create({
      name: 'a',
      useFactory,
      inject: ['dep'],
    }) as any;

    expect(provider.provide).toBe('a');
    expect(provider.inject).toEqual(['dep']);
  });

  it('defaults inject to an empty list (D1 true, D2 false)', () => {
    const provider = create({
      name: 'a',
      useFactory: vi.fn(() => clientOptions('a')),
    }) as any;

    expect(provider.inject).toEqual([]);
  });

  it('builds the options-factory provider injected with useExisting (D1 false, D3 existing)', async () => {
    class OptionsFactory {}
    const provider = create({ name: 'a', useExisting: OptionsFactory }) as any;

    expect(provider.inject).toEqual([OptionsFactory]);
    const optionsFactory = {
      createClientOptions: vi.fn(() => clientOptions('a')),
    };
    const client = await provider.useFactory(optionsFactory);
    expect(optionsFactory.createClientOptions).toHaveBeenCalledTimes(1);
    expect(client).toBeInstanceOf(ClientProxy);
  });

  it('builds the options-factory provider injected with useClass (D1 false, D3 class)', () => {
    class OptionsFactory {}
    const provider = create({ name: 'a', useClass: OptionsFactory }) as any;

    expect(provider.inject).toEqual([OptionsFactory]);
    expect(provider.useFactory).toBeTypeOf('function');
  });
});

/**
 * `createFactoryWrapper`: no decisions; the user factory is awaited, its
 * result fed to ClientProxyFactory and the proxy receives the shutdown hook.
 */
describe('ClientsModule.createFactoryWrapper', () => {
  it('awaits the user factory and returns a client with the shutdown hook', async () => {
    const useFactory = vi.fn(async (_arg: string) => clientOptions('a'));
    const wrapper = ClientsModule['createFactoryWrapper'](useFactory);

    const client = await wrapper('arg');

    expect(useFactory).toHaveBeenCalledWith('arg');
    expect(client).toBeInstanceOf(ClientProxy);
    expect(asAny(client).onApplicationShutdown).toBe(client.close);
  });

  it('propagates a factory rejection', async () => {
    const error = new Error('factory failed');
    const wrapper = ClientsModule['createFactoryWrapper'](
      vi.fn().mockRejectedValue(error),
    );

    await expect(wrapper()).rejects.toBe(error);
  });
});

/**
 * `assignOnAppShutdownHook`: no decisions; assigns `close` as the shutdown
 * hook and returns the same instance.
 */
describe('ClientsModule.assignOnAppShutdownHook', () => {
  it('assigns close to onApplicationShutdown and returns the client', () => {
    const client = {
      close: vi.fn(),
      onApplicationShutdown: undefined as any,
    };

    const result = ClientsModule['assignOnAppShutdownHook'](client as any);

    expect(result).toBe(client);
    expect(client.onApplicationShutdown).toBe(client.close);
  });
});
