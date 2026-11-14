import { describe, expect, it, vi } from 'vitest';
import { ModuleCompiler } from '../../../../packages/core/injector/compiler.js';

function createFactory() {
  return {
    createForStatic: vi.fn(() => 'static-token'),
    createForDynamic: vi.fn(() => 'dynamic-token'),
  };
}

describe('ModuleCompiler', () => {
  it('xc1(T): compiles a dynamic module', async () => {
    const factory = createFactory();
    const compiler = new ModuleCompiler(factory as any);
    class ModuleA {}

    const result = await compiler.compile({
      module: ModuleA,
      providers: [],
    });

    expect(result).toEqual({
      type: ModuleA,
      token: 'dynamic-token',
      dynamicMetadata: { providers: [] },
    });
    expect(factory.createForDynamic).toHaveBeenCalled();
  });

  it('xc1(F), xc2(T): compiles a static module', async () => {
    const factory = createFactory();
    const compiler = new ModuleCompiler(factory as any);
    class ModuleA {}

    const result = await compiler.compile(ModuleA);

    expect(result).toEqual({
      type: ModuleA,
      token: 'static-token',
      dynamicMetadata: undefined,
    });
    expect(factory.createForStatic).toHaveBeenCalledWith(ModuleA, ModuleA);
  });

  it('xc2(F): awaits promises before compiling', async () => {
    const factory = createFactory();
    const compiler = new ModuleCompiler(factory as any);
    class ModuleA {}

    const result = await compiler.compile(Promise.resolve(ModuleA));

    expect(result.type).toBe(ModuleA);
  });

  it('exposes the opaque key factory', () => {
    const factory = createFactory();

    expect(new ModuleCompiler(factory as any).moduleOpaqueKeyFactory).toBe(
      factory,
    );
  });

  it('xc3(T): extracts a forward reference', () => {
    const compiler = new ModuleCompiler(createFactory() as any);
    class ModuleA {}

    expect(
      compiler.extractMetadata({ forwardRef: () => ModuleA }),
    ).toEqual({ type: ModuleA, dynamicMetadata: undefined });
  });

  it('xc3(F), xc4(T): extracts a dynamic module', () => {
    const compiler = new ModuleCompiler(createFactory() as any);
    class ModuleA {}

    expect(
      compiler.extractMetadata({ module: ModuleA, imports: [] }),
    ).toEqual({ type: ModuleA, dynamicMetadata: { imports: [] } });
  });

  it('xc4(F): extracts a plain class', () => {
    const compiler = new ModuleCompiler(createFactory() as any);
    class ModuleA {}

    expect(compiler.extractMetadata(ModuleA)).toEqual({
      type: ModuleA,
      dynamicMetadata: undefined,
    });
  });

  it('xc5(T): detects dynamic modules', () => {
    const compiler = new ModuleCompiler(createFactory() as any);

    expect(compiler.isDynamicModule({ module: class {} } as any)).toBe(true);
  });

  it('xc5(F): rejects non-dynamic modules', () => {
    const compiler = new ModuleCompiler(createFactory() as any);

    expect(compiler.isDynamicModule(class {} as any)).toBe(false);
  });
});
