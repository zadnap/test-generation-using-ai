import { describe, expect, it, vi } from 'vitest';
import { LazyModuleLoader } from '../../../../../packages/core/injector/lazy-module-loader/lazy-module-loader.js';
import { SilentLogger } from '../../../../../packages/core/injector/helpers/silent-logger.js';

function createModule(id: string, ref: unknown = { id: 'ref' }) {
  return {
    id,
    token: id,
    getProviderByKey: vi.fn(() => ({ instance: ref })),
  } as any;
}

function setup(options: {
  scanResult?: any[];
  scanError?: Error;
  modulesInFlight?: Map<any, Promise<void>>;
  containerGet?: any;
  buildError?: Error;
  loadOpts?: any;
} = {}) {
  const modulesInFlight = options.modulesInFlight ?? new WeakMap();
  const scanForModules = options.scanError
    ? vi.fn(async () => {
        throw options.scanError;
      })
    : vi.fn(async () => options.scanResult ?? []);
  const dependenciesScanner = {
    scanForModules,
    removeModules: vi.fn(),
    scanModulesForDependencies: options.buildError
      ? vi.fn(async () => {
          throw options.buildError;
        })
      : vi.fn(async () => undefined),
  };
  const instanceLoader = {
    createInstancesOfDependencies: vi.fn(async () => undefined),
    setLogger: vi.fn(),
    logger: { log: vi.fn() },
  };
  const moduleCompiler = {
    compile: vi.fn(async () => ({ token: 'token' })),
  };
  const modulesContainer = {
    get: vi.fn(() => options.containerGet),
  };
  const loader = new LazyModuleLoader(
    dependenciesScanner as any,
    instanceLoader as any,
    moduleCompiler as any,
    modulesContainer as any,
  );
  (loader as any).modulesInFlight = modulesInFlight;
  return {
    loader,
    dependenciesScanner,
    instanceLoader,
    moduleCompiler,
    modulesContainer,
    modulesInFlight,
  };
}

describe('LazyModuleLoader', () => {
  it('loads and builds new modules', async () => {
    const moduleRef = createModule('module');
    const { loader, dependenciesScanner, instanceLoader } = setup({
      scanResult: [moduleRef],
    });

    const result = await loader.load(() => class ModuleA {});

    expect(dependenciesScanner.scanForModules).toHaveBeenCalledWith(
      expect.objectContaining({ lazy: true }),
    );
    expect(dependenciesScanner.scanModulesForDependencies).toHaveBeenCalled();
    expect(
      instanceLoader.createInstancesOfDependencies,
    ).toHaveBeenCalled();
    expect(result).toBe(moduleRef.getProviderByKey().instance);
  });

  it('xc1(T): removes inserted modules when scanning fails', async () => {
    const error = new Error('scan');
    const { loader, dependenciesScanner } = setup({ scanError: error });

    await expect(loader.load(() => class ModuleA {})).rejects.toThrow(error);
    expect(dependenciesScanner.removeModules).toHaveBeenCalled();
  });

  it('xc1(F), xc2(T): returns an existing module reference', async () => {
    const moduleRef = createModule('existing');
    const { loader, moduleCompiler, modulesContainer } = setup({
      scanResult: [],
      containerGet: moduleRef,
    });

    const result = await loader.load(() => class ModuleA {});

    expect(moduleCompiler.compile).toHaveBeenCalled();
    expect(modulesContainer.get).toHaveBeenCalledWith('token');
    expect(result).toBe(moduleRef.getProviderByKey().instance);
  });

  it('xc2(F): returns undefined when the existing module is missing', async () => {
    const { loader } = setup({ scanResult: [], containerGet: undefined });

    await expect(loader.load(() => class ModuleA {})).resolves.toBeUndefined();
  });

  it('xc3(T): waits for loads already in flight', async () => {
    const moduleRef = createModule('module');
    const inFlight = Promise.resolve();
    const modulesInFlight = new WeakMap([[moduleRef, inFlight]]);
    const { loader, dependenciesScanner } = setup({
      scanResult: [moduleRef],
      modulesInFlight,
    });

    await loader.load(() => class ModuleA {});

    expect(dependenciesScanner.scanModulesForDependencies).not.toHaveBeenCalled();
  });

  it('xc3(F): waits for other modules that are still loading', async () => {
    const loadingModule = createModule('loading');
    const newModule = createModule('new');
    let resolveLoading!: () => void;
    const loading = new Promise<void>(resolve => {
      resolveLoading = resolve;
    });
    const modulesInFlight = new WeakMap([[loadingModule, loading]]);
    const { loader, instanceLoader } = setup({
      scanResult: [loadingModule, newModule],
      modulesInFlight,
    });

    const load = loader.load(() => class ModuleA {});
    resolveLoading();
    await load;

    expect(instanceLoader.createInstancesOfDependencies).toHaveBeenCalled();
  });

  it('xc4(T): removes modules when building fails', async () => {
    const moduleRef = createModule('module');
    const error = new Error('build');
    const { loader, dependenciesScanner } = setup({
      scanResult: [moduleRef],
      buildError: error,
    });

    await expect(loader.load(() => class ModuleA {})).rejects.toThrow(error);
    expect(dependenciesScanner.removeModules).toHaveBeenCalledWith([
      moduleRef,
    ]);
  });

  it('xc4(F): clears in-flight entries after building', async () => {
    const moduleRef = createModule('module');
    const { loader, modulesInFlight } = setup({ scanResult: [moduleRef] });

    await loader.load(() => class ModuleA {});

    expect(modulesInFlight.has(moduleRef)).toBe(false);
  });

  it('xc5(T): silences the logger when requested', async () => {
    const moduleRef = createModule('module');
    const { loader, instanceLoader } = setup({ scanResult: [moduleRef] });

    await loader.load(() => class ModuleA {}, { logger: false });

    expect(instanceLoader.setLogger).toHaveBeenNthCalledWith(
      1,
      expect.any(SilentLogger),
    );
    expect(instanceLoader.setLogger).toHaveBeenNthCalledWith(
      2,
      instanceLoader.logger,
    );
  });

  it('xc5(F): keeps the logger when not requested', async () => {
    const moduleRef = createModule('module');
    const { loader, instanceLoader } = setup({ scanResult: [moduleRef] });

    await loader.load(() => class ModuleA {}, { logger: true });

    expect(instanceLoader.setLogger).not.toHaveBeenCalled();
  });

  it('xc6(T): deduplicates modules for the lazy container', () => {
    const moduleRef = createModule('module');
    const { loader } = setup();

    const container = (loader as any).createLazyModulesContainer([
      moduleRef,
      moduleRef,
    ]);

    expect(container.size).toBe(1);
    expect(container.get('module')).toBe(moduleRef);
  });
});
