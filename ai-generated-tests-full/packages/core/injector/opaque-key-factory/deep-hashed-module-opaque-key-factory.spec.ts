import { afterEach, describe, expect, it, vi } from 'vitest';
import { DeepHashedModuleOpaqueKeyFactory } from '../../../../../packages/core/injector/opaque-key-factory/deep-hashed-module-opaque-key-factory.js';

describe('DeepHashedModuleOpaqueKeyFactory', () => {
  afterEach(() => vi.restoreAllMocks());

  it('xc1(T): caches the static token per class', () => {
    class ModuleA {}
    const factory = new DeepHashedModuleOpaqueKeyFactory();

    const first = factory.createForStatic(ModuleA);
    const second = factory.createForStatic(ModuleA);

    expect(first).toBe(second);
    expect(first).toHaveLength(64);
  });

  it('xc1(F): returns different tokens for different classes', () => {
    class ModuleA {}
    class ModuleB {}
    const factory = new DeepHashedModuleOpaqueKeyFactory();

    expect(factory.createForStatic(ModuleA)).not.toBe(
      factory.createForStatic(ModuleB),
    );
  });

  it('xc2(T): hashes dynamic metadata deterministically', () => {
    class ModuleA {}
    const factory = new DeepHashedModuleOpaqueKeyFactory();

    const first = factory.createForDynamic(ModuleA, { providers: ['a'] });
    const second = factory.createForDynamic(ModuleA, { providers: ['a'] });
    const different = factory.createForDynamic(ModuleA, { providers: ['b'] });

    expect(first).toBe(second);
    expect(first).not.toBe(different);
  });

  it('xc2(F): warns when serialization is slow', () => {
    class ModuleA {}
    const factory = new DeepHashedModuleOpaqueKeyFactory();
    const warn = vi.spyOn((factory as any).logger, 'warn');
    vi.spyOn(performance, 'now')
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(20);

    factory.createForDynamic(ModuleA, { providers: [] });

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('20.00ms'));
  });

  it('xc3(T): returns an empty string for a missing token', () => {
    const factory = new DeepHashedModuleOpaqueKeyFactory();

    expect(factory.getStringifiedOpaqueToken(undefined)).toBe('');
  });

  it('xc3(F): serializes classes, functions, symbols and collections', () => {
    const factory = new DeepHashedModuleOpaqueKeyFactory();
    class Foo {}
    function namedFunction() {}

    const result = factory.getStringifiedOpaqueToken({
      cls: Foo,
      fn: namedFunction,
      sym: Symbol('token'),
      map: new Map([['a', 1]]),
      set: new Set([1]),
      regexp: /x/g,
    });

    expect(result).toContain('"Foo"');
    expect(result).toContain('namedFunction');
    expect(result).toContain('Symbol(token)');
    expect(result).toContain('"Map":[["a",1]]');
    expect(result).toContain('"Set":[1]');
    expect(result).toContain('"/x/g"');
  });

  it('xc4(T): reuses the cached module id', () => {
    class ModuleA {}
    const factory = new DeepHashedModuleOpaqueKeyFactory();

    expect(factory.getModuleId(ModuleA)).toBe(factory.getModuleId(ModuleA));
  });

  it('xc4(F): creates a module id on first use', () => {
    class ModuleA {}
    const factory = new DeepHashedModuleOpaqueKeyFactory();

    expect(factory.getModuleId(ModuleA)).toHaveLength(21);
  });

  it('returns the metatype name', () => {
    class ModuleA {}
    const factory = new DeepHashedModuleOpaqueKeyFactory();

    expect(factory.getModuleName(ModuleA)).toBe('ModuleA');
  });

  it('handles circular objects', () => {
    const factory = new DeepHashedModuleOpaqueKeyFactory();
    const circular: any = {};
    circular.self = circular;

    expect(factory.getStringifiedOpaqueToken({ circular })).toContain(
      '[Circular]',
    );
  });
});
