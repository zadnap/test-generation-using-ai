import { describe, expect, it } from 'vitest';
import { SocketsContainer } from '../../../packages/websockets/sockets-container.js';

describe('SocketsContainer', () => {
  it('should store and return a host by its options', () => {
    const container = new SocketsContainer();
    const host = { server: {} } as any;
    const options = { port: 3000, path: '/socket' };

    container.addOne(options, host);

    expect(container.getOneByConfig(options)).toBe(host);
    expect(container.getAll().size).toBe(1);
  });

  it('should hash options independently of key order', () => {
    const container = new SocketsContainer();
    const host = { server: {} } as any;

    container.addOne({ port: 3000, path: '/socket' }, host);

    expect(container.getOneByConfig({ path: '/socket', port: 3000 })).toBe(
      host,
    );
  });

  it('should distinguish different options', () => {
    const container = new SocketsContainer();

    container.addOne({ port: 3000 }, { id: 1 } as any);
    container.addOne({ port: 4000 }, { id: 2 } as any);

    expect(container.getAll().size).toBe(2);
    expect((container.getOneByConfig({ port: 3000 }) as any).id).toBe(1);
  });

  it('should clear every host', () => {
    const container = new SocketsContainer();
    container.addOne({ port: 3000 }, {} as any);

    container.clear();

    expect(container.getAll().size).toBe(0);
  });
});
