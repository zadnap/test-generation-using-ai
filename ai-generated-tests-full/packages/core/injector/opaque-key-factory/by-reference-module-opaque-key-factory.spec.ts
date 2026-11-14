import { describe, expect, it } from 'vitest';
import { ByReferenceModuleOpaqueKeyFactory } from '../../../../../packages/core/injector/opaque-key-factory/by-reference-module-opaque-key-factory.js';

describe('ByReferenceModuleOpaqueKeyFactory', () => {
  it('xc1(T): generates a random key by default', () => {
    class ModuleA {}
    const factory = new ByReferenceModuleOpaqueKeyFactory();

    const token = factory.createForStatic(ModuleA);

    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(0);
  });

  it('xc1(F): reuses the key stored on the module reference', () => {
    class ModuleA {}
    const factory = new ByReferenceModuleOpaqueKeyFactory();

    expect(factory.createForStatic(ModuleA)).toBe(
      factory.createForStatic(ModuleA),
    );
  });

  it('xc2(T): generates a key for dynamic modules', () => {
    class ModuleA {}
    const factory = new ByReferenceModuleOpaqueKeyFactory();
    const dynamic = { module: ModuleA, providers: [] };

    const token = factory.createForDynamic(ModuleA, { providers: [] }, dynamic);

    expect(factory.createForDynamic(ModuleA, { providers: [] }, dynamic)).toBe(
      token,
    );
  });

  it('xc2(F): keeps static and dynamic keys distinct', () => {
    class ModuleA {}
    const factory = new ByReferenceModuleOpaqueKeyFactory();

    const staticToken = factory.createForStatic(ModuleA);
    const dynamicToken = factory.createForDynamic(
      ModuleA,
      { providers: [] },
      { module: ModuleA, providers: [] },
    );

    expect(staticToken).not.toBe(dynamicToken);
  });

  it('xc3(T): hashes the class source for shallow static keys', () => {
    class ModuleA {}
    const factory = new ByReferenceModuleOpaqueKeyFactory({
      keyGenerationStrategy: 'shallow',
    });

    const token = factory.createForStatic(ModuleA);

    expect(token).toContain(':');
    expect(token.split(':')[1]).toHaveLength(64);
  });

  it('xc3(F), xc4(T): hashes the name and metadata for shallow dynamic keys', () => {
    class ModuleA {}
    const factory = new ByReferenceModuleOpaqueKeyFactory({
      keyGenerationStrategy: 'shallow',
    });

    const first = factory.createForDynamic(
      ModuleA,
      { providers: ['a'] },
      { module: ModuleA, providers: ['a'] },
    );
    const second = factory.createForDynamic(
      ModuleA,
      { providers: ['b'] },
      { module: ModuleA, providers: ['b'] },
    );

    expect(first.split(':')[1]).not.toBe(second.split(':')[1]);
  });

  it('xc4(F): uses the module class as the default original reference', () => {
    class ModuleA {}
    const factory = new ByReferenceModuleOpaqueKeyFactory({
      keyGenerationStrategy: 'shallow',
    });

    expect(factory.createForStatic(ModuleA)).toContain(':');
  });

  it('xc5(T): only checks own properties for the cached id', () => {
    class Parent {}
    class Child extends Parent {}
    const factory = new ByReferenceModuleOpaqueKeyFactory();

    const parentToken = factory.createForStatic(Parent);
    const childToken = factory.createForStatic(Child);

    expect(parentToken).not.toBe(childToken);
  });
});
