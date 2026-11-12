import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { ClientGrpcProxy } from '../../../../packages/microservices/client/client-grpc.js';
import { ClientKafka } from '../../../../packages/microservices/client/client-kafka.js';
import { ClientMqtt } from '../../../../packages/microservices/client/client-mqtt.js';
import { ClientNats } from '../../../../packages/microservices/client/client-nats.js';
import { ClientProxyFactory } from '../../../../packages/microservices/client/client-proxy-factory.js';
import { ClientProxy } from '../../../../packages/microservices/client/client-proxy.js';
import { ClientRedis } from '../../../../packages/microservices/client/client-redis.js';
import { ClientRMQ } from '../../../../packages/microservices/client/client-rmq.js';
import { ClientTCP } from '../../../../packages/microservices/client/client-tcp.js';
import { Transport } from '../../../../packages/microservices/enums/transport.enum.js';
import type {
  ReadPacket,
  WritePacket,
} from '../../../../packages/microservices/interfaces/index.js';

class CustomClient extends ClientProxy {
  public constructor(public readonly customOptions: unknown) {
    super();
  }

  public connect(): Promise<any> {
    return Promise.resolve();
  }

  public close(): void {}

  public unwrap<T>(): T {
    return undefined as T;
  }

  protected publish(
    _packet: ReadPacket,
    _callback: (packet: WritePacket) => void,
  ): () => void {
    return () => {};
  }

  protected async dispatchEvent<T = any>(_packet: ReadPacket): Promise<T> {
    return undefined as T;
  }
}

const protoPath = join(
  import.meta.dirname,
  '../../../../packages/microservices/test/client/test.proto',
);

/**
 * Decision numbering for `create`:
 *   D1 `customClass` truthy? (custom branch / transport switch)
 *   D2 `options` default applied when missing? (default `{}` / explicit options)
 *   D3..D8 transport switch: REDIS, NATS, MQTT, GRPC, RMQ, KAFKA and the
 *          default (TCP) branch.
 * The `clientOptions ?? { options: {} }` fallback in the destructuring is
 * infeasible: `isCustomClientOptions(clientOptions)` dereferences the argument
 * first, so a nullish argument throws before the fallback is evaluated.
 * GRPC needs a real `.proto` file to build its clients.
 */
describe('ClientProxyFactory.create', () => {
  it('creates the custom class with its own options when customClass is set (D1 true)', () => {
    const options = { marker: 'custom' };
    const proxy = ClientProxyFactory.create({
      customClass: CustomClient,
      options,
    } as any);

    expect(proxy).toBeInstanceOf(CustomClient);
    expect((proxy as CustomClient).customOptions).toBe(options);
  });

  it('ignores a falsy customClass and falls through to the transport switch (D1 false)', () => {
    const proxy = ClientProxyFactory.create({
      customClass: null,
      transport: Transport.REDIS,
    } as any);

    expect(proxy).toBeInstanceOf(ClientRedis);
  });

  it.each([
    ['REDIS' as const, Transport.REDIS, ClientRedis],
    ['NATS' as const, Transport.NATS, ClientNats],
    ['MQTT' as const, Transport.MQTT, ClientMqtt],
    ['RMQ' as const, Transport.RMQ, ClientRMQ],
    ['KAFKA' as const, Transport.KAFKA, ClientKafka],
    ['default/TCP' as const, Transport.TCP, ClientTCP],
  ])(
    'creates the %s proxy for its transport',
    (_name, transport, expectedClass) => {
      const proxy = ClientProxyFactory.create({ transport, options: {} });

      expect(proxy).toBeInstanceOf(expectedClass);
    },
  );

  it('creates a gRPC proxy for Transport.GRPC (D3..D8 GRPC branch)', () => {
    const proxy = ClientProxyFactory.create({
      transport: Transport.GRPC,
      options: { protoPath, package: 'test' },
    });

    expect(proxy).toBeInstanceOf(ClientGrpcProxy);
  });

  it('uses an empty options object when options is omitted (D2 default)', () => {
    const proxy = ClientProxyFactory.create({ transport: Transport.TCP });

    expect(proxy).toBeInstanceOf(ClientTCP);
    expect((proxy as any).port).toBe(3000);
    expect((proxy as any).host).toBe('localhost');
  });

  it('passes explicit options through to the constructed proxy (D2 explicit)', () => {
    const proxy = ClientProxyFactory.create({
      transport: Transport.TCP,
      options: { port: 4000, host: 'example.test' },
    });

    expect(proxy).toBeInstanceOf(ClientTCP);
    expect((proxy as any).port).toBe(4000);
    expect((proxy as any).host).toBe('example.test');
  });

  it('throws for a nullish clientOptions because the custom-class check dereferences it first (infeasible fallback)', () => {
    expect(() => ClientProxyFactory.create(undefined as any)).toThrow(
      TypeError,
    );
  });
});
