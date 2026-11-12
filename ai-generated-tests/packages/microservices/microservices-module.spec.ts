import { ApplicationConfig } from '@nestjs/core';
import { NestContainer } from '@nestjs/core/injector/container.js';
import { GraphInspector } from '@nestjs/core/inspector/graph-inspector.js';
import { RuntimeException } from '@nestjs/core/internal';
import { describe, expect, it, vi } from 'vitest';
import { ListenersController } from '../../../packages/microservices/listeners-controller.js';
import { MicroservicesModule } from '../../../packages/microservices/microservices-module.js';

const asAny = <T>(value: T) => value as any;

const createGraphInspector = (container: NestContainer) =>
  new GraphInspector(container);

const createModule = () => new MicroservicesModule<Record<string, any>>();

/**
 * `register` decisions:
 *   D1 `container.contextOptions` present? true -> its preview/instrument read,
 *      false -> the `?? false` / `?.` fallbacks run (both covered below).
 *   D2 `contextOptions.instrument?.instanceDecorator` present? true/false.
 * Every combination is evaluated; the wiring itself is asserted through the
 * created ListenersController.
 */
describe('MicroservicesModule.register', () => {
  it('registers a listeners controller without context options (D1 false)', () => {
    const container = new NestContainer();
    const module = createModule();

    module.register(
      container,
      createGraphInspector(container),
      new ApplicationConfig(),
      {},
    );

    expect(asAny(module).listenersController).toBeInstanceOf(
      ListenersController,
    );
    expect(asAny(module).appOptions).toEqual({});
  });

  it('reads preview and the instance decorator from the context options (D1 true, D2 true)', () => {
    const container = new NestContainer(undefined, {
      preview: true,
      instrument: { instanceDecorator: vi.fn(target => target) },
    } as any);
    const module = createModule();

    expect(() =>
      module.register(
        container,
        createGraphInspector(container),
        new ApplicationConfig(),
        { preview: true },
      ),
    ).not.toThrow();
    expect(asAny(module).listenersController).toBeInstanceOf(
      ListenersController,
    );
  });

  it('handles context options without an instance decorator (D2 false)', () => {
    const container = new NestContainer(undefined, {
      instrument: {},
    } as any);
    const module = createModule();

    expect(() =>
      module.register(
        container,
        createGraphInspector(container),
        new ApplicationConfig(),
        {},
      ),
    ).not.toThrow();
  });
});

/**
 * `setupListeners` decisions:
 *   D1 listenersController registered? false -> RuntimeException.
 *   Modules are iterated: zero modules and several modules both covered.
 */
describe('MicroservicesModule.setupListeners', () => {
  it('throws before register (D1 false)', () => {
    const module = createModule();
    const container = new NestContainer();

    expect(() => module.setupListeners(container, {} as any)).toThrow(
      RuntimeException,
    );
  });

  it('binds the controllers of every module (D1 true)', () => {
    const container = new NestContainer();
    const module = createModule();
    module.register(
      container,
      createGraphInspector(container),
      new ApplicationConfig(),
      {},
    );
    const server = { listen: vi.fn() };
    const first = new Map<any, any>([['a', { instance: {} }]]);
    const second = new Map<any, any>([
      ['b', { instance: {} }],
      ['c', { instance: {} }],
    ]);
    container.getModules().set('m1', { controllers: first } as any);
    container.getModules().set('m2', { controllers: second } as any);
    const registerPatternHandlers = vi
      .spyOn(asAny(module).listenersController, 'registerPatternHandlers')
      .mockImplementation(() => {});

    module.setupListeners(container, server as any);

    expect(registerPatternHandlers).toHaveBeenCalledTimes(3);
    expect(registerPatternHandlers).toHaveBeenCalledWith(
      first.get('a'),
      server,
      'm1',
    );
    expect(registerPatternHandlers).toHaveBeenCalledWith(
      second.get('c'),
      server,
      'm2',
    );
  });

  it('binds nothing when the container has no modules (D1 true, empty)', () => {
    const container = new NestContainer();
    const module = createModule();
    module.register(
      container,
      createGraphInspector(container),
      new ApplicationConfig(),
      {},
    );
    const registerPatternHandlers = vi
      .spyOn(asAny(module).listenersController, 'registerPatternHandlers')
      .mockImplementation(() => {});

    module.setupListeners(container, {} as any);

    expect(registerPatternHandlers).not.toHaveBeenCalled();
  });
});

/**
 * `setupClients` decisions:
 *   D1 listenersController registered? false -> RuntimeException.
 *   D2 `appOptions?.preview` truthy? true -> clients are left unassigned.
 *      false/nullish -> controllers and providers are bound.
 *   D3 `appOptions` itself present? The `?.` false branch is only reachable
 *      with a manually injected controller (register always sets appOptions),
 *      so it is exercised explicitly.
 */
