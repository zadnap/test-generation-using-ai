import { beforeEach, describe, expect, it } from 'vitest';
import { DiscoverableMetaHostCollection } from '../../../../packages/core/discovery/discoverable-meta-host-collection.js';
import { InstanceWrapper } from '../../../../packages/core/injector/instance-wrapper.js';
import { ModulesContainer } from '../../../../packages/core/injector/modules-container.js';

function wrapper(options: {
  id?: string;
  metatype?: any;
  instance?: unknown;
  inject?: unknown[];
}) {
  return {
    id: options.id,
    metatype: options.metatype,
    instance: options.instance,
    inject: options.inject,
  } as InstanceWrapper;
}

describe('DiscoverableMetaHostCollection', () => {
  beforeEach(() => {
    DiscoverableMetaHostCollection.metaHostLinks.clear();
  });

  it('xc1(T): creates a new link set for an unknown target', () => {
    class Target {}

    DiscoverableMetaHostCollection.addClassMetaHostLink(Target, 'key');

    expect(DiscoverableMetaHostCollection.metaHostLinks.get(Target)).toEqual(
      new Set(['key']),
    );
  });

  it('xc1(F): appends to an existing link set', () => {
    class Target {}
    DiscoverableMetaHostCollection.addClassMetaHostLink(Target, 'first');

    DiscoverableMetaHostCollection.addClassMetaHostLink(Target, 'second');

    expect(DiscoverableMetaHostCollection.metaHostLinks.get(Target)).toEqual(
      new Set(['first', 'second']),
    );
  });

  it('xc2(T): inspects a provider with linked metadata', () => {
    class Provider {}
    DiscoverableMetaHostCollection.addClassMetaHostLink(Provider, 'key');
    const container = new ModulesContainer();
    const instanceWrapper = wrapper({ id: 'p1', metatype: Provider });

    DiscoverableMetaHostCollection.inspectProvider(container, instanceWrapper);

    expect(
      DiscoverableMetaHostCollection.getProvidersByMetaKey(container, 'key'),
    ).toEqual(new Set([instanceWrapper]));
  });

  it('xc2(F): ignores a provider without linked metadata', () => {
    class Provider {}
    const container = new ModulesContainer();

    DiscoverableMetaHostCollection.inspectProvider(
      container,
      wrapper({ id: 'p1', metatype: Provider }),
    );

    expect(
      DiscoverableMetaHostCollection.getProvidersByMetaKey(container, 'key'),
    ).toEqual(new Set());
  });

  it('xc3(T): inspects a controller with linked metadata', () => {
    class Controller {}
    DiscoverableMetaHostCollection.addClassMetaHostLink(Controller, 'key');
    const container = new ModulesContainer();
    const instanceWrapper = wrapper({ id: 'c1', metatype: Controller });

    DiscoverableMetaHostCollection.inspectController(container, instanceWrapper);

    expect(
      DiscoverableMetaHostCollection.getControllersByMetaKey(container, 'key'),
    ).toEqual(new Set([instanceWrapper]));
  });

  it('xc3(F): ignores a controller without linked metadata', () => {
    class Controller {}
    const container = new ModulesContainer();

    DiscoverableMetaHostCollection.inspectController(
      container,
      wrapper({ id: 'c1', metatype: Controller }),
    );

    expect(
      DiscoverableMetaHostCollection.getControllersByMetaKey(container, 'key'),
    ).toEqual(new Set());
  });

  it('xc4(T): replaces an existing wrapper with the same id', () => {
    const collection = new Map<string, Set<InstanceWrapper>>();
    const first = wrapper({ id: 'same' });
    const second = wrapper({ id: 'same' });
    const other = wrapper({ id: 'other' });

    DiscoverableMetaHostCollection.insertByMetaKey('key', first, collection);
    DiscoverableMetaHostCollection.insertByMetaKey('key', other, collection);
    DiscoverableMetaHostCollection.insertByMetaKey('key', second, collection);

    expect(collection.get('key')).toEqual(new Set([other, second]));
  });

  it('xc4(F): creates the set when the key is unknown', () => {
    const collection = new Map<string, Set<InstanceWrapper>>();
    const instanceWrapper = wrapper({ id: 'p1' });

    DiscoverableMetaHostCollection.insertByMetaKey(
      'key',
      instanceWrapper,
      collection,
    );

    expect(collection.get('key')).toEqual(new Set([instanceWrapper]));
  });

  it('removes wrappers by id from providers and controllers', () => {
    class Provider {}
    class Controller {}
    DiscoverableMetaHostCollection.addClassMetaHostLink(Provider, 'key');
    DiscoverableMetaHostCollection.addClassMetaHostLink(Controller, 'key');
    const container = new ModulesContainer();
    const provider = wrapper({ id: 'p1', metatype: Provider });
    const controller = wrapper({ id: 'c1', metatype: Controller });
    DiscoverableMetaHostCollection.inspectProvider(container, provider);
    DiscoverableMetaHostCollection.inspectController(container, controller);

    DiscoverableMetaHostCollection.removeInstanceWrappers(container, [
      provider,
      controller,
      null as any,
    ]);

    expect(
      DiscoverableMetaHostCollection.getProvidersByMetaKey(container, 'key'),
    ).toEqual(new Set());
    expect(
      DiscoverableMetaHostCollection.getControllersByMetaKey(container, 'key'),
    ).toEqual(new Set());
  });

  it('returns empty sets for unknown containers', () => {
    const container = new ModulesContainer();

    expect(
      DiscoverableMetaHostCollection.getProvidersByMetaKey(container, 'key'),
    ).toEqual(new Set());
    expect(
      DiscoverableMetaHostCollection.getControllersByMetaKey(container, 'key'),
    ).toEqual(new Set());
  });

  it('xc5(T): resolves the metatype when it is present without inject', () => {
    class Provider {}
    DiscoverableMetaHostCollection.addClassMetaHostLink(Provider, 'key');
    const container = new ModulesContainer();
    const instanceWrapper = wrapper({
      id: 'p1',
      metatype: Provider,
      instance: { constructor: class Other {} },
    });

    DiscoverableMetaHostCollection.inspectProvider(container, instanceWrapper);

    expect(
      DiscoverableMetaHostCollection.getProvidersByMetaKey(container, 'key'),
    ).toEqual(new Set([instanceWrapper]));
  });

  it('xc5(F), xc6(T): uses the instance constructor when metatype is missing', () => {
    class Value {}
    DiscoverableMetaHostCollection.addClassMetaHostLink(Value, 'key');
    const container = new ModulesContainer();
    const instanceWrapper = wrapper({
      id: 'p1',
      metatype: undefined,
      instance: new Value(),
    });

    DiscoverableMetaHostCollection.inspectProvider(container, instanceWrapper);

    expect(
      DiscoverableMetaHostCollection.getProvidersByMetaKey(container, 'key'),
    ).toEqual(new Set([instanceWrapper]));
  });

  it('xc6(F): uses the instance constructor when inject is present', () => {
    class Factory {}
    DiscoverableMetaHostCollection.addClassMetaHostLink(Factory, 'key');
    const container = new ModulesContainer();
    const instanceWrapper = wrapper({
      id: 'p1',
      metatype: () => undefined,
      inject: [],
      instance: new Factory(),
    });

    DiscoverableMetaHostCollection.inspectProvider(container, instanceWrapper);

    expect(
      DiscoverableMetaHostCollection.getProvidersByMetaKey(container, 'key'),
    ).toEqual(new Set([instanceWrapper]));
  });

  it('xc7(T): falls back to the metatype when there is no instance', () => {
    class Value {}
    DiscoverableMetaHostCollection.addClassMetaHostLink(Value, 'key');
    const container = new ModulesContainer();
    const instanceWrapper = wrapper({
      id: 'p1',
      metatype: Value,
      instance: undefined,
      inject: [],
    });

    DiscoverableMetaHostCollection.inspectProvider(container, instanceWrapper);

    expect(
      DiscoverableMetaHostCollection.getProvidersByMetaKey(container, 'key'),
    ).toEqual(new Set([instanceWrapper]));
  });
});
