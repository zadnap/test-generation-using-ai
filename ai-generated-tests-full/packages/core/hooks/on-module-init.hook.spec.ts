import { describe, expect, it, vi } from 'vitest';
import { callModuleInitHook } from '../../../../packages/core/hooks/on-module-init.hook.js';

function createWrapper(options: {
  static?: boolean;
  level?: number;
  transient?: boolean;
  instance?: unknown;
  transientInstances?: Array<{ instance: unknown } | null>;
}) {
  return {
    isDependencyTreeStatic: () => options.static ?? true,
    hierarchyLevel: options.level ?? 0,
    isTransient: options.transient ?? false,
    getStaticTransientInstances: () => options.transientInstances ?? [],
    instance: options.instance,
  } as any;
}

function createModule(options: {
  moduleInstance?: unknown;
  moduleStatic?: boolean;
  controllers?: Array<[unknown, any]>;
  injectables?: Array<[unknown, any]>;
  middlewares?: Array<[unknown, any]>;
  providers?: Array<[unknown, any]>;
}) {
  return {
    getNonAliasProviders: () => [
      [
        'Module',
        createWrapper({
          instance: options.moduleInstance,
          static: options.moduleStatic,
        }),
      ],
      ...(options.providers ?? []),
    ],
    controllers: new Map(options.controllers ?? []),
    injectables: new Map(options.injectables ?? []),
    middlewares: new Map(options.middlewares ?? []),
  } as any;
}

describe('callModuleInitHook', () => {
  it('calls onModuleInit on providers, controllers and middlewares in level order', async () => {
    const calls: string[] = [];
    const provider = { onModuleInit: vi.fn(() => calls.push('provider')) };
    const controller = { onModuleInit: vi.fn(() => calls.push('controller')) };
    const middleware = { onModuleInit: vi.fn(() => calls.push('middleware')) };
    const moduleInstance = {
      onModuleInit: vi.fn(() => calls.push('module')),
    };
    const module = createModule({
      moduleInstance,
      controllers: [['controller', createWrapper({ level: 1, instance: controller })]],
      injectables: [['provider', createWrapper({ level: 0, instance: provider })]],
      middlewares: [['middleware', createWrapper({ level: 1, instance: middleware })]],
    });

    await callModuleInitHook(module);

    expect(provider.onModuleInit).toHaveBeenCalled();
    expect(controller.onModuleInit).toHaveBeenCalled();
    expect(middleware.onModuleInit).toHaveBeenCalled();
    expect(moduleInstance.onModuleInit).toHaveBeenCalled();
    expect(calls).toEqual(['provider', 'controller', 'middleware', 'module']);
  });

  it('xc1(T): skips nil instances and instances without the hook', async () => {
    const withHook = { onModuleInit: vi.fn() };
    const module = createModule({
      controllers: [
        ['nil', createWrapper({ instance: null })],
        ['plain', createWrapper({ instance: {} })],
        ['hook', createWrapper({ instance: withHook })],
      ],
    });

    await callModuleInitHook(module);

    expect(withHook.onModuleInit).toHaveBeenCalledTimes(1);
  });

  it('xc2(T): expands static transient instances', async () => {
    const transient = { onModuleInit: vi.fn() };
    const module = createModule({
      injectables: [
        [
          'transient',
          createWrapper({
            transient: true,
            transientInstances: [{ instance: transient }, null],
          }),
        ],
      ],
    });

    await callModuleInitHook(module);

    expect(transient.onModuleInit).toHaveBeenCalledTimes(1);
  });

  it('xc3(T): calls the module instance hook when the tree is static', async () => {
    const moduleInstance = { onModuleInit: vi.fn() };
    const module = createModule({ moduleInstance, moduleStatic: true });

    await callModuleInitHook(module);

    expect(moduleInstance.onModuleInit).toHaveBeenCalledTimes(1);
  });

  it('xc3(F): skips the module instance hook for a non-static tree', async () => {
    const moduleInstance = { onModuleInit: vi.fn() };
    const module = createModule({ moduleInstance, moduleStatic: false });

    await callModuleInitHook(module);

    expect(moduleInstance.onModuleInit).not.toHaveBeenCalled();
  });

  it('skips the module instance hook when there is no instance', async () => {
    const module = createModule({ moduleInstance: undefined });

    await expect(callModuleInitHook(module)).resolves.toBeUndefined();
  });
});
