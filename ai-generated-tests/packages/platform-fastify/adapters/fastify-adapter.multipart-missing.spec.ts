import { afterEach, describe, expect, it, vi } from 'vitest';
import { FastifyAdapter } from '../../../../packages/platform-fastify/adapters/fastify-adapter.js';

// Dedicated file: the "optional package missing" branch needs the load to fail,
// and `tryLoadPackage` caches successful loads per module graph. Keeping this
// test isolated guarantees nothing loaded "@fastify/multipart" before it.
vi.mock('@fastify/multipart', () => {
  throw new Error("Cannot find module '@fastify/multipart'");
});

const adapters: FastifyAdapter[] = [];
const createAdapter = () => {
  const adapter = new FastifyAdapter();
  adapters.push(adapter);
  return adapter;
};

afterEach(async () => {
  vi.restoreAllMocks();
  for (const adapter of adapters.splice(0)) {
    try {
      await adapter.close();
    } catch {
      // ignore instances that were never started
    }
  }
});

describe('FastifyAdapter.useMultipart with a missing optional package', () => {
  it('should fail the startup when the optional multipart package is missing', async () => {
    const adapter = createAdapter();
    const registered: Function[] = [];
    (adapter as any).instance = {
      register: (fn: Function) => registered.push(fn),
    };
    adapter.useMultipart();
    const registerMultipart: any = registered[0];
    const instance = {
      hasRequestDecorator: () => false,
      register: vi.fn(),
    };

    await expect(registerMultipart(instance)).rejects.toThrow(
      /The "@fastify\/multipart" package is missing/,
    );
    expect(instance.register).not.toHaveBeenCalled();
  });
});
