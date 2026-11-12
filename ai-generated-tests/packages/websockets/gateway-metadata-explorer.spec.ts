import { describe, expect, it, vi } from 'vitest';
import {
  MESSAGE_MAPPING_METADATA,
  MESSAGE_METADATA,
  PARAM_ARGS_METADATA,
} from '../../../packages/websockets/constants.js';
import { Ack } from '../../../packages/websockets/decorators/ack.decorator.js';
import { WebSocketServer } from '../../../packages/websockets/decorators/gateway-server.decorator.js';
import { SubscribeMessage } from '../../../packages/websockets/decorators/subscribe-message.decorator.js';
import { WsParamtype } from '../../../packages/websockets/enums/ws-paramtype.enum.js';
import { GatewayMetadataExplorer } from '../../../packages/websockets/gateway-metadata-explorer.js';

class Gateway {
  @WebSocketServer()
  server: any;

  @SubscribeMessage('mapped')
  mapped() {}

  @SubscribeMessage('ack')
  withAck(@Ack() ack: Function) {}

  unmapped() {}

  notAFunction = 1;
}

describe('GatewayMetadataExplorer', () => {
  const scanner = {
    getAllMethodNames: vi.fn(() => ['mapped', 'withAck', 'unmapped']),
  };
  const explorer = new GatewayMetadataExplorer(scanner as any);
  const gateway = new Gateway();

  describe('explore', () => {
    it('should scan the prototype and return only mapped methods', () => {
      const result = explorer.explore(gateway);

      expect(scanner.getAllMethodNames).toHaveBeenCalledWith(
        Object.getPrototypeOf(gateway),
      );
      expect(result.map(metadata => metadata.methodName)).toEqual([
        'mapped',
        'withAck',
      ]);
    });

    it('should filter out methods without message mapping metadata', () => {
      const result = explorer.explore(gateway);

      expect(result.every(metadata => metadata.callback)).toBe(true);
    });
  });

  describe('exploreMethodMetadata', () => {
    it('should return null for a method without message mapping', () => {
      expect(
        explorer.exploreMethodMetadata(gateway, 'unmapped'),
      ).toBeNull();
    });

    it('should return the callback, message and method name', () => {
      const metadata = explorer.exploreMethodMetadata(gateway, 'mapped')!;

      expect(metadata.methodName).toBe('mapped');
      expect(metadata.message).toBe('mapped');
      expect(metadata.callback).toBe(gateway.mapped);
      expect(metadata.isAckHandledManually).toBe(false);
    });

    it('should flag a method with an ack parameter', () => {
      expect(
        explorer.exploreMethodMetadata(gateway, 'withAck')!
          .isAckHandledManually,
      ).toBe(true);
    });

    it('should ignore parameter metadata without an ack', () => {
      class Plain {
        method() {}
      }
      const descriptor = Object.getOwnPropertyDescriptor(
        Plain.prototype,
        'method',
      )!;
      SubscribeMessage('message')(
        Plain.prototype,
        'method',
        descriptor,
      );
      Reflect.defineMetadata(
        PARAM_ARGS_METADATA,
        { [`${WsParamtype.SOCKET}:0`]: { index: 0 } },
        Plain,
        'method',
      );

      expect(
        explorer.exploreMethodMetadata(Plain.prototype, 'method')!
          .isAckHandledManually,
      ).toBe(false);
    });
  });

  describe('scanForServerHooks', () => {
    it('should yield only properties marked with @WebSocketServer', () => {
      expect([...explorer.scanForServerHooks(gateway)]).toEqual(['server']);
    });

    it('should skip function properties and unmarked properties', () => {
      const instance: any = { first: () => undefined, second: 1 };
      Reflect.defineMetadata(
        'websockets:is_socket',
        true,
        instance,
        'second',
      );

      expect([...explorer.scanForServerHooks(instance)]).toEqual(['second']);
    });
  });
});
