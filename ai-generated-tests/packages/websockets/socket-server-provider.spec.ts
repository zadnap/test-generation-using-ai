import { describe, expect, it, vi } from 'vitest';
import { SocketServerProvider } from '../../../packages/websockets/socket-server-provider.js';
import { SocketsContainer } from '../../../packages/websockets/sockets-container.js';

describe('SocketServerProvider', () => {
  const setup = () => {
    const container = new SocketsContainer();
    const adapter = { create: vi.fn((_port: number, options?: any) => ({ options })) };
    const config = { getIoAdapter: () => adapter };
    const provider = new SocketServerProvider(container, config as any);
    return { container, adapter, provider };
  };

  describe('scanForSocketServer', () => {
    it('should return an already stored server', () => {
      const { container, provider, adapter } = setup();
      const host = { server: { id: 'stored' } } as any;
      container.addOne({ port: 3000, path: '/ws' }, host);

      const result = provider.scanForSocketServer({ path: '/ws' }, 3000);

      expect(result).toBe(host);
      expect(adapter.create).not.toHaveBeenCalled();
    });

    it('should create a server when none is stored', () => {
      const { provider, adapter } = setup();
      adapter.create.mockReturnValue({ id: 'created' });

      const result = provider.scanForSocketServer({ path: '/ws' }, 3000);

      expect(adapter.create).toHaveBeenCalledWith(3000, { path: '/ws' });
      expect(result.server).toEqual({ id: 'created' });
    });

    it('should decorate an existing server with a namespace', () => {
      const { container, provider, adapter } = setup();
      const host = { server: { id: 'stored' } } as any;
      container.addOne({ port: 3000, path: '/ws' }, host);
      adapter.create.mockReturnValue({ id: 'namespace' });

      const result = provider.scanForSocketServer(
        { path: '/ws', namespace: 'chat' },
        3000,
      );

      expect(adapter.create).toHaveBeenCalledWith(3000, {
        path: '/ws',
        namespace: '/chat',
        server: { id: 'stored' },
      });
      expect(result.server).toEqual({ id: 'namespace' });
    });

    it('should create then decorate a new server with a namespace', () => {
      const { provider, adapter } = setup();
      adapter.create
        .mockReturnValueOnce({ id: 'root' })
        .mockReturnValueOnce({ id: 'namespace' });

      const result = provider.scanForSocketServer(
        { path: '/ws', namespace: 'chat' },
        3000,
      );

      expect(adapter.create).toHaveBeenNthCalledWith(1, 3000, { path: '/ws' });
      expect(adapter.create).toHaveBeenNthCalledWith(2, 3000, {
        path: '/ws',
        namespace: '/chat',
        server: { id: 'root' },
      });
      expect(result.server).toEqual({ id: 'namespace' });
    });
  });

  describe('namespace validation', () => {
    it.each([
      ['chat', '/chat'],
      ['/chat', '/chat'],
      ['{/chat}', '{/chat}'],
    ])('should normalize the string namespace %j', (namespace, expected) => {
      const { provider, adapter } = setup();
      adapter.create.mockReturnValue({});
      provider.scanForSocketServer({ namespace } as any, 3000);

      expect(adapter.create).toHaveBeenLastCalledWith(
        3000,
        expect.objectContaining({ namespace: expected }),
      );
    });

    it('should not decorate when the namespace is empty', () => {
      const { provider, adapter } = setup();
      adapter.create.mockReturnValue({});

      provider.scanForSocketServer({ namespace: '' } as any, 3000);

      expect(adapter.create).toHaveBeenCalledOnce();
      expect(adapter.create).toHaveBeenCalledWith(3000, {});
    });

    it('should keep a RegExp namespace', () => {
      const { provider, adapter } = setup();
      adapter.create.mockReturnValue({});
      const namespace = /^chat/;

      provider.scanForSocketServer({ namespace } as any, 3000);

      expect(adapter.create).toHaveBeenLastCalledWith(
        3000,
        expect.objectContaining({ namespace }),
      );
    });
  });
});
