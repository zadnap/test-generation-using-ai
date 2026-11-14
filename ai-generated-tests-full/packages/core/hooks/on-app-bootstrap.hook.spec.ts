import { Logger } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { callModuleBootstrapHook } from '../../../../packages/core/hooks/on-app-bootstrap.hook.js';

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

describe('callModuleBootstrapHook', () => {
  afterEach(() => vi.restoreAllMocks());

  it('calls onApplicationBootstrap on all instances', async () => {
    const provider = { onApplicationBootstrap: vi.fn() };
    const controller = { onApplicationBootstrap: vi.fn() };
    const moduleInstance = { onApplicationBootstrap: vi.fn() };
    const module = createModule({
      moduleInstance,
      controllers: [['c', createWrapper({ level: 1, instance: controller })]],
      injectables: [['p', createWrapper({ level: 0, instance: provider })]],
    });

    await callModuleBootstrapHook(module);

    expect(provider.onApplicationBootstrap).toHaveBeenCalledTimes(1);
    expect(controller.onApplicationBootstrap).toHaveBeenCalledTimes(1);
    expect(moduleInstance.onApplicationBootstrap).toHaveBeenCalledTimes(1);
  });

  it('xc1(T): filters nil instances and instances without the hook', async () => {
    const hook = { onApplicationBootstrap: vi.fn() };
    const module = createModule({
      injectables: [
        ['nil', createWrapper({ instance: null })],
        ['plain', createWrapper({ instance: {} })],
        ['hook', createWrapper({ instance: hook })],
      ],
    });

    await callModuleBootstrapHook(module);

    expect(hook.onApplicationBootstrap).toHaveBeenCalledTimes(1);
  });

  it('xc2(T): expands static transient instances', async () => {
    const transient = { onApplicationBootstrap: vi.fn() };
    const module = createModule({
      injectables: [
        [
          't',
          createWrapper({
            transient: true,
            transientInstances: [{ instance: transient }],
          }),
        ],
      ],
    });

    await callModuleBootstrapHook(module);

    expect(transient.onApplicationBootstrap).toHaveBeenCalledTimes(1);
  });

  it('xc3(T): calls the module instance hook when the tree is static', async () => {
    const moduleInstance = { onApplicationBootstrap: vi.fn() };
    const module = createModule({ moduleInstance, moduleStatic: true });

    await callModuleBootstrapHook(module);

    expect(moduleInstance.onApplicationBootstrap).toHaveBeenCalledTimes(1);
  });

  it('xc3(F): skips the module instance hook for a non-static tree', async () => {
    const moduleInstance = { onApplicationBootstrap: vi.fn() };
    const module = createModule({ moduleInstance, moduleStatic: false });

    await callModuleBootstrapHook(module);

    expect(moduleInstance.onApplicationBootstrap).not.toHaveBeenCalled();
  });

  it('skips the module instance hook when there is no instance', async () => {
    const module = createModule({ moduleInstance: undefined });

    await expect(callModuleBootstrapHook(module)).resolves.toBeUndefined();
  });

  it('propagates hook failures', async () => {
    const error = new Error('boom');
    const module = createModule({
      injectables: [
        [
          'p',
          createWrapper({
            instance: {
              onApplicationBootstrap: () => {
                throw error;
              },
            },
          }),
        ],
      ],
    });

    await expect(callModuleBootstrapHook(module)).rejects.toThrow(error);
  });

  it('does not log errors when everything succeeds', async () => {
    const spy = vi.spyOn(Logger, 'error');
    const module = createModule({});

    await callModuleBootstrapHook(module);

    expect(spy).not.toHaveBeenCalled();
  });
});
