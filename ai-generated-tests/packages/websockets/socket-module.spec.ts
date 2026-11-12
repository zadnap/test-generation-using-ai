import { describe, expect, it, vi } from 'vitest';
import { GATEWAY_METADATA } from '../../../packages/websockets/constants.js';
import { WebSocketGateway } from '../../../packages/websockets/decorators/socket-gateway.decorator.js';
import { SocketModule } from '../../../packages/websockets/socket-module.js';

@WebSocketGateway()
class Gateway {}

class NotAGateway {}

const createModule = () => new SocketModule();

describe('SocketModule', () => {
  describe('register', () => {
    it('should connect all gateways of every module', async () => {
      const instance = createModule();
      const providersA = new Map();
      const providersB = new Map();
      const modules = new Map([
        ['A', { providers: providersA }],
        ['B', { providers: providersB }],
      ]);
      const connect = vi
        .spyOn(instance, 'connectAllGateways')
        .mockResolvedValue([]);
      const config = { getIoAdapter: vi.fn() };

      await instance.register(
        { getModules: () => modules, contextOptions: {} } as any,
        config as any,
        {} as any,
        {},
      );

      expect(connect).toHaveBeenCalledWith(providersA, 'A');
      expect(connect).toHaveBeenCalledWith(providersB, 'B');
      expect((instance as any).applicationConfig).toBe(config);
    });

    it('should pass the http server and app options through', async () => {
      const instance = createModule();
      vi.spyOn(instance, 'connectAllGateways').mockResolvedValue([]);
      const httpServer = { id: 'http' };
      const appOptions = { preview: true };

      await instance.register(
        { getModules: () => new Map(), contextOptions: {} } as any,
        { getIoAdapter: vi.fn() } as any,
        {} as any,
        appOptions,
        httpServer,
      );

      expect((instance as any).httpServer).toBe(httpServer);
      expect((instance as any).appOptions).toBe(appOptions);
    });
  });

  describe('connectAllGateways', () => {
    it('should skip empty and non-metatype wrappers', async () => {
      const instance = createModule();
      const connect = vi
        .spyOn(instance, 'connectGatewayToServer')
        .mockResolvedValue(undefined);
      const valid = { instance: {}, metatype: Gateway };
      const providers = new Map<any, any>([
        ['empty', null],
        ['not-metatype', { isNotMetatype: true }],
        ['valid', valid],
      ]);

      await instance.connectAllGateways(providers, 'module');

      expect(connect).toHaveBeenCalledTimes(1);
      expect(connect).toHaveBeenCalledWith(valid, 'module');
    });
  });

  describe('connectGatewayToServer', () => {
    it('should ignore a provider without gateway metadata', async () => {
      const instance = createModule();
      const connect = vi.fn();
      (instance as any).webSocketsController = {
        connectGatewayToServer: connect,
      };

      await instance.connectGatewayToServer(
        { instance: new NotAGateway(), metatype: NotAGateway } as any,
        'module',
      );

      expect(connect).not.toHaveBeenCalled();
    });

    it('should initialize the adapter once and connect the gateway', async () => {
      const instance = createModule();
      const connect = vi.fn();
      (instance as any).webSocketsController = {
        connectGatewayToServer: connect,
      };
      const adapter: any = {};
      (instance as any).applicationConfig = {
        getIoAdapter: () => adapter,
      };
      (instance as any).appOptions = { forceCloseConnections: true };
      const wrapper = { instance: new Gateway(), metatype: Gateway } as any;

      await Promise.all([
        instance.connectGatewayToServer(wrapper, 'module'),
        instance.connectGatewayToServer(wrapper, 'module'),
      ]);

      expect(adapter.forceCloseConnections).toBe(true);
      expect((instance as any).isAdapterInitialized).toBe(true);
      expect(connect).toHaveBeenCalledTimes(2);
      expect(connect).toHaveBeenCalledWith(wrapper, 'module');
    });

    it('should create the default Socket.IO adapter when none is configured', async () => {
      const instance = createModule();
      (instance as any).webSocketsController = {
        connectGatewayToServer: vi.fn(),
      };
      const setIoAdapter = vi.fn();
      (instance as any).applicationConfig = {
        getIoAdapter: () => undefined,
        setIoAdapter,
      };
      (instance as any).appOptions = { forceCloseConnections: false };
      (instance as any).httpServer = { id: 'http' };

      await instance.connectGatewayToServer(
        { instance: new Gateway(), metatype: Gateway } as any,
        'module',
      );

      expect(setIoAdapter).toHaveBeenCalledOnce();
      const adapter = setIoAdapter.mock.calls[0][0];
      expect(adapter.forceCloseConnections).toBe(false);
      expect((instance as any).isAdapterInitialized).toBe(true);
    });
  });

  describe('close', () => {
    it('should do nothing when the module was not registered', async () => {
      await expect(createModule().close()).resolves.toBeUndefined();
    });

    it('should do nothing when no adapter is configured', async () => {
      const instance = createModule();
      (instance as any).applicationConfig = { getIoAdapter: () => undefined };

      await expect(instance.close()).resolves.toBeUndefined();
    });

    it('should close every server, dispose the adapter and clear the container', async () => {
      const instance = createModule();
      const close = vi.fn().mockResolvedValue(undefined);
      const dispose = vi.fn().mockResolvedValue(undefined);
      const adapter = { close, dispose };
      (instance as any).applicationConfig = { getIoAdapter: () => adapter };
      const container = (instance as any).socketsContainer;
      container.addOne({ port: 1 }, { server: { id: 1 } } as any);
      container.addOne({ port: 2 }, { server: undefined } as any);
      const clear = vi.spyOn(container, 'clear');

      await instance.close();

      expect(close).toHaveBeenCalledOnce();
      expect(close).toHaveBeenCalledWith({ id: 1 });
      expect(dispose).toHaveBeenCalledOnce();
      expect(clear).toHaveBeenCalledOnce();
    });
  });
});
