import { NestApplication } from '../../../../packages/core/index.js';
import { describe, expect, it, vi } from 'vitest';
import { AbstractWsAdapter } from '../../../../packages/websockets/adapters/ws-adapter.js';

class TestAdapter extends AbstractWsAdapter {
  public create() {
    return {} as any;
  }
  public bindMessageHandlers() {}
}

describe('AbstractWsAdapter', () => {
  it('should use the underlying HTTP server of a Nest application', () => {
    const httpServer = { id: 'http' };
    const app = Object.create(NestApplication.prototype);
    app.getUnderlyingHttpServer = () => httpServer;

    const adapter = new TestAdapter(app);

    expect((adapter as any).httpServer).toBe(httpServer);
  });

  it('should use a passed server directly', () => {
    const httpServer = { id: 'http' };
    const adapter = new TestAdapter(httpServer);

    expect((adapter as any).httpServer).toBe(httpServer);
  });

  it('should allow an omitted server', () => {
    expect((new TestAdapter() as any).httpServer).toBeUndefined();
  });

  it('should expose forceCloseConnections through a setter and getter', () => {
    const adapter = new TestAdapter();

    expect(adapter.forceCloseConnections).toBeUndefined();
    adapter.forceCloseConnections = true;
    expect(adapter.forceCloseConnections).toBe(true);
    adapter.forceCloseConnections = false;
    expect(adapter.forceCloseConnections).toBe(false);
  });

  describe('bindClientConnect', () => {
    it('should listen for the connection event', () => {
      const server = { on: vi.fn() };
      const callback = vi.fn();
      const adapter = new TestAdapter();

      adapter.bindClientConnect(server, callback);

      expect(server.on).toHaveBeenCalledWith('connection', callback);
    });
  });

  describe('bindClientDisconnect', () => {
    it('should use once when the client supports it', () => {
      const client = { once: vi.fn(), on: vi.fn() };
      const callback = vi.fn();
      const adapter = new TestAdapter();

      adapter.bindClientDisconnect(client, callback);

      expect(client.once).toHaveBeenCalledWith('disconnect', callback);
      expect(client.on).not.toHaveBeenCalled();
    });

    it('should fall back to on', () => {
      const client = { on: vi.fn() };
      const callback = vi.fn();
      const adapter = new TestAdapter();

      adapter.bindClientDisconnect(client, callback);

      expect(client.on).toHaveBeenCalledWith('disconnect', callback);
    });
  });

  describe('close', () => {
    it('should close a server and wait for the callback', async () => {
      const server = {
        close: vi.fn((callback: Function) => callback()),
      };
      const adapter = new TestAdapter();

      await adapter.close(server);

      expect(server.close).toHaveBeenCalledOnce();
    });

    it('should ignore a server without a close function', async () => {
      const adapter = new TestAdapter();

      await expect(adapter.close({ close: 'nope' } as any)).resolves.toBeUndefined();
      await expect(adapter.close(undefined as any)).resolves.toBeUndefined();
    });
  });

  it('should provide a no-op dispose', async () => {
    await expect(new TestAdapter().dispose()).resolves.toBeUndefined();
  });
});
