import { Logger } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { callAppShutdownHook } from '../../../../packages/core/hooks/on-app-shutdown.hook.js';

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

describe('callAppShutdownHook', () => {
  afterEach(() => vi.restoreAllMocks());

  it('passes the signal to every hook', async () => {
    const provider = { onApplicationShutdown: vi.fn() };
    const moduleInstance = { onApplicationShutdown: vi.fn() };
    const module = createModule({
      moduleInstance,
      injectables: [['p', createWrapper({ level: 0, instance: provider })]],
    });

    await callAppShutdownHook(module, 'SIGTERM');

    expect(provider.onApplicationShutdown).toHaveBeenCalledWith('SIGTERM');
    expect(moduleInstance.onApplicationShutdown).toHaveBeenCalledWith(
      'SIGTERM',
    );
  });

  it('xc1(T): filters nil instances and instances without the hook', async () => {
    const hook = { onApplicationShutdown: vi.fn() };
    const module = createModule({
      injectables: [
        ['nil', createWrapper({ instance: null })],
        ['plain', createWrapper({ instance: {} })],
        ['hook', createWrapper({ instance: hook })],
      ],
    });

    await callAppShutdownHook(module);

    expect(hook.onApplicationShutdown).toHaveBeenCalledTimes(1);
  });

  it('xc2(T): logs rejections from instance hooks', async () => {
    const error = new Error('boom');
    const spy = vi.spyOn(Logger, 'error');
    const module = createModule({
      injectables: [
        [
          'p',
          createWrapper({
            instance: {
              onApplicationShutdown: async () => {
                throw error;
              },
            },
          }),
        ],
      ],
    });

    await callAppShutdownHook(module);

    expect(spy).toHaveBeenCalledWith(error, error.stack);
  });

  it('xc3(T): expands static transient instances', async () => {
    const transient = { onApplicationShutdown: vi.fn() };
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

    await callAppShutdownHook(module);

    expect(transient.onApplicationShutdown).toHaveBeenCalledTimes(1);
  });

  it('xc4(T): calls the module instance hook when the tree is static', async () => {
    const moduleInstance = { onApplicationShutdown: vi.fn() };
    const module = createModule({ moduleInstance, moduleStatic: true });

    await callAppShutdownHook(module);

    expect(moduleInstance.onApplicationShutdown).toHaveBeenCalledTimes(1);
  });

  it('xc4(F): skips the module instance hook for a non-static tree', async () => {
    const moduleInstance = { onApplicationShutdown: vi.fn() };
    const module = createModule({ moduleInstance, moduleStatic: false });

    await callAppShutdownHook(module);

    expect(moduleInstance.onApplicationShutdown).not.toHaveBeenCalled();
  });

  it('xc5(T): logs module instance hook failures', async () => {
    const error = new Error('boom');
    const spy = vi.spyOn(Logger, 'error');
    const module = createModule({
      moduleInstance: {
        onApplicationShutdown: async () => {
          throw error;
        },
      },
      moduleStatic: true,
    });

    await callAppShutdownHook(module);

    expect(spy).toHaveBeenCalledWith(error, error.stack);
  });

  it('skips the module instance hook when there is no instance', async () => {
    const module = createModule({ moduleInstance: undefined });

    await expect(callAppShutdownHook(module)).resolves.toBeUndefined();
  });
});
