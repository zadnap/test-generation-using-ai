import { lastValueFrom, Observable } from 'rxjs';
import { ClientKafka } from '../../../../packages/microservices/client/client-kafka.js';
import { KafkaHeaders } from '../../../../packages/microservices/enums/index.js';
import { InvalidKafkaClientTopicException } from '../../../../packages/microservices/errors/invalid-kafka-client-topic.exception.js';
import { InvalidMessageException } from '../../../../packages/microservices/errors/invalid-message.exception.js';
import { MaxPacketLengthExceededException } from '../../../../packages/microservices/errors/max-packet-length-exceeded.exception.js';
import { KafkaParser } from '../../../../packages/microservices/helpers/kafka-parser.js';
import { KafkaRequestSerializer } from '../../../../packages/microservices/serializers/kafka-request.serializer.js';
import { KafkaResponseDeserializer } from '../../../../packages/microservices/deserializers/kafka-response.deserializer.js';

const topic = 'test.topic';
const replyTopic = 'test.topic.reply';
const correlationId = '696fa0a9-1827-4e59-baef-f3628173fe4f';
const messageValue = 'test-message';

const flush = () => new Promise(resolve => setImmediate(resolve));

function createConsumerFake() {
  return {
    events: {
      GROUP_JOIN: 'consumer.group_join',
      CONNECT: 'consumer.connect',
      DISCONNECT: 'consumer.disconnect',
      REBALANCING: 'consumer.rebalancing',
      STOP: 'consumer.stop',
      CRASH: 'consumer.crash',
    },
    on: vi.fn(),
    connect: vi.fn(async () => undefined),
    disconnect: vi.fn(async () => undefined),
    subscribe: vi.fn(async () => undefined),
    run: vi.fn(async () => undefined),
    commitOffsets: vi.fn(async () => undefined),
  };
}

function createProducerFake() {
  return {
    events: {
      CONNECT: 'producer.connect',
      DISCONNECT: 'producer.disconnect',
    },
    on: vi.fn(),
    connect: vi.fn(async () => undefined),
    disconnect: vi.fn(async () => undefined),
    send: vi.fn(async () => [] as any[]),
  };
}

function createKafkaFake(
  consumer = createConsumerFake(),
  producer = createProducerFake(),
) {
  return {
    consumer: vi.fn(() => consumer),
    producer: vi.fn(() => producer),
  };
}

/**
 * Overrides only the collaborator (client creation); every other method under
 * test runs as in production.
 */
class TestableClientKafka extends ClientKafka {
  clientImpl: () => Promise<any> = async () => {
    throw new Error('createClient is not stubbed');
  };

  override async createClient<T = any>(): Promise<T> {
    return (await this.clientImpl()) as T;
  }
}

function setup(options: any = {}) {
  const consumer = createConsumerFake();
  const producer = createProducerFake();
  const kafka = createKafkaFake(consumer, producer);
  const client = new TestableClientKafka(options);
  client.clientImpl = async () => kafka;
  return { client, untyped: client as any, consumer, producer, kafka };
}

function collectStatuses(client: ClientKafka) {
  const statuses: string[] = [];
  client.status.subscribe(value => statuses.push(value as string));
  return statuses;
}

function eachMessagePayload(
  headers: Record<string, any>,
  value: string | null | object = messageValue,
) {
  const buffer =
    value === null
      ? null
      : Buffer.from(typeof value === 'string' ? value : JSON.stringify(value));
  return {
    topic,
    partition: 0,
    message: {
      key: Buffer.from('key'),
      value: buffer,
      offset: '0',
      size: buffer?.length ?? 0,
      timestamp: new Date().toISOString(),
      attributes: 1,
      headers,
    },
    heartbeat: async () => undefined,
    pause: () => () => undefined,
  } as any;
}

