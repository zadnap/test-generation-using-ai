import { describe, expect, it } from 'vitest';
import { DiscoveryService } from '../../../../packages/core/discovery/discovery-service.js';
import { DiscoverableMetaHostCollection } from '../../../../packages/core/discovery/discoverable-meta-host-collection.js';
import { InstanceWrapper } from '../../../../packages/core/injector/instance-wrapper.js';
import { Module } from '../../../../packages/core/injector/module.js';
import { ModulesContainer } from '../../../../packages/core/injector/modules-container.js';

function createModule(
  metatype: Function,
  providers: InstanceWrapper[] = [],
  controllers: InstanceWrapper[] = [],
) {
  const moduleRef = {
    metatype,
    providers: new Map(providers.map(p => [p.token, p])),
    controllers: new Map(controllers.map(c => [c.token, c])),
  } as unknown as Module;
  return moduleRef;
}

describe('DiscoveryService', () => {
  it('creates a decorator with a KEY and registers class metadata', () => {
    const Decorator = DiscoveryService.createDecorator<{ role: string }>();
    class Target {}

    expect(typeof Decorator.KEY).toBe('string');
    expect(Decorator.KEY).toHaveLength(21);

    Decorator({ role: 'admin' })(Target);

    expect(
      DiscoverableMetaHostCollection.metaHostLinks.get(Target)?.has(Decorator.KEY),
    ).toBe(true);
    expect(Reflect.getMetadata(Decorator.KEY, Target)).toEqual({
      role: 'admin',
    });
  });

  it('xc1(T): defaults the metadata to an empty object', () => {
    const Decorator = DiscoveryService.createDecorator();
    class Target {}

    Decorator(undefined)(Target);

    expect(Reflect.getMetadata(Decorator.KEY, Target)).toEqual({});
  });

  it('xc1(F): does not register a class link for method decorators', () => {
    const Decorator = DiscoveryService.createDecorator();
    class Target {
      method() {}
    }

    Decorator({ role: 'admin' })(
      Target.prototype,
      'method',
      Object.getOwnPropertyDescriptor(Target.prototype, 'method'),
    );

    expect(
      DiscoverableMetaHostCollection.metaHostLinks.has(Target.prototype),
    ).toBe(false);
    expect(
      Reflect.getMetadata(Decorator.KEY, Target.prototype.method),
    ).toEqual({ role: 'admin' });
  });

  it('xc2(T): returns providers filtered by metadata key', () => {
    const container = new ModulesContainer();
    const wrapper = new InstanceWrapper({
      token: 'provider',
      name: 'provider',
      metatype: class Provider {},
    });
    DiscoverableMetaHostCollection.inspectProvider(container, wrapper);
    const service = new DiscoveryService(container);

    expect(
      service.getProviders({ metadataKey: 'missing' }),
    ).toEqual([]);
  });

  it('xc2(F): returns all providers of the given modules', () => {
    const first = new InstanceWrapper({ token: 'a', name: 'a' });
    const second = new InstanceWrapper({ token: 'b', name: 'b' });
    const module = createModule(class ModuleA {}, [first, second]);
    const container = new ModulesContainer([['m', module]] as any);
    const service = new DiscoveryService(container);

    expect(service.getProviders()).toEqual([first, second]);
  });

  it('xc3(T): returns controllers filtered by metadata key', () => {
    const container = new ModulesContainer();
    const service = new DiscoveryService(container);

    expect(
      service.getControllers({ metadataKey: 'missing' }),
    ).toEqual([]);
  });

  it('xc3(F): returns all controllers of the given modules', () => {
    const controller = new InstanceWrapper({ token: 'c', name: 'c' });
    const module = createModule(class ModuleA {}, [], [controller]);
    const container = new ModulesContainer([['m', module]] as any);
    const service = new DiscoveryService(container);

    expect(service.getControllers()).toEqual([controller]);
  });

  it('xc4(T): reads method metadata by key', () => {
    const Decorator = DiscoveryService.createDecorator<string>();
    class Target {
      handler() {}
    }
    Decorator('method-meta')(
      Target.prototype,
      'handler',
      Object.getOwnPropertyDescriptor(Target.prototype, 'handler')!,
    );
    const wrapper = new InstanceWrapper({
      token: Target,
      name: 'target',
      metatype: Target,
      instance: new Target(),
    });
    const service = new DiscoveryService(new ModulesContainer());

    expect(
      service.getMetadataByDecorator(Decorator, wrapper, 'handler'),
    ).toBe('method-meta');
  });

  it('xc4(F), xc5(T): reads class metadata from the instance constructor', () => {
    const Decorator = DiscoveryService.createDecorator<string>();
    class Target {}
    Decorator('class-meta')(Target);
    const wrapper = new InstanceWrapper({
      token: Target,
      name: 'target',
      metatype: Target,
      instance: new Target(),
    });
    const service = new DiscoveryService(new ModulesContainer());

    expect(service.getMetadataByDecorator(Decorator, wrapper)).toBe(
      'class-meta',
    );
  });

  it('xc5(F): falls back to the wrapper metatype', () => {
    const Decorator = DiscoveryService.createDecorator<string>();
    class Target {}
    Decorator('class-meta')(Target);
    const wrapper = new InstanceWrapper({
      token: Target,
      name: 'target',
      metatype: Target,
    });
    const service = new DiscoveryService(new ModulesContainer());

    expect(service.getMetadataByDecorator(Decorator, wrapper)).toBe(
      'class-meta',
    );
  });

  it('xc6(T): returns every module when include is absent', () => {
    const moduleA = createModule(class ModuleA {});
    const moduleB = createModule(class ModuleB {});
    const container = new ModulesContainer([
      ['a', moduleA],
      ['b', moduleB],
    ] as any);
    const service = new DiscoveryService(container);

    expect((service as any).getModules()).toEqual([moduleA, moduleB]);
  });

  it('xc6(F): filters modules by include whitelist', () => {
    class ModuleA {}
    class ModuleB {}
    const moduleA = createModule(ModuleA);
    const moduleB = createModule(ModuleB);
    const container = new ModulesContainer([
      ['a', moduleA],
      ['b', moduleB],
    ] as any);
    const service = new DiscoveryService(container);

    expect((service as any).getModules({ include: [ModuleB] })).toEqual([
      moduleB,
    ]);
  });
});
