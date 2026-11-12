import { Transport } from '../../../../packages/microservices/enums/transport.enum.js';
import { ServerFactory } from '../../../../packages/microservices/server/server-factory.js';
import { ServerGrpc } from '../../../../packages/microservices/server/server-grpc.js';
import { ServerKafka } from '../../../../packages/microservices/server/server-kafka.js';
import { ServerMqtt } from '../../../../packages/microservices/server/server-mqtt.js';
import { ServerNats } from '../../../../packages/microservices/server/server-nats.js';
import { ServerRedis } from '../../../../packages/microservices/server/server-redis.js';
import { ServerRMQ } from '../../../../packages/microservices/server/server-rmq.js';
import { ServerTCP } from '../../../../packages/microservices/server/server-tcp.js';

describe('ServerFactory', () => {
  // D1: switch (transport) - one outcome per case plus the default arm
  describe('create', () => {
    it.each([
      ['redis', Transport.REDIS, ServerRedis],
      ['nats', Transport.NATS, ServerNats],
      ['mqtt', Transport.MQTT, ServerMqtt],
      ['grpc', Transport.GRPC, ServerGrpc],
      ['kafka', Transport.KAFKA, ServerKafka],
      ['rmq', Transport.RMQ, ServerRMQ],
      ['tcp', Transport.TCP, ServerTCP],
    ])('should return a %s server', (_label, transport, ServerClass) => {
      const options =
        transport === Transport.GRPC ? { protoPath: '', package: '' } : {};
      const server = ServerFactory.create({ transport, options } as any);

      expect(server).toBeInstanceOf(ServerClass);
    });

    it('should fall back to a tcp server when no transport is given', () => {
      expect(ServerFactory.create({} as any)).toBeInstanceOf(ServerTCP);
    });

    it('should default options to an empty object', () => {
      const server = ServerFactory.create({ transport: Transport.TCP } as any);

      expect((server as any).options).toEqual({});
    });

    it('should pass the supplied options object to the server', () => {
      const options = { port: 1234, host: '127.0.0.1' };
      const server = ServerFactory.create({
        transport: Transport.TCP,
        options,
      } as any);

      expect((server as any).options).toBe(options);
      expect((server as any).port).toBe(1234);
    });
  });
});
