import { describe, expect, it } from 'vitest';
import { ExternalContextCreator } from '../../../../../packages/core/helpers/external-context-creator.js';
import { HttpAdapterHost } from '../../../../../packages/core/helpers/http-adapter-host.js';
import { InitializeOnPreviewAllowlist } from '../../../../../packages/core/inspector/initialize-on-preview.allowlist.js';
import { SerializedGraph } from '../../../../../packages/core/inspector/serialized-graph.js';
import { InternalCoreModule } from '../../../../../packages/core/injector/internal-core-module/internal-core-module.js';
import { InternalCoreModuleFactory } from '../../../../../packages/core/injector/internal-core-module/internal-core-module-factory.js';
import { LazyModuleLoader } from '../../../../../packages/core/injector/lazy-module-loader/lazy-module-loader.js';
import { ModulesContainer } from '../../../../../packages/core/injector/modules-container.js';

function setup() {
  const modules = new ModulesContainer();
  const serializedGraph = new SerializedGraph();
  const container = {
    contextOptions: { preview: true },
    getModules: () => modules,
    serializedGraph,
  } as any;
  const httpAdapterHost = new HttpAdapterHost();
  const dynamicModule = InternalCoreModuleFactory.create(
    container,
    {} as any,
    {} as any,
    httpAdapterHost,
    {} as any,
  );
  return { container, modules, serializedGraph, httpAdapterHost, dynamicModule };
}

describe('InternalCoreModuleFactory', () => {
  it('allowlists the internal core module for preview', () => {
    setup();

    expect(InitializeOnPreviewAllowlist.has(InternalCoreModule)).toBe(true);
  });

  it('registers the core providers', () => {
    const { dynamicModule } = setup();

    expect(dynamicModule.module).toBe(InternalCoreModule);
    expect(dynamicModule.providers).toHaveLength(5);
  });

  it('creates the external context creator', () => {
    const { dynamicModule, container } = setup();
    const provider = dynamicModule.providers!.find(
      (item: any) => item.provide === ExternalContextCreator,
    ) as any;

    expect(provider.useFactory()).toBeInstanceOf(ExternalContextCreator);
    expect(provider.useFactory().container).toBe(container);
  });

  it('returns the modules container', () => {
    const { dynamicModule, modules } = setup();
    const provider = dynamicModule.providers!.find(
      (item: any) => item.provide === ModulesContainer,
    ) as any;

    expect(provider.useFactory()).toBe(modules);
  });

  it('returns the http adapter host', () => {
    const { dynamicModule, httpAdapterHost } = setup();
    const provider = dynamicModule.providers!.find(
      (item: any) => item.provide === HttpAdapterHost,
    ) as any;

    expect(provider.useFactory()).toBe(httpAdapterHost);
  });

  it('returns the serialized graph', () => {
    const { dynamicModule, serializedGraph } = setup();
    const provider = dynamicModule.providers!.find(
      (item: any) => item.provide === SerializedGraph,
    ) as any;

    expect(provider.useFactory()).toBe(serializedGraph);
  });

  it('creates the lazy module loader', () => {
    const { dynamicModule } = setup();
    const provider = dynamicModule.providers!.find(
      (item: any) => item.provide === LazyModuleLoader,
    ) as any;

    expect(provider.useFactory()).toBeInstanceOf(LazyModuleLoader);
  });
});