describe('ClientKafka', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // D1: clientOptions.brokers || default. D2: clientOptions.clientId || default.
  // D3: consumerOptions.groupId || default. D4: options.parser || undefined.
  // D5: options.serializer || default. D6: options.deserializer || default.
  describe('constructor', () => {
    it('applies the documented defaults', () => {
      const { untyped } = setup();

      expect(untyped.brokers).toEqual(['localhost:9092']);
      expect(untyped.clientId).toEqual('nestjs-consumer-client');
      expect(untyped.groupId).toEqual('nestjs-group-client');
      expect(untyped.producerOnlyMode).toBe(false);
      expect(untyped.parser).toBeInstanceOf(KafkaParser);
      expect(untyped.serializer).toBeInstanceOf(KafkaRequestSerializer);
      expect(untyped.deserializer).toBeInstanceOf(KafkaResponseDeserializer);
    });

    it('keeps the custom options and postfixId', () => {
      const { untyped } = setup({
        postfixId: '-custom',
        producerOnlyMode: true,
        client: { brokers: ['broker-a:9092'], clientId: 'my-client' },
        consumer: { groupId: 'my-group' },
      });

      expect(untyped.brokers).toEqual(['broker-a:9092']);
      expect(untyped.clientId).toEqual('my-client-custom');
      expect(untyped.groupId).toEqual('my-group-custom');
      expect(untyped.producerOnlyMode).toBe(true);
    });

    it('keeps a custom parser, serializer and deserializer', () => {
      const serializer = { serialize: vi.fn() };
      const deserializer = { deserialize: vi.fn() };
      const { untyped } = setup({
        parser: { keepBinary: true },
        serializer,
        deserializer,
      });

      expect(untyped.serializer).toBe(serializer);
      expect(untyped.deserializer).toBe(deserializer);
      expect(untyped.parser['keepBinary']).toBe(true);
    });
  });

  describe('subscribeToResponseOf', () => {
    it('pushes the reply pattern of a string pattern', () => {
      const { client, untyped } = setup();

      client.subscribeToResponseOf(topic);

      expect(untyped.responsePatterns).toEqual([replyTopic]);
    });

    it('normalizes an object pattern', () => {
      const { client, untyped } = setup();

      client.subscribeToResponseOf({ b: 2, a: 1 });

      expect(untyped.responsePatterns).toEqual(['{"a":1,"b":2}.reply']);
    });
  });

  describe('close', () => {
    // D1/D2: producer?.disconnect() / consumer?.disconnect() (present/absent).
    // D3: result.status === 'rejected' per result. D4: otherFailures.forEach.
    // D5: failure truthy.
    it('disconnects both clients and resets the state', async () => {
      const { client, untyped, consumer, producer } = setup();
      untyped._consumer = consumer;
      untyped._producer = producer;
      untyped.client = {};
      untyped.initialized = Promise.resolve();

      await client.close();

      expect(producer.disconnect).toHaveBeenCalledOnce();
      expect(consumer.disconnect).toHaveBeenCalledOnce();
      expect(untyped._consumer).toBeNull();
      expect(untyped._producer).toBeNull();
      expect(untyped.initialized).toBeNull();
      expect(untyped.client).toBeNull();
    });

    it('works when no client was ever connected', async () => {
      const { client, untyped } = setup();

      await expect(client.close()).resolves.toBeUndefined();

      expect(untyped._consumer).toBeNull();
      expect(untyped._producer).toBeNull();
    });

    it('rejects with the producer error and still disconnects the consumer', async () => {
      const { client, untyped, consumer, producer } = setup();
      const error = new Error('producer disconnect failed');
      producer.disconnect.mockRejectedValueOnce(error);
      untyped._consumer = consumer;
      untyped._producer = producer;

      await expect(client.close()).rejects.toBe(error);

      expect(consumer.disconnect).toHaveBeenCalledOnce();
      expect(untyped._consumer).toBeNull();
      expect(untyped._producer).toBeNull();
    });

    it('rejects with the consumer error', async () => {
      const { client, untyped, consumer, producer } = setup();
      const error = new Error('consumer disconnect failed');
      consumer.disconnect.mockRejectedValueOnce(error);
      untyped._consumer = consumer;
      untyped._producer = producer;

      await expect(client.close()).rejects.toBe(error);

      expect(producer.disconnect).toHaveBeenCalledOnce();
    });

    it('logs the second failure when both disconnects fail', async () => {
      const { client, untyped, consumer, producer } = setup();
      const producerError = new Error('producer');
      const consumerError = new Error('consumer');
      producer.disconnect.mockRejectedValueOnce(producerError);
      consumer.disconnect.mockRejectedValueOnce(consumerError);
      const loggerError = vi
        .spyOn(untyped.logger, 'error')
        .mockImplementation(() => undefined);
      untyped._consumer = consumer;
      untyped._producer = producer;

      await expect(client.close()).rejects.toBe(producerError);

      expect(loggerError).toHaveBeenCalledOnce();
      expect(loggerError).toHaveBeenCalledWith(consumerError);
    });
  });

  describe('handleClose', () => {
    // D1: routingMap.size > 0. D2: callback() throws (try/catch).
    it('does nothing when there is no pending request', () => {
      const { client, untyped } = setup();
      const loggerError = vi
        .spyOn(untyped.logger, 'error')
        .mockImplementation(() => undefined);

      client.handleClose();

      expect(loggerError).not.toHaveBeenCalled();
      expect(untyped.routingMap.size).toBe(0);
    });

    it('fails every pending request once, and keeps going when one throws', () => {
      const { client, untyped } = setup();
      const loggerError = vi
        .spyOn(untyped.logger, 'error')
        .mockImplementation(() => undefined);
      const throwing = vi.fn(() => {
        throw new Error('callback error');
      });
      const callback = vi.fn();
      untyped.routingMap.set('a', throwing);
      untyped.routingMap.set('b', callback);

      client.handleClose();

      expect(throwing).toHaveBeenCalledOnce();
      expect(callback).toHaveBeenCalledWith({
        err: expect.objectContaining({ message: 'Connection closed' }),
      });
      expect(loggerError).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'callback error' }),
      );
      expect(untyped.routingMap.size).toBe(0);
    });
  });

  // D1: initialized truthy (cached attempt). D2: producerOnlyMode.
  // D3: initialized === failed attempt (stale attempt check).
  describe('connect', () => {
    it('creates the client, the consumer and the producer', async () => {
      const { client, untyped, consumer, producer, kafka } = setup();
      const bindTopics = vi.spyOn(client, 'bindTopics');

      const connection = await client.connect();

      expect(kafka.consumer).toHaveBeenCalledOnce();
      expect(kafka.producer).toHaveBeenCalledOnce();
      expect(consumer.connect).toHaveBeenCalledOnce();
      expect(producer.connect).toHaveBeenCalledOnce();
      expect(consumer.on).toHaveBeenCalledWith(
        consumer.events.GROUP_JOIN,
        expect.any(Function),
      );
      expect(bindTopics).toHaveBeenCalledOnce();
      expect(connection).toBe(untyped._producer);
      expect(connection).toBe(producer);
      expect(untyped.initialized).not.toBeNull();
    });

    it('reuses a cached connection', async () => {
      const { client, untyped, producer, kafka } = setup();
      untyped.initialized = Promise.resolve();
      untyped._producer = producer;

      const connection = await client.connect();

      expect(connection).toBe(producer);
      expect(kafka.consumer).not.toHaveBeenCalled();
      expect(kafka.producer).not.toHaveBeenCalled();
    });

    it('only creates a producer in producerOnlyMode', async () => {
      const { client, untyped, consumer, producer, kafka } = setup({
        producerOnlyMode: true,
      });
      const bindTopics = vi.spyOn(client, 'bindTopics');

      const connection = await client.connect();

      expect(kafka.consumer).not.toHaveBeenCalled();
      expect(consumer.connect).not.toHaveBeenCalled();
      expect(producer.connect).toHaveBeenCalledOnce();
      expect(bindTopics).not.toHaveBeenCalled();
      expect(connection).toBe(producer);
    });

    it('discards a partially created connection and does not cache the failure', async () => {
      const { client, untyped, consumer, producer } = setup();
      const error = new Error('broker unavailable');
      consumer.connect.mockResolvedValueOnce(undefined);
      producer.connect.mockRejectedValueOnce(error);

      await expect(client.connect()).rejects.toBe(error);

      expect(untyped.initialized).toBeNull();
      expect(untyped._consumer).toBeNull();
      expect(untyped._producer).toBeNull();
      expect(untyped.client).toBeNull();
      expect(consumer.disconnect).toHaveBeenCalledOnce();
      expect(producer.disconnect).toHaveBeenCalledOnce();

      const connection = await client.connect();
      expect(connection).not.toBeNull();
    });

    it('does not tear down a newer connection when a stale attempt fails', async () => {
      const firstConsumer = createConsumerFake();
      let rejectFirst!: (err: Error) => void;
      firstConsumer.connect.mockImplementation(
        () =>
          new Promise<void>((_, reject) => {
            rejectFirst = reject;
          }),
      );
      const firstProducer = createProducerFake();
      const secondConsumer = createConsumerFake();
      const secondProducer = createProducerFake();
      const { client, untyped } = setup();
      let attempt = 0;
      client.clientImpl = async () =>
        attempt++ === 0
          ? createKafkaFake(firstConsumer, firstProducer)
          : createKafkaFake(secondConsumer, secondProducer);

      const firstAttempt = client.connect();
      await flush();
      await client.close();
      firstConsumer.disconnect.mockClear();

      await client.connect();
      const connectedConsumer = untyped._consumer;
      const connectedProducer = untyped._producer;

      rejectFirst(new Error('broker unavailable'));
      await expect(firstAttempt).rejects.toThrow('broker unavailable');

      expect(untyped._consumer).toBe(connectedConsumer);
      expect(untyped._producer).toBe(connectedProducer);
      expect(connectedConsumer).toBe(secondConsumer);
      expect(secondProducer.disconnect).not.toHaveBeenCalled();
      // The stale attempt still tears down the consumer it created.
      expect(firstConsumer.disconnect).toHaveBeenCalledOnce();
    });
  });

  describe('registerConsumerEventListeners', () => {
    // D1: !this._consumer (guard).
    it('does nothing without a consumer', () => {
      const { client, untyped } = setup();
      const consumer = createConsumerFake();
      untyped._consumer = null;

      client['registerConsumerEventListeners']();

      expect(consumer.on).not.toHaveBeenCalled();
      expect(untyped._consumer).toBeNull();
    });

    it('forwards every consumer event to the status stream', () => {
      const { client, untyped, consumer } = setup();
      untyped._consumer = consumer;
      const statuses = collectStatuses(client);

      client['registerConsumerEventListeners']();

      expect(consumer.on).toHaveBeenCalledTimes(5);
      for (const [, callback] of consumer.on.mock.calls) {
        callback();
      }

      expect(statuses).toEqual([
        'connected',
        'disconnected',
        'rebalancing',
        'stopped',
        'crashed',
      ]);
    });
  });

  describe('registerProducerEventListeners', () => {
    // D1: !this._producer (guard).
    it('does nothing without a producer', () => {
      const { client, untyped } = setup();
      const producer = createProducerFake();
      untyped._producer = null;

      client['registerProducerEventListeners']();

      expect(producer.on).not.toHaveBeenCalled();
    });

    it('forwards the producer events to the status stream', () => {
      const { client, untyped, producer } = setup();
      untyped._producer = producer;
      const statuses = collectStatuses(client);

      client['registerProducerEventListeners']();

      expect(producer.on).toHaveBeenCalledTimes(2);
      for (const [, callback] of producer.on.mock.calls) {
        callback();
      }

      expect(statuses).toEqual(['connected', 'disconnected']);
    });
  });

  // D1: !this._consumer. D2: responsePatterns.length > 0. D3/D4: options
  // subscribe/run fall back to {} (covered with and without the options).
  describe('bindTopics', () => {
    it('throws without a consumer', async () => {
      const { client } = setup();

      await expect(client.bindTopics()).rejects.toThrow(
        'No consumer initialized',
      );
    });

    it('only runs the consumer when there is no response pattern', async () => {
      const { client, untyped, consumer } = setup();
      untyped._consumer = consumer;

      await client.bindTopics();

      expect(consumer.subscribe).not.toHaveBeenCalled();
      expect(consumer.run).toHaveBeenCalledOnce();
      expect(consumer.run.mock.calls[0][0]).toHaveProperty('eachMessage');
    });

    it('subscribes the response patterns, merged with the subscribe options', async () => {
      const { client, untyped, consumer } = setup({
        subscribe: { fromBeginning: true },
        run: { partitionsConsumedConcurrently: 2 },
      });
      untyped._consumer = consumer;
      untyped.responsePatterns = [replyTopic];

      await client.bindTopics();

      expect(consumer.subscribe).toHaveBeenCalledWith({
        fromBeginning: true,
        topics: [replyTopic],
      });
      expect(consumer.run).toHaveBeenCalledWith({
        partitionsConsumedConcurrently: 2,
        eachMessage: expect.any(Function),
      });
    });
  });

  describe('createClient', () => {
    it('builds a kafkajs client from the options', async () => {
      const client = new ClientKafka({ client: { brokers: ['a:9092'] } });

      const kafka = await client.createClient();

      expect(typeof kafka.consumer).toBe('function');
      expect(typeof kafka.producer).toBe('function');
    });

    it('uses a custom logCreator from the client options', async () => {
      const logCreatorSpy = vi.fn();
      const logCreator = () => logCreatorSpy;
      const client = new ClientKafka({
        client: { brokers: [], logCreator },
      });

      const kafka = await client.createClient();
      kafka.logger().info({ namespace: '', level: 1, log: 'test' });

      expect(logCreatorSpy).toHaveBeenCalled();
    });
  });

  // D1: parser.parse throws. D2: routingMap.get throws. D3: callback?.
  // D4: isNil(correlationId). D5: deserializer.deserialize throws.
  // D6: !callback. D7: err || isDisposed.
  describe('createResponseCallback', () => {
    const correlationHeaders = {
      [KafkaHeaders.CORRELATION_ID]: Buffer.from(correlationId),
    };

    it('resolves the pending request with the response', async () => {
      const { client, untyped } = setup();
      const callback = vi.fn();
      untyped.routingMap.set(correlationId, callback);

      await client.createResponseCallback()(
        eachMessagePayload(correlationHeaders),
      );

      expect(callback).toHaveBeenCalledExactlyOnceWith({
        err: undefined,
        response: messageValue,
      });
    });

    it('passes isDisposed with the response', async () => {
      const { client, untyped } = setup();
      const callback = vi.fn();
      untyped.routingMap.set(correlationId, callback);

      await client.createResponseCallback()(
        eachMessagePayload({
          ...correlationHeaders,
          [KafkaHeaders.NEST_IS_DISPOSED]: Buffer.alloc(1),
        }),
      );

      expect(callback).toHaveBeenCalledWith({
        err: undefined,
        response: messageValue,
        isDisposed: true,
      });
    });

    it('passes isDisposed without a response for a completion-only message', async () => {
      const { client, untyped } = setup();
      const callback = vi.fn();
      untyped.routingMap.set(correlationId, callback);

      await client.createResponseCallback()(
        eachMessagePayload({
          ...correlationHeaders,
          [KafkaHeaders.NEST_IS_DISPOSED]: Buffer.alloc(1),
          [KafkaHeaders.NEST_NO_RESPONSE]: Buffer.alloc(1),
        }),
      );

      expect(callback).toHaveBeenCalledWith({
        err: undefined,
        response: undefined,
        isDisposed: true,
      });
    });

    it('passes the error header to the pending request', async () => {
      const { client, untyped } = setup();
      const callback = vi.fn();
      untyped.routingMap.set(correlationId, callback);

      await client.createResponseCallback()(
        eachMessagePayload({
          ...correlationHeaders,
          [KafkaHeaders.NEST_ERR]: Buffer.from('boom'),
        }),
      );

      expect(callback).toHaveBeenCalledWith({
        err: 'boom',
        response: undefined,
        isDisposed: true,
      });
    });

    it.each([
      ['no header at all', {}],
      ['undefined headers', undefined],
      ['an empty correlation id', { [KafkaHeaders.CORRELATION_ID]: null }],
    ])('skips a message with %s', async (_label, headers) => {
      const { client, untyped } = setup();
      const callback = vi.fn();
      untyped.routingMap.set(correlationId, callback);

      await expect(
        client.createResponseCallback()(eachMessagePayload(headers as any)),
      ).resolves.toBeUndefined();

      expect(callback).not.toHaveBeenCalled();
    });

    it('skips a message whose id has no pending request', async () => {
      const { client, untyped } = setup();
      const callback = vi.fn();
      untyped.routingMap.set('another-id', callback);

      await expect(
        client.createResponseCallback()(eachMessagePayload(correlationHeaders)),
      ).resolves.toBeUndefined();

      expect(callback).not.toHaveBeenCalled();
    });

    it('skips the message and fails the pending request when the parser throws', async () => {
      const { client, untyped } = setup();
      const callback = vi.fn();
      const loggerError = vi
        .spyOn(untyped.logger, 'error')
        .mockImplementation(() => undefined);
      untyped.parser = {
        parse: () => {
          throw new MaxPacketLengthExceededException(17);
        },
      };
      untyped.routingMap.set(correlationId, callback);

      await expect(
        client.createResponseCallback()(eachMessagePayload(correlationHeaders)),
      ).resolves.toBeUndefined();

      expect(loggerError).toHaveBeenCalledOnce();
      expect(callback).toHaveBeenCalledExactlyOnceWith({
        err: expect.any(MaxPacketLengthExceededException),
        isDisposed: true,
      });
    });

    it('skips the message when its correlation id cannot be decoded', async () => {
      const { client, untyped } = setup();
      const callback = vi.fn();
      untyped.parser = {
        parse: () => {
          throw new MaxPacketLengthExceededException(17);
        },
      };
      untyped.routingMap.set(correlationId, callback);
      vi.spyOn(untyped.logger, 'error').mockImplementation(() => undefined);

      await expect(
        client.createResponseCallback()(
          eachMessagePayload({
            [KafkaHeaders.CORRELATION_ID]: {
              toString: () => {
                throw new RangeError('too long');
              },
            },
          }),
        ),
      ).resolves.toBeUndefined();

      expect(callback).not.toHaveBeenCalled();
    });

    it('fails the pending request when the deserializer throws', async () => {
      const { client, untyped } = setup();
      const callback = vi.fn();
      const error = new Error('cannot deserialize');
      untyped.deserializer = {
        deserialize: () => {
          throw error;
        },
      };
      untyped.routingMap.set(correlationId, callback);

      await client.createResponseCallback()(
        eachMessagePayload(correlationHeaders),
      );

      expect(callback).toHaveBeenCalledExactlyOnceWith({
        err: error,
        isDisposed: true,
      });
    });

    it('does not throw when the deserializer fails for an unknown request', async () => {
      const { client, untyped } = setup();
      untyped.deserializer = {
        deserialize: () => {
          throw new Error('cannot deserialize');
        },
      };

      await expect(
        client.createResponseCallback()(eachMessagePayload(correlationHeaders)),
      ).resolves.toBeUndefined();
    });
  });

  describe('getConsumerAssignments', () => {
    it('returns the current assignments', () => {
      const { client, untyped } = setup();
      untyped.consumerAssignments = { [topic]: 1 };

      expect(client.getConsumerAssignments()).toEqual({ [topic]: 1 });
    });
  });

  // D1: isNil(pattern). D2: isNil(data).
  describe('emitBatch', () => {
    it('returns an observable', () => {
      const { client } = setup();

      expect(client.emitBatch(topic, { messages: [] })).toBeInstanceOf(
        Observable,
      );
    });

    it.each([
      ['a nil pattern', null, { messages: [] }],
      ['nil data', topic, null],
    ])('errors on %s', async (_label, pattern, data) => {
      const { client } = setup();

      await expect(
        lastValueFrom(client.emitBatch(pattern, data!)),
      ).rejects.toThrow(InvalidMessageException);
    });

    it('connects and sends the batch', async () => {
      const { client, producer } = setup();

      const result = await lastValueFrom(
        client.emitBatch(topic, { messages: [{ value: 1 }] }),
      );

      expect(producer.send).toHaveBeenCalledOnce();
      expect(producer.send.mock.calls[0][0].topic).toBe(topic);
      expect(result).toEqual([]);
    });
  });

  // D1: messages.length === 0. D2: options.send || {}.
  describe('dispatchBatchEvent', () => {
    it('sends nothing for an empty batch', async () => {
      const { client, untyped, producer } = setup();
      untyped._producer = producer;

      const result = await untyped.dispatchBatchEvent({
        pattern: topic,
        data: { messages: [] },
      });

      expect(result).toBeUndefined();
      expect(producer.send).not.toHaveBeenCalled();
    });

    it('serializes every message and merges the metadata into each', async () => {
      const { client, untyped, producer } = setup({ send: { acks: -1 } });
      untyped._producer = producer;

      await untyped.dispatchBatchEvent({
        pattern: topic,
        data: {
          messages: [{ value: 'a' }, { value: 'b', headers: { own: 'id' } }],
        },
        metadata: { 'x-request-id': 'trace-1' },
      });

      const record = producer.send.mock.calls[0][0];
      expect(record.topic).toBe(topic);
      expect(record.acks).toBe(-1);
      expect(record.messages).toHaveLength(2);
      expect(record.messages[0].headers).toEqual({ 'x-request-id': 'trace-1' });
      expect(record.messages[1].headers).toEqual({
        'x-request-id': 'trace-1',
        own: 'id',
      });
    });
  });

  // D1: options.send || {}.
  describe('dispatchEvent', () => {
    it('sends a single message for the event', async () => {
      const { client, untyped, producer } = setup({ send: { acks: 1 } });
      untyped._producer = producer;

      await untyped.dispatchEvent({ pattern: topic, data: messageValue });

      const record = producer.send.mock.calls[0][0];
      expect(record.topic).toBe(topic);
      expect(record.acks).toBe(1);
      expect(record.messages[0].value).toBe(messageValue);
    });

    it('sends the packet metadata as headers, letting the message win', async () => {
      const { client, untyped, producer } = setup();
      untyped._producer = producer;

      await untyped.dispatchEvent({
        pattern: topic,
        data: { value: messageValue, headers: { own: 'id' } },
        metadata: { own: 'metadata', tenant: 'acme' },
      });

      expect(producer.send.mock.calls[0][0].messages[0].headers).toEqual({
        own: 'id',
        tenant: 'acme',
      });
    });

    it('rejects when the producer refuses the message', async () => {
      const { client, untyped, producer } = setup();
      const error = new Error('send failed');
      producer.send.mockRejectedValueOnce(error);
      untyped._producer = producer;

      await expect(
        untyped.dispatchEvent({ pattern: topic, data: messageValue }),
      ).rejects.toBe(error);
    });
  });

  // D1: isUndefined(minimumPartition).
  describe('getReplyTopicPartition', () => {
    it.each([
      [0, '0'],
      [3, '3'],
    ])('returns the minimum partition of %i as text', (partition, expected) => {
      const { untyped } = setup();
      untyped.consumerAssignments = { [replyTopic]: partition };

      expect(untyped.getReplyTopicPartition(replyTopic)).toBe(expected);
    });

    it('throws when the reply topic is not assigned', () => {
      const { untyped } = setup();
      untyped.consumerAssignments = {};

      expect(() => untyped.getReplyTopicPartition(replyTopic)).toThrow(
        InvalidKafkaClientTopicException,
      );
    });
  });

  // D1: the try block throws (reply partition or serialization).
  // D2: producer.send rejects. D3: options.send || {}.
  describe('publish', () => {
    function setupPublish() {
      const context = setup();
      context.untyped._producer = context.producer;
      context.untyped.consumerAssignments = { [replyTopic]: 0 };
      return context;
    }

    it('sends the request with the reply headers', async () => {
      const { untyped, producer } = setupPublish();
      const callback = vi.fn();

      const cleanup = untyped.publish(
        { pattern: topic, data: messageValue },
        callback,
      );
      await flush();

      const record = producer.send.mock.calls[0][0];
      const packet = record.messages[0];
      const sentCorrelationId = packet.headers[KafkaHeaders.CORRELATION_ID];
      expect(record.topic).toBe(topic);
      expect(packet.value).toBe(messageValue);
      expect(typeof sentCorrelationId).toBe('string');
      expect(packet.headers[KafkaHeaders.REPLY_TOPIC]).toBe(replyTopic);
      expect(packet.headers[KafkaHeaders.REPLY_PARTITION]).toBe('0');
      expect(untyped.routingMap.has(sentCorrelationId)).toBe(true);
      expect(callback).not.toHaveBeenCalled();

      // Unsubscribing removes the pending request.
      cleanup();
      expect(untyped.routingMap.size).toBe(0);
    });

    it('lets the metadata fill in headers but never replace the reply headers', async () => {
      const { untyped, producer } = setupPublish();

      untyped.publish(
        {
          pattern: topic,
          data: messageValue,
          metadata: {
            'x-request-id': 'trace-1',
            [KafkaHeaders.REPLY_TOPIC]: 'elsewhere',
          },
        },
        vi.fn(),
      );
      await flush();

      const headers = producer.send.mock.calls[0][0].messages[0].headers;
      expect(headers['x-request-id']).toBe('trace-1');
      expect(headers[KafkaHeaders.REPLY_TOPIC]).toBe(replyTopic);
    });

    it.each([
      ['the reply topic is not assigned', 0],
      ['the serializer throws', 1],
    ])(
      'calls back with the error and returns a no-op when %s',
      async (_label, mode) => {
        const { untyped, producer } = setup();
        untyped._producer = producer;
        if (mode === 1) {
          untyped.consumerAssignments = { [replyTopic]: 0 };
          untyped.serializer = {
            serialize: () => {
              throw new Error('cannot serialize');
            },
          };
        }
        const callback = vi.fn();

        const cleanup = untyped.publish(
          { pattern: topic, data: messageValue },
          callback,
        );

        expect(callback).toHaveBeenCalledOnce();
        expect(callback.mock.calls[0][0].err).toBeInstanceOf(Error);
        expect(cleanup()).toBeNull();
        expect(untyped.routingMap.size).toBe(0);
        expect(producer.send).not.toHaveBeenCalled();
      },
    );

    it('spreads the send options into the record', async () => {
      const { untyped, producer } = setup({ send: { acks: -1 } });
      untyped._producer = producer;
      untyped.consumerAssignments = { [replyTopic]: 0 };

      untyped.publish({ pattern: topic, data: messageValue }, vi.fn());
      await flush();

      expect(producer.send.mock.calls[0][0].acks).toBe(-1);
    });

    it('calls back with the error when the producer rejects', async () => {
      const { untyped, producer } = setupPublish();
      const error = new Error('send failed');
      producer.send.mockRejectedValueOnce(error);
      const callback = vi.fn();

      untyped.publish({ pattern: topic, data: messageValue }, callback);
      await flush();

      expect(callback).toHaveBeenCalledWith({ err: error });
      expect(untyped.routingMap.size).toBe(0);
    });
  });

  describe('getResponsePatternName', () => {
    it('suffixes the reply topic', () => {
      const { untyped } = setup();

      expect(untyped.getResponsePatternName(topic)).toBe(replyTopic);
    });
  });

  // D1: hasPacketMetadata(metadata).
  describe('mergeMetadata', () => {
    it.each([
      ['undefined', undefined],
      ['empty', {}],
    ])('returns the same message for %s metadata', (_label, metadata) => {
      const { untyped } = setup();
      const message = { value: messageValue };

      expect(untyped.mergeMetadata(message, metadata)).toBe(message);
    });

    it('returns a copy with the metadata headers, the message winning', () => {
      const { untyped } = setup();
      const message = { value: messageValue, headers: { own: 'id' } };

      const merged = untyped.mergeMetadata(message, {
        own: 'metadata',
        tenant: 'acme',
      });

      expect(merged).not.toBe(message);
      expect(merged.headers).toEqual({ own: 'id', tenant: 'acme' });
      expect(message.headers).toEqual({ own: 'id' });
    });
  });

  // D1: memberPartitions.length.
  describe('setConsumerAssignments', () => {
    it('keeps the minimum partition of every topic, skipping empty ones', () => {
      const { client, untyped } = setup();

      untyped.setConsumerAssignments({
        payload: {
          memberAssignment: {
            'topic-a': [2, 0, 5],
            'topic-b': [],
          },
        },
      });

      expect(client.getConsumerAssignments()).toEqual({ 'topic-a': 0 });
    });
  });

  // D1: this._consumer present.
  describe('commitOffsets', () => {
    it('delegates to the consumer', async () => {
      const { client, untyped, consumer } = setup();
      untyped._consumer = consumer;
      const offsets = [{ topic, partition: 0, offset: '2' }] as any;

      await client.commitOffsets(offsets);

      expect(consumer.commitOffsets).toHaveBeenCalledWith(offsets);
    });

    it('throws without a consumer', () => {
      const { client } = setup();

      expect(() => client.commitOffsets([])).toThrow('No consumer initialized');
    });
  });

  // D1: producerOnlyMode. D2/D3: consumer/producer options fall back to {}.
  describe('initializeClientAndConnections', () => {
    it('creates and connects the consumer before the producer', async () => {
      const { untyped, consumer, producer, kafka } = setup();
      const attempt: any = {};

      await untyped.initializeClientAndConnections(attempt);

      expect(untyped.client).toBe(kafka);
      expect(attempt.consumer).toBe(consumer);
      expect(attempt.producer).toBe(producer);
      expect(consumer.connect.mock.invocationCallOrder[0]).toBeLessThan(
        producer.connect.mock.invocationCallOrder[0],
      );
      expect(untyped._consumer).toBe(consumer);
      expect(untyped._producer).toBe(producer);
    });

    it('passes the consumer group and the producer options', async () => {
      const { untyped, kafka } = setup({
        consumer: { groupId: 'custom' },
        producer: { allowAutoTopicCreation: false },
      });

      await untyped.initializeClientAndConnections({});

      expect(kafka.consumer.mock.calls[0][0]).toMatchObject({
        groupId: 'custom-client',
      });
      expect(kafka.consumer.mock.calls[0][0].partitionAssigners).toHaveLength(
        1,
      );
      expect(kafka.producer.mock.calls[0][0]).toEqual({
        allowAutoTopicCreation: false,
      });
    });

    it('skips the consumer in producerOnlyMode', async () => {
      const { untyped, consumer, producer, kafka } = setup({
        producerOnlyMode: true,
      });

      await untyped.initializeClientAndConnections({});

      expect(kafka.consumer).not.toHaveBeenCalled();
      expect(consumer.connect).not.toHaveBeenCalled();
      expect(producer.connect).toHaveBeenCalledOnce();
    });

    it('rejects when the producer cannot connect', async () => {
      const { untyped, producer } = setup();
      const error = new Error('producer');
      producer.connect.mockRejectedValueOnce(error);

      await expect(untyped.initializeClientAndConnections({})).rejects.toBe(
        error,
      );
    });
  });

  // D1: this.initialized === initialized (the attempt is still the current
  // one). D2/D3: attempt.consumer/producer optional chaining.
  describe('discardPartialConnection', () => {
    it('resets the state and disconnects what the attempt created', async () => {
      const { untyped, consumer, producer } = setup();
      const initialized = Promise.resolve();
      untyped.initialized = initialized;
      untyped.client = {};
      untyped._consumer = consumer;
      untyped._producer = producer;

      await untyped.discardPartialConnection(
        { consumer, producer },
        initialized,
      );

      expect(untyped._consumer).toBeNull();
      expect(untyped._producer).toBeNull();
      expect(untyped.client).toBeNull();
      expect(untyped.initialized).toBeNull();
      expect(consumer.disconnect).toHaveBeenCalledOnce();
      expect(producer.disconnect).toHaveBeenCalledOnce();
    });

    it('keeps a newer connection and disconnects only what the attempt created', async () => {
      const { untyped, consumer } = setup();
      const newerConsumer = createConsumerFake();
      untyped.initialized = Promise.resolve();
      untyped.client = {};
      untyped._consumer = newerConsumer;

      await untyped.discardPartialConnection({ consumer }, Promise.resolve());

      expect(untyped._consumer).toBe(newerConsumer);
      expect(untyped.client).not.toBeNull();
      expect(consumer.disconnect).toHaveBeenCalledOnce();
    });

    it('handles an attempt that created nothing', async () => {
      const { untyped } = setup();

      await expect(
        untyped.discardPartialConnection({}, Promise.resolve()),
      ).resolves.toBeUndefined();
    });
  });

  // D1: !this.client.
  describe('unwrap', () => {
    it('throws before the client is created', () => {
      const { client } = setup();

      expect(() => client.unwrap()).toThrow(/Not initialized/);
    });

    it('returns the kafkajs client', () => {
      const { client, untyped } = setup();
      const kafka = createKafkaFake();
      untyped.client = kafka;

      expect(client.unwrap()).toBe(kafka);
    });
  });

  describe('on', () => {
    it('is not supported', () => {
      const { client } = setup();

      expect(() => client.on('event', () => undefined)).toThrow(
        'Method is not supported for Kafka client',
      );
    });
  });
});