describe('MicroservicesModule.setupClients', () => {
  it('throws before register (D1 false)', () => {
    const module = createModule();

    expect(() => module.setupClients(new NestContainer())).toThrow(
      RuntimeException,
    );
  });

  it('skips binding in preview mode (D1 true, D2 true)', () => {
    const container = new NestContainer();
    const module = createModule();
    module.register(
      container,
      createGraphInspector(container),
      new ApplicationConfig(),
      { preview: true },
    );
    const assignClients = vi
      .spyOn(asAny(module).listenersController, 'assignClientsToProperties')
      .mockImplementation(() => {});

    module.setupClients(container);

    expect(assignClients).not.toHaveBeenCalled();
  });

  it('binds the controllers and providers of every module (D2 false)', () => {
    const container = new NestContainer();
    const module = createModule();
    module.register(
      container,
      createGraphInspector(container),
      new ApplicationConfig(),
      {},
    );
    const controllers = new Map<any, any>([
      ['c1', { instance: {}, isNotMetatype: false }],
    ]);
    const providers = new Map<any, any>([
      ['p1', { instance: {}, isNotMetatype: false }],
      ['p2', { instance: {}, isNotMetatype: true }],
    ]);
    container.getModules().set('m1', { controllers, providers } as any);
    const assignClients = vi
      .spyOn(asAny(module).listenersController, 'assignClientsToProperties')
      .mockImplementation(() => {});

    module.setupClients(container);

    expect(assignClients).toHaveBeenCalledTimes(2);
    expect(assignClients).toHaveBeenCalledWith(controllers.get('c1').instance);
    expect(assignClients).toHaveBeenCalledWith(providers.get('p1').instance);
  });

  it('treats a missing appOptions as not in preview mode (D3 false)', () => {
    const container = new NestContainer();
    const module = createModule();
    asAny(module).listenersController = {
      assignClientsToProperties: vi.fn(),
    };
    container.getModules().set('m1', {
      controllers: new Map([['c1', { instance: {}, isNotMetatype: false }]]),
      providers: new Map(),
    } as any);

    expect(() => module.setupClients(container)).not.toThrow();
    expect(
      asAny(module).listenersController.assignClientsToProperties,
    ).toHaveBeenCalledTimes(1);
  });
});

/**
 * `bindListeners`: no decisions; the listener controller receives each
 * wrapper, the server and the module token.
 */
describe('MicroservicesModule.bindListeners', () => {
  it('forwards every controller wrapper to the listeners controller', () => {
    const container = new NestContainer();
    const module = createModule();
    module.register(
      container,
      createGraphInspector(container),
      new ApplicationConfig(),
      {},
    );
    const registerPatternHandlers = vi
      .spyOn(asAny(module).listenersController, 'registerPatternHandlers')
      .mockImplementation(() => {});
    const controllers = new Map<any, any>([
      ['a', { instance: 'a' }],
      ['b', { instance: 'b' }],
    ]);
    const server = {};

    module.bindListeners(controllers, server as any, 'token');

    expect(registerPatternHandlers).toHaveBeenNthCalledWith(
      1,
      controllers.get('a'),
      server,
      'token',
    );
    expect(registerPatternHandlers).toHaveBeenNthCalledWith(
      2,
      controllers.get('b'),
      server,
      'token',
    );
  });
});

/**
 * `bindClients` decision:
 *   D1 `isNotMetatype` false? -> assign; true -> skip.
 */
describe('MicroservicesModule.bindClients', () => {
  it('assigns metatype wrappers and skips non-metatype ones (D1 both)', () => {
    const container = new NestContainer();
    const module = createModule();
    module.register(
      container,
      createGraphInspector(container),
      new ApplicationConfig(),
      {},
    );
    const assignClients = vi
      .spyOn(asAny(module).listenersController, 'assignClientsToProperties')
      .mockImplementation(() => {});
    const metatype = { instance: { value: 1 }, isNotMetatype: false };
    const nonMetatype = { instance: { value: 2 }, isNotMetatype: true };

    module.bindClients(
      new Map<any, any>([
        ['a', metatype],
        ['b', nonMetatype],
      ]),
    );

    expect(assignClients).toHaveBeenCalledTimes(1);
    expect(assignClients).toHaveBeenCalledWith(metatype.instance);
  });
});

/**
 * `close` has no decisions: every client is closed, then the container is
 * cleared. Zero clients and several clients are covered.
 */
describe('MicroservicesModule.close', () => {
  it('closes every registered client and clears the container', async () => {
    const container = new NestContainer();
    const module = createModule();
    module.register(
      container,
      createGraphInspector(container),
      new ApplicationConfig(),
      {},
    );
    const clientsContainer = asAny(module).clientsContainer;
    const first = { close: vi.fn(async () => undefined) };
    const second = { close: vi.fn(async () => undefined) };
    clientsContainer.addClient(first);
    clientsContainer.addClient(second);

    await module.close();

    expect(first.close).toHaveBeenCalledTimes(1);
    expect(second.close).toHaveBeenCalledTimes(1);
    expect(clientsContainer.getAllClients()).toEqual([]);
  });

  it('resolves with no clients', async () => {
    const container = new NestContainer();
    const module = createModule();
    module.register(
      container,
      createGraphInspector(container),
      new ApplicationConfig(),
      {},
    );

    await expect(module.close()).resolves.toBeUndefined();
  });
});
