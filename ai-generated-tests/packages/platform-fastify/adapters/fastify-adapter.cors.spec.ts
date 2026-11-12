import { afterEach, describe, expect, it, vi } from 'vitest';
import { FastifyAdapter } from '../../../../packages/platform-fastify/adapters/fastify-adapter.js';

// The proxy branch that forwards non-function properties, and the plugin
// callback error branch, are both internal to `enableCors`. A fake
// "@fastify/cors" plugin drives them deterministically.
const corsState = vi.hoisted(() => ({
  mode: 'success' as 'success' | 'read-prop' | 'error',
  nonFunctionReads: 0,
}));

vi.mock('@fastify/cors', () => ({
  default: (instance: any, _options: any, callback: any) => {
    if (corsState.mode === 'read-prop') {
      const value = instance.someNonFunctionProperty;
      if (value === undefined) {
        corsState.nonFunctionReads++;
      }
    }
    if (corsState.mode === 'error') {
      callback(new Error('cors plugin failed'));
      return;
    }
    callback(null);
  },
}));

const adapters: FastifyAdapter[] = [];

const setup = () => {
  const adapter = new FastifyAdapter();
  adapters.push(adapter);
  const registered: Function[] = [];
  (adapter as any).instance = {
    register: (fn: Function) => registered.push(fn),
  };
  adapter.enableCors({} as any);
  const registerCors: any = registered[0];
  const instance = {
    addHook: vi.fn(),
  };
  return { adapter, registerCors, instance };
};

afterEach(async () => {
  corsState.mode = 'success';
  corsState.nonFunctionReads = 0;
  for (const adapter of adapters.splice(0)) {
    try {
      await adapter.close();
    } catch {
      // ignore instances whose `instance` was replaced by a stub
    }
  }
});

describe('FastifyAdapter.enableCors proxy branches', () => {
  it('should forward a non-function instance property untouched', async () => {
    corsState.mode = 'read-prop';
    const { registerCors, instance } = setup();

    await expect(registerCors(instance)).resolves.toBeUndefined();
    expect(corsState.nonFunctionReads).toBe(1);
  });

  it('should reject when the CORS plugin reports an error', async () => {
    corsState.mode = 'error';
    const { registerCors, instance } = setup();

    await expect(registerCors(instance)).rejects.toThrow('cors plugin failed');
  });
});
