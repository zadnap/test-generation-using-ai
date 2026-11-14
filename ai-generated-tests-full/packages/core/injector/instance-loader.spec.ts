import { describe, expect, it, vi } from 'vitest';
import { DiscoverableMetaHostCollection } from '../../../../packages/core/discovery/discoverable-meta-host-collection.js';
import { InstanceLoader } from '../../../../packages/core/injector/instance-loader.js';

function createWrapper(overrides: any = {}) {
  return { isAlias: false, ...overrides } as any;
}

function createModule(name: string, wrappers: any = {}) {
  return {
    name,
    providers: new Map(wrappers.providers ?? []),
    injectables: new Map(wrappers.injectables ?? []),
    controllers: new Map(wrappers.controllers ?? []),
  } as any;
}

function setup(modules: Map<string, any>) {
  const container = { getModules: () => modules } as any;
  const injector = {
    loadPrototype: vi.fn(),
    loadProvider: vi.fn(async () => undefined),
    loadInjectable: vi.fn(async () => undefined),
    loadController: vi.fn(async () => undefined),
  };
  const graphInspector = {
    inspectInstanceWrapper: vi.fn(),
    inspectModules: vi.fn(),
    registerPartial: vi.fn(),
  };
  const logger = { log: vi.fn() };
  const loader = new InstanceLoader(
    container,
    injector as any,
    graphInspector as any,
    logger as any,
  );
  return { loader, injector, graphInspector, logger, container };
}

describe('InstanceLoader', () => {
  it('loads prototypes and instances for every wrapper', async () => {
    const provider = createWrapper();
    const injectable = createWrapper();
    const controller = createWrapper();
    const modules = new Map([
      [
        'm',
        createModule('ModuleA', {
          providers: [['p', provider]],
          injectables: [['i', injectable]],
          controllers: [['c', controller]],
        }),
      ],
    ]);
    const { loader, injector, graphInspector, logger } = setup(modules);

    await loader.createInstancesOfDependencies();

    expect(injector.loadPrototype).toHaveBeenCalledTimes(3);
    expect(injector.loadProvider).toHaveBeenCalledWith(provider, modules.get('m'));
    expect(injector.loadInjectable).toHaveBeenCalledWith(injectable, modules.get('m'));
    expect(injector.loadController).toHaveBeenCalledWith(controller, modules.get('m'));
    expect(graphInspector.inspectInstanceWrapper).toHaveBeenCalledTimes(3);
    expect(graphInspector.inspectModules).toHaveBeenCalledWith(modules);
    expect(logger.log).toHaveBeenCalledWith(
      expect.stringContaining('ModuleA'),
    );
  });

  it('uses the container modules by default', async () => {
    const modules = new Map([['m', createModule('ModuleA')]]);
    const { loader, graphInspector } = setup(modules);

    await loader.createInstancesOfDependencies();

    expect(graphInspector.inspectModules).toHaveBeenCalledWith(modules);
  });

  it('xc1(T): inspects non-alias providers', async () => {
    const provider = createWrapper({ isAlias: false });
    const modules = new Map([
      ['m', createModule('ModuleA', { providers: [['p', provider]] })],
    ]);
    const { loader } = setup(modules);
    const spy = vi.spyOn(DiscoverableMetaHostCollection, 'inspectProvider');

    await loader.createInstancesOfDependencies();

    expect(spy).toHaveBeenCalledWith(expect.anything(), provider);
  });

  it('xc1(F): skips alias providers', async () => {
    const provider = createWrapper({ isAlias: true });
    const modules = new Map([
      ['m', createModule('ModuleA', { providers: [['p', provider]] })],
    ]);
    const { loader } = setup(modules);
    const spy = vi.spyOn(DiscoverableMetaHostCollection, 'inspectProvider');

    await loader.createInstancesOfDependencies();

    expect(spy).not.toHaveBeenCalled();
  });

  it('xc2(T): logs whitelisted modules', async () => {
    const modules = new Map([['m', createModule('ModuleA')]]);
    const { loader, logger } = setup(modules);

    await loader.createInstancesOfDependencies();

    expect(logger.log).toHaveBeenCalled();
  });

  it('xc2(F): skips the internal core module', async () => {
    const modules = new Map([['m', createModule('InternalCoreModule')]]);
    const { loader, logger } = setup(modules);

    await loader.createInstancesOfDependencies();

    expect(logger.log).not.toHaveBeenCalled();
  });

  it('xc3(T): reports failures to the graph inspector', async () => {
    const error = new Error('load');
    const modules = new Map([
      ['m', createModule('ModuleA', { providers: [['p', createWrapper()]] })],
    ]);
    const { loader, injector, graphInspector } = setup(modules);
    injector.loadProvider.mockRejectedValueOnce(error);

    await expect(loader.createInstancesOfDependencies()).rejects.toThrow(
      error,
    );
    expect(graphInspector.inspectModules).toHaveBeenCalledWith(modules);
    expect(graphInspector.registerPartial).toHaveBeenCalledWith(error);
  });

  it('xc3(F): inspects modules after a successful load', async () => {
    const modules = new Map([['m', createModule('ModuleA')]]);
    const { loader, graphInspector } = setup(modules);

    await loader.createInstancesOfDependencies();

    expect(graphInspector.inspectModules).toHaveBeenCalledTimes(1);
    expect(graphInspector.registerPartial).not.toHaveBeenCalled();
  });

  it('replaces the logger', () => {
    const { loader } = setup(new Map());
    const logger = { log: vi.fn() } as any;

    loader.setLogger(logger);

    expect((loader as any).logger).toBe(logger);
  });
});
