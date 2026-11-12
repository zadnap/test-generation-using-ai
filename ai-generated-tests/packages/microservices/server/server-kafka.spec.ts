import { concat, EMPTY, of, ReplaySubject, throwError } from 'rxjs';
import { NO_MESSAGE_HANDLER } from '../../../../packages/microservices/constants.js';
import { KafkaContext } from '../../../../packages/microservices/ctx-host/index.js';
import {
  KafkaHeaders,
  Transport,
} from '../../../../packages/microservices/enums/index.js';
import { KafkaRetriableException } from '../../../../packages/microservices/exceptions/index.js';
import { MaxPacketLengthExceededException } from '../../../../packages/microservices/errors/max-packet-length-exceeded.exception.js';
import { ServerKafka } from '../../../../packages/microservices/server/server-kafka.js';

const topic = 'test.topic';
const replyTopic = 'test.topic.reply';
const correlationId = '696fa0a9-1827-4e59-baef-f3628173fe4f';
const messageValue = 'test-message';

const flush = () => new Promise(resolve => setImmediate(resolve));

function createConsumerFake() {
  return {
    events: {
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
class TestableServerKafka extends ServerKafka {
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
  const server = new TestableServerKafka(options);
  server.clientImpl = async () => kafka;
  return { server, untyped: server as any, consumer, producer, kafka };
}

function collectStatuses(server: ServerKafka) {
  const statuses: string[] = [];
  server.status.subscribe(value => statuses.push(value as string));
  return statuses;
}

function kafkaMessage(
  headers: Record<string, any> = {},
  value: any = messageValue,
) {
  const buffer = Buffer.isBuffer(value)
    ? value
    : Buffer.from(typeof value === 'string' ? value : JSON.stringify(value));
  return {
    key: Buffer.from('key'),
    value: buffer,
    offset: '0',
    size: buffer.length,
    timestamp: new Date().toISOString(),
    attributes: 1,
    headers,
  } as any;
}

function eachPayload(
  topicName: string = topic,
  headers: Record<string, any> = {},
  value: any = messageValue,
) {
  return {
    topic: topicName,
    partition: 0,
    message: kafkaMessage(headers, value),
    heartbeat: async () => undefined,
    pause: () => () => undefined,
  } as any;
}

const correlationHeaders = {
  [KafkaHeaders.CORRELATION_ID]: Buffer.from(correlationId),
};
const requestHeaders = {
  ...correlationHeaders,
  [KafkaHeaders.REPLY_TOPIC]: Buffer.from(replyTopic),
  [KafkaHeaders.REPLY_PARTITION]: Buffer.from('0'),
};

describe('ServerKafka', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // D1: clientOptions.brokers || default. D2: clientOptions.clientId ||
  // default. D3: consumerOptions.groupId || default. D4: options.parser ||
  // undefined. D5/D6: serializer/deserializer provided or defaulted.
  describe('constructor', () => {
    it('applies the documented defaults', () => {
      const { untyped } = setup();

      expect(untyped.brokers).toEqual(['localhost:9092']);
      expect(untyped.clientId).toEqual('nestjs-consumer-server');
      expect(untyped.groupId).toEqual('nestjs-group-server');
      expect(untyped.transportId).toBe(Transport.KAFKA);
      expect(untyped.propagatesEventHandlerErrors).toBe(true);
    });

    it('keeps the custom options, postfixId and clients', () => {
      const serializer = { serialize: vi.fn() };
      const deserializer = { deserialize: vi.fn() };
      const { untyped } = setup({
        postfixId: '-custom',
        client: { brokers: ['broker-a:9092'], clientId: 'srv' },
        consumer: { groupId: 'grp' },
        parser: { keepBinary: true },
        serializer,
        deserializer,
      });

      expect(untyped.brokers).toEqual(['broker-a:9092']);
      expect(untyped.clientId).toBe('srv-custom');
      expect(untyped.groupId).toBe('grp-custom');
      expect(untyped.parser['keepBinary']).toBe(true);
      expect(untyped.serializer).toBe(serializer);
      expect(untyped.deserializer).toBe(deserializer);
    });
  });

  // D1: pattern instanceof RegExp (delegate vs. store here).
  // D2: messageHandlers.has(pattern) && isEventHandler. D3: handler?.next.
  describe('addHandler', () => {
    it('delegates a string pattern to the base server', () => {
      const { server, untyped } = setup();
      const handler = vi.fn();

      server.addHandler(topic, handler, true, { extra: 1 });

      expect(untyped.messageHandlers.get(topic)).toBe(handler);
      expect(handler.isEventHandler).toBe(true);
      expect(handler.extras).toEqual({ extra: 1 });
    });

    it('normalizes an object pattern to its route', () => {
      const { server, untyped } = setup();
      const handler = vi.fn();

      server.addHandler({ a: 1 }, handler);

      expect([...untyped.messageHandlers.keys()]).toEqual(['{"a":1}']);
    });

    it('stores a new regex pattern as it is', () => {
      const { server, untyped } = setup();
      const pattern = /^test\..*/;
      const handler = vi.fn();

      server.addHandler(pattern, handler);

      expect(untyped.messageHandlers.get(pattern)).toBe(handler);
    });

    it('replaces the handler of a regex pattern when it is not an event handler', () => {
      const { server, untyped } = setup();
      const pattern = /^test\..*/;
      const first = vi.fn();
      const second = vi.fn();
      server.addHandler(pattern, first, true);
      server.addHandler(pattern, second, false);

      expect(untyped.messageHandlers.get(pattern)).toBe(second);
      expect(second.isEventHandler).toBe(false);
    });

    it('chains the handlers of a regex event handler', () => {
      const { server, untyped } = setup();
      const pattern = /^test\..*/;
      const first = vi.fn();
      const second = vi.fn();
      const third = vi.fn();

      server.addHandler(pattern, first, true);
      server.addHandler(pattern, second, true);
      server.addHandler(pattern, third, true);

      expect(untyped.messageHandlers.get(pattern)).toBe(first);
      expect(first.next).toBe(second);
      expect(second.next).toBe(third);
      expect(third.next).toBeUndefined();
      expect(first.isEventHandler).toBe(true);
    });
  });

  // D1: the try block rejects (createClient or start).
  describe('listen', () => {
    it('creates the client, starts the consumer and calls back', async () => {
      const { server, consumer, producer } = setup();
      const callback = vi.fn();

      await server.listen(callback);

      expect(callback).toHaveBeenCalledWith();
      expect(consumer.connect).toHaveBeenCalledOnce();
      expect(producer.connect).toHaveBeenCalledOnce();
    });

    it('calls back with the client creation error', async () => {
      const { server } = setup();
      const error = new Error('kafkajs is not installed');
      server.clientImpl = async () => {
        throw error;
      };
      const start = vi.spyOn(server, 'start');
      const callback = vi.fn();

      await server.listen(callback);

      expect(callback).toHaveBeenCalledExactlyOnceWith(error);
      expect(start).not.toHaveBeenCalled();
    });

    it('calls back with the error thrown while starting', async () => {
      const { server } = setup();
      const error = new Error('broker unavailable');
      vi.spyOn(server, 'start').mockRejectedValueOnce(error);
      const callback = vi.fn();

      await server.listen(callback);

      expect(callback).toHaveBeenCalledExactlyOnceWith(error);
    });
  });

  // D1: consumerFailed. D2: the producer error while consumerFailed is true.
  describe('close', () => {
    function setupClose() {
      const context = setup();
      context.untyped.consumer = context.consumer;
      context.untyped.producer = context.producer;
      context.untyped.client = context.kafka;
      return context;
    }

    it('disconnects both clients and resets them', async () => {
      const { server, untyped, consumer, producer } = setupClose();

      await server.close();

      expect(consumer.disconnect).toHaveBeenCalledOnce();
      expect(producer.disconnect).toHaveBeenCalledOnce();
      expect(untyped.consumer).toBeNull();
      expect(untyped.producer).toBeNull();
      expect(untyped.client).toBeNull();
    });

    it('disconnects the producer only after the consumer', async () => {
      const { server, untyped, producer } = setupClose();
      let resolveConsumer!: () => void;
      untyped.consumer.disconnect.mockReturnValueOnce(
        new Promise<void>(resolve => {
          resolveConsumer = resolve;
        }),
      );

      const closing = server.close();
      await flush();
      expect(producer.disconnect).not.toHaveBeenCalled();

      resolveConsumer();
      await closing;
      expect(producer.disconnect).toHaveBeenCalledOnce();
    });

    it('rejects with the consumer error but still disconnects the producer', async () => {
      const { server, untyped, consumer, producer } = setupClose();
      const error = new Error('consumer');
      consumer.disconnect.mockRejectedValueOnce(error);

      await expect(server.close()).rejects.toBe(error);

      expect(producer.disconnect).toHaveBeenCalledOnce();
      expect(untyped.consumer).toBeNull();
      expect(untyped.producer).toBeNull();
    });

    it('rejects with the producer error', async () => {
      const { server, untyped, producer } = setupClose();
      const error = new Error('producer');
      producer.disconnect.mockRejectedValueOnce(error);

      await expect(server.close()).rejects.toBe(error);

      expect(untyped.consumer).toBeNull();
    });

    it('rejects with the consumer error and logs the producer one', async () => {
      const { server, untyped, consumer, producer } = setupClose();
      const consumerError = new Error('consumer');
      const producerError = new Error('producer');
      consumer.disconnect.mockRejectedValueOnce(consumerError);
      producer.disconnect.mockRejectedValueOnce(producerError);
      const loggerError = vi
        .spyOn(untyped.logger, 'error')
        .mockImplementation(() => undefined);

      await expect(server.close()).rejects.toBe(consumerError);

      expect(loggerError).toHaveBeenCalledExactlyOnceWith(producerError);
    });
  });

  describe('start', () => {
    it('connects the consumer, then the producer, binds the events and calls back', async () => {
      const { server, untyped, consumer, producer, kafka } = setup();
      const bindEvents = vi.spyOn(server, 'bindEvents');
      const callback = vi.fn();
      untyped.client = kafka;

      await server.start(callback);

      expect(kafka.consumer).toHaveBeenCalledOnce();
      expect(kafka.producer).toHaveBeenCalledOnce();
      expect(consumer.connect.mock.invocationCallOrder[0]).toBeLessThan(
        producer.connect.mock.invocationCallOrder[0],
      );
      expect(bindEvents).toHaveBeenCalledExactlyOnceWith(consumer);
      expect(callback).toHaveBeenCalledOnce();
    });

    it('passes the consumer group and the producer options', async () => {
      const { server, untyped, kafka } = setup({
        client: { brokers: ['a:9092'] },
        consumer: { groupId: 'custom-group' },
        producer: { allowAutoTopicCreation: false },
      });
      untyped.client = kafka;

      await server.start(vi.fn());

      expect(kafka.consumer.mock.calls[0][0]).toMatchObject({
        groupId: 'custom-group-server',
      });
      expect(kafka.producer.mock.calls[0][0]).toEqual({
        allowAutoTopicCreation: false,
      });
    });
  });

  describe('registerConsumerEventListeners', () => {
    // D1: !this.consumer (guard).
    it('does nothing without a consumer', () => {
      const { server, untyped } = setup();
      const consumer = createConsumerFake();
      untyped.consumer = null;

      server['registerConsumerEventListeners']();

      expect(consumer.on).not.toHaveBeenCalled();
    });

    it('forwards every consumer event to the status stream', () => {
      const { server, untyped, consumer } = setup();
      untyped.consumer = consumer;
      const statuses = collectStatuses(server);

      server['registerConsumerEventListeners']();

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
    // D1: !this.producer (guard).
    it('does nothing without a producer', () => {
      const { server, untyped } = setup();
      const producer = createProducerFake();
      untyped.producer = null;

      server['registerProducerEventListeners']();

      expect(producer.on).not.toHaveBeenCalled();
    });

    it('forwards the producer events to the status stream', () => {
      const { server, untyped, producer } = setup();
      untyped.producer = producer;
      const statuses = collectStatuses(server);

      server['registerProducerEventListeners']();

      expect(producer.on).toHaveBeenCalledTimes(2);
      for (const [, callback] of producer.on.mock.calls) {
        callback();
      }

      expect(statuses).toEqual(['connected', 'disconnected']);
    });
  });

  describe('createClient', () => {
    it('builds a kafkajs client', async () => {
      const server = new ServerKafka({ client: { brokers: ['a:9092'] } });

      const kafka = await server.createClient();

      expect(typeof kafka.consumer).toBe('function');
      expect(typeof kafka.producer).toBe('function');
    });

    it('uses a custom logCreator from the client options', async () => {
      const logCreatorSpy = vi.fn();
      const logCreator = () => logCreatorSpy;
      const server = new ServerKafka({ client: { brokers: [], logCreator } });

      const kafka = await server.createClient();
      kafka.logger().info({ namespace: '', level: 1, log: 'test' });

      expect(logCreatorSpy).toHaveBeenCalled();
    });
  });

  // D1: registeredPatterns.length > 0. D2/D3: subscribe/run options fall back
  // to {} (covered with and without the options).
  describe('bindEvents', () => {
    it('only runs the consumer without registered patterns', async () => {
      const { server, untyped, consumer } = setup();
      untyped.consumer = consumer;

      await server.bindEvents(consumer as any);

      expect(consumer.subscribe).not.toHaveBeenCalled();
      expect(consumer.run).toHaveBeenCalledOnce();
      expect(consumer.run.mock.calls[0][0]).toHaveProperty('eachMessage');
    });

    it('subscribes every registered pattern, regexes included', async () => {
      const { server, untyped, consumer } = setup();
      untyped.consumer = consumer;
      const pattern = /^test\..*/;
      server.addHandler(topic, vi.fn());
      server.addHandler(pattern, vi.fn());

      await server.bindEvents(consumer as any);

      expect(consumer.subscribe).toHaveBeenCalledWith({
        topics: [topic, pattern],
      });
    });

    it('merges the subscribe and run options', async () => {
      const { server, untyped, consumer } = setup({
        subscribe: { fromBeginning: true },
        run: { autoCommit: false },
      });
      untyped.consumer = consumer;
      server.addHandler(topic, vi.fn());

      await server.bindEvents(consumer as any);

      expect(consumer.subscribe).toHaveBeenCalledWith({
        fromBeginning: true,
        topics: [topic],
      });
      expect(consumer.run).toHaveBeenCalledWith({
        autoCommit: false,
        eachMessage: expect.any(Function),
      });
    });
  });

  // D1: super.getHandlerByPattern(pattern). D2: registeredPattern instanceof
  // RegExp. D3: isPatternMatch.
  describe('getHandlerByPattern', () => {
    it('returns the handler of an exactly registered route', () => {
      const { server } = setup();
      const handler = vi.fn();
      server.addHandler(topic, handler);

      expect(server.getHandlerByPattern(topic)).toBe(handler);
    });

    it('returns the handler whose regex matches the route', () => {
      const { server } = setup();
      const handler = vi.fn();
      server.addHandler(/^test\..*/, handler);

      expect(server.getHandlerByPattern(topic)).toBe(handler);
    });

    it('returns null when nothing matches', () => {
      const { server } = setup();
      server.addHandler(/^other\..*/, vi.fn());

      expect(server.getHandlerByPattern(topic)).toBeNull();
    });

    it('resolves a JSON string pattern to its route', () => {
      const { server } = setup();
      const handler = vi.fn();
      server.addHandler({ a: 1 }, handler);

      expect(server.getHandlerByPattern('{"a":1}')).toBe(handler);
    });
  });

  // D1: !topic.endsWith('.reply'). D2: isNil(correlationId).
  // D3: !isNil(replyTopic). D4: super.getHandlerByPattern(topic).
  // D5: the found pattern is a RegExp. D6: the regex matches the stripped topic.
  describe('isOwnReply', () => {
    it('is false for a topic that is not a reply topic', () => {
      const { server } = setup();
      server.addHandler(/^test\..*/, vi.fn(), true);

      expect((server as any).isOwnReply(topic, correlationId, undefined)).toBe(
        false,
      );
    });

    it('is false without a correlation id', () => {
      const { server } = setup();
      server.addHandler(/^test\..*/, vi.fn(), true);

      expect((server as any).isOwnReply(replyTopic, undefined, undefined)).toBe(
        false,
      );
    });

    it('is false when the message carries a reply topic', () => {
      const { server } = setup();
      server.addHandler(/^test\..*/, vi.fn(), true);

      expect(
        (server as any).isOwnReply(replyTopic, correlationId, replyTopic),
      ).toBe(false);
    });

    it('is false when the reply topic has its own handler', () => {
      const { server } = setup();
      server.addHandler(/^test\..*/, vi.fn(), true);
      server.addHandler(replyTopic, vi.fn(), true);

      expect(
        (server as any).isOwnReply(replyTopic, correlationId, undefined),
      ).toBe(false);
    });

    it('is true when a regex matching the reply topic also matches the request topic', () => {
      const { server } = setup();
      server.addHandler(/^test\..+$/, vi.fn(), true);

      expect(
        (server as any).isOwnReply(replyTopic, correlationId, undefined),
      ).toBe(true);
    });

    it('is false when the regex only targets reply topics', () => {
      const { server } = setup();
      server.addHandler(/\.reply$/, vi.fn(), true);

      expect(
        (server as any).isOwnReply(replyTopic, correlationId, undefined),
      ).toBe(false);
    });

    it('is false when no regex is registered at all', () => {
      const { server } = setup();
      server.addHandler('another.topic', vi.fn(), true);

      expect(
        (server as any).isOwnReply(replyTopic, correlationId, undefined),
      ).toBe(false);
    });

    it('resets lastIndex so a global regex can match again', () => {
      const { server } = setup();
      server.addHandler(/^test\..+$/g, vi.fn(), true);

      expect(
        (server as any).isOwnReply(replyTopic, correlationId, undefined),
      ).toBe(true);
      expect(
        (server as any).isOwnReply(replyTopic, correlationId, undefined),
      ).toBe(true);
    });
  });

  describe('getMessageHandler', () => {
    it('returns a function that handles the message', async () => {
      const { server } = setup();
      const handleMessage = vi
        .spyOn(server, 'handleMessage')
        .mockResolvedValue(undefined);
      const payload = eachPayload();

      await server.getMessageHandler()(payload);

      expect(handleMessage).toHaveBeenCalledExactlyOnceWith(payload);
    });
  });

  describe('getPublisher', () => {
    it('returns a function that sends the response', async () => {
      const { server } = setup();
      const context = new KafkaContext([] as any);
      const sendMessage = vi.spyOn(server, 'sendMessage').mockResolvedValue([]);
      const data = { id: correlationId, response: messageValue };

      const publisher = server.getPublisher(
        replyTopic,
        '0',
        correlationId,
        context,
      );
      await publisher(data);

      expect(sendMessage).toHaveBeenCalledExactlyOnceWith(
        data,
        replyTopic,
        '0',
        correlationId,
        context,
      );
    });
  });

  // D1: parser.parse throws. D2: isOwnReply. D3: handler?.isEventHandler.
  // D4: !correlationId. D5: !replyTopic. D6: !isString(replyTopic).
  // D7: the reply topic does not match the topic name regex. D8: !handler.
  describe('handleMessage (routing)', () => {
    it('logs and skips a message the parser rejects', async () => {
      const { server, untyped } = setup();
      untyped.parser = {
        parse: () => {
          throw new MaxPacketLengthExceededException(17);
        },
      };
      const loggerError = vi
        .spyOn(untyped.logger, 'error')
        .mockImplementation(() => undefined);

      await expect(
        server.handleMessage(eachPayload()),
      ).resolves.toBeUndefined();

      expect(loggerError).toHaveBeenCalledOnce();
    });

    it('handles a message without a correlation id as an event', async () => {
      const { server } = setup();
      const handleEvent = vi
        .spyOn(server, 'handleEvent')
        .mockResolvedValue(undefined);

      await server.handleMessage(eachPayload());

      expect(handleEvent).toHaveBeenCalledOnce();
    });

    it('handles a message without a reply topic as an event', async () => {
      const { server } = setup();
      const handleEvent = vi
        .spyOn(server, 'handleEvent')
        .mockResolvedValue(undefined);

      await server.handleMessage(eachPayload(topic, correlationHeaders));

      expect(handleEvent).toHaveBeenCalledOnce();
    });

    it('handles a message of an event handler as an event', async () => {
      const { server } = setup();
      server.addHandler(topic, vi.fn(), true);
      const handleEvent = vi
        .spyOn(server, 'handleEvent')
        .mockResolvedValue(undefined);

      await server.handleMessage(eachPayload(topic, requestHeaders));

      expect(handleEvent).toHaveBeenCalledOnce();
    });

    it('does not handle a message of a message handler as an event', async () => {
      const { server, untyped } = setup();
      server.addHandler(topic, vi.fn(), false);
      untyped.producer = createProducerFake();
      untyped.consumer = createConsumerFake();
      const handleEvent = vi.spyOn(server, 'handleEvent');

      await server.handleMessage(eachPayload(topic, requestHeaders));

      expect(handleEvent).not.toHaveBeenCalled();
    });

    it('skips its own reply matched by a regex', async () => {
      const { server } = setup();
      const handler = vi.fn();
      server.addHandler(/^test\..+$/, handler, true);
      const handleEvent = vi.spyOn(server, 'handleEvent');
      const handleRequest = vi.spyOn(server as any, 'handleRequest');

      await server.handleMessage(eachPayload(replyTopic, correlationHeaders));

      expect(handler).not.toHaveBeenCalled();
      expect(handleEvent).not.toHaveBeenCalled();
      expect(handleRequest).not.toHaveBeenCalled();
    });

    it('still dispatches a reply-topic message written by another producer', async () => {
      const { server } = setup();
      const handler = vi.fn();
      server.addHandler(/\.reply$/, handler, true);

      await server.handleMessage(eachPayload(replyTopic, correlationHeaders));

      expect(handler).toHaveBeenCalledOnce();
    });

    it.each([
      ['an object', '{}'],
      ['an array', '["test.topic.reply"]'],
      ['a schema payload', '\0test.topic.reply'],
      ['a name that is too long', 'a'.repeat(250)],
      ['illegal characters', 'test topic/reply'],
    ])(
      'drops a request whose reply topic is %s',
      async (_label, replyTopicHeader) => {
        const { server, untyped } = setup();
        const handler = vi.fn();
        server.addHandler(topic, handler);
        untyped.producer = createProducerFake();
        untyped.consumer = createConsumerFake();
        const loggerError = vi
          .spyOn(untyped.logger, 'error')
          .mockImplementation(() => undefined);

        await server.handleMessage(
          eachPayload(topic, {
            ...correlationHeaders,
            [KafkaHeaders.REPLY_TOPIC]: Buffer.from(replyTopicHeader),
          }),
        );

        expect(loggerError).toHaveBeenCalledOnce();
        expect(handler).not.toHaveBeenCalled();
        expect(untyped.producer.send).not.toHaveBeenCalled();
      },
    );

    it('drops a request whose reply topic is not a string', async () => {
      const { server, untyped, producer, consumer } = setup();
      const handler = vi.fn();
      server.addHandler(topic, handler);
      untyped.producer = producer;
      untyped.consumer = consumer;
      // A reply topic that is not text cannot reach the parser in practice,
      // but the type check is still a decision of its own.
      untyped.parser = {
        parse: () => ({
          ...kafkaMessage(),
          headers: {
            [KafkaHeaders.CORRELATION_ID]: correlationId,
            [KafkaHeaders.REPLY_TOPIC]: { nested: true },
          },
        }),
      };
      const loggerError = vi
        .spyOn(untyped.logger, 'error')
        .mockImplementation(() => undefined);

      await server.handleMessage(eachPayload(topic, requestHeaders));

      expect(loggerError).toHaveBeenCalledOnce();
      expect(handler).not.toHaveBeenCalled();
      expect(producer.send).not.toHaveBeenCalled();
    });

    it('replies NO_MESSAGE_HANDLER when the pattern has no handler', async () => {
      const { server, untyped, producer, consumer } = setup();
      untyped.producer = producer;
      untyped.consumer = consumer;

      await server.handleMessage(eachPayload(topic, requestHeaders));

      const record = producer.send.mock.calls[0][0];
      expect(record.topic).toBe(replyTopic);
      expect(record.messages[0].value).toBeNull();
      expect(record.messages[0].headers[KafkaHeaders.NEST_ERR].toString()).toBe(
        NO_MESSAGE_HANDLER,
      );
      expect(record.messages[0].headers[KafkaHeaders.CORRELATION_ID]).toEqual(
        Buffer.from(correlationId),
      );
    });

    it('logs NO_EVENT_HANDLER for an event without a handler', async () => {
      const { server, untyped } = setup();
      const loggerError = vi
        .spyOn(untyped.logger, 'error')
        .mockImplementation(() => undefined);

      await server.handleMessage(eachPayload());

      expect(loggerError).toHaveBeenCalledOnce();
      expect(loggerError.mock.calls[0][0]).toContain(
        'There is no matching event handler',
      );
    });
  });

  // D1: handler?.isEventHandler (false here). D2: !correlationId (false).
  // D3: !replyTopic (false). D4: !isString(replyTopic). D5: topic regex.
  // D6: !handler.
  describe('handleMessage (request/response)', () => {
    function setupRequest(handler: (...args: any[]) => any) {
      const context = setup();
      context.untyped.producer = context.producer;
      context.untyped.consumer = context.consumer;
      context.server.addHandler(topic, handler);
      return context;
    }

    it('replies with the value the handler returns', async () => {
      const { server, producer } = setupRequest(async () => 'response');

      await server.handleMessage(eachPayload(topic, requestHeaders));
      await flush();

      expect(producer.send).toHaveBeenCalledOnce();
      const record = producer.send.mock.calls[0][0];
      expect(record.topic).toBe(replyTopic);
      expect(record.messages[0].value).toBe('response');
      expect(record.messages[0].partition).toBe(0);
      expect(record.messages[0].headers[KafkaHeaders.CORRELATION_ID]).toEqual(
        Buffer.from(correlationId),
      );
    });

    it('passes the request data and context to the handler', async () => {
      const handler = vi.fn(async () => 'response');
      const { server } = setupRequest(handler);

      await server.handleMessage(eachPayload(topic, requestHeaders));
      await flush();

      expect(handler).toHaveBeenCalledWith(
        messageValue,
        expect.any(KafkaContext),
      );
    });

    it.each([
      ['absent', undefined],
      ['present', '2'],
    ])(
      'replies without a partition when it is %s',
      async (label, partition) => {
        const { server, producer } = setupRequest(async () => 'response');
        const headers = {
          ...correlationHeaders,
          [KafkaHeaders.REPLY_TOPIC]: Buffer.from(replyTopic),
          ...(partition === undefined
            ? {}
            : { [KafkaHeaders.REPLY_PARTITION]: Buffer.from(partition) }),
        };

        await server.handleMessage(eachPayload(topic, headers));
        await flush();

        const sent = producer.send.mock.calls[0][0].messages[0];
        if (label === 'absent') {
          expect(sent.partition).toBeUndefined();
        } else {
          expect(sent.partition).toBe(2);
        }
      },
    );

    it('replies with every value of a stream', async () => {
      const { server, producer } = setupRequest(async () =>
        of('first', 'second'),
      );

      await server.handleMessage(eachPayload(topic, requestHeaders));
      await flush();

      const values = producer.send.mock.calls.map(
        call => call[0].messages[0].value,
      );
      expect(values).toEqual(['first', 'second']);
      expect(
        producer.send.mock.calls.some(
          call => call[0].messages[0].headers[KafkaHeaders.NEST_IS_DISPOSED],
        ),
      ).toBe(true);
    });

    it('replies null to a stream that completes without emitting', async () => {
      const { server, producer } = setupRequest(async () => EMPTY);

      await server.handleMessage(eachPayload(topic, requestHeaders));
      await flush();

      expect(producer.send).toHaveBeenCalledOnce();
      const reply = producer.send.mock.calls[0][0].messages[0];
      expect(reply.value).toBeNull();
      expect(reply.headers).toHaveProperty(KafkaHeaders.NEST_IS_DISPOSED);
      expect(reply.headers).not.toHaveProperty(KafkaHeaders.NEST_NO_RESPONSE);
    });

    it('replies with the error of a failing handler', async () => {
      const { server, producer } = setupRequest(async () => {
        throw new Error('boom');
      });

      await server.handleMessage(eachPayload(topic, requestHeaders));
      await flush();

      expect(producer.send).toHaveBeenCalledOnce();
      const reply = producer.send.mock.calls[0][0].messages[0];
      expect(reply.value).toBeNull();
      expect(reply.headers[KafkaHeaders.NEST_ERR]).toBeDefined();
    });

    it('rethrows a retriable exception so kafkajs redelivers the message', async () => {
      const { server, producer } = setupRequest(async () => {
        throw new KafkaRetriableException('retry me');
      });

      await expect(
        server.handleMessage(eachPayload(topic, requestHeaders)),
      ).rejects.toThrow(KafkaRetriableException);
      await flush();

      expect(producer.send).not.toHaveBeenCalled();
    });

    it('still replies what was emitted before a retriable exception', async () => {
      const { server, producer } = setupRequest(async () =>
        concat(
          of('first'),
          throwError(() => new KafkaRetriableException('retry me')),
        ),
      );

      // The first value settles the reply, so nothing is rethrown.
      await expect(
        server.handleMessage(eachPayload(topic, requestHeaders)),
      ).resolves.toBeUndefined();
      await flush();

      expect(producer.send).toHaveBeenCalled();
      expect(producer.send.mock.calls[0][0].messages[0].value).toBe('first');
    });
  });

  // D1: !identifier (handler found). D2: isObservable.
  describe('handleEvent', () => {
    const context = () => new KafkaContext([] as any);

    it('logs and returns when there is no event handler', async () => {
      const { server, untyped } = setup();
      const loggerError = vi
        .spyOn(untyped.logger, 'error')
        .mockImplementation(() => undefined);

      await expect(
        server.handleEvent(topic, { pattern: topic, data: null }, context()),
      ).resolves.toBeUndefined();

      expect(loggerError).toHaveBeenCalledOnce();
    });

    it('runs the end hook for a plain value', async () => {
      const { server } = setup();
      const endHook = vi.fn();
      server.setOnProcessingEndHook(endHook);
      server.addHandler(topic, async () => 'plain', true);

      await server.handleEvent(
        topic,
        { pattern: topic, data: null },
        context(),
      );

      expect(endHook).toHaveBeenCalledOnce();
    });

    it('awaits the stream the handler returns', async () => {
      const { server } = setup();
      const endHook = vi.fn();
      server.setOnProcessingEndHook(endHook);
      server.addHandler(topic, async () => of('streamed'), true);

      await server.handleEvent(
        topic,
        { pattern: topic, data: null },
        context(),
      );

      expect(endHook).toHaveBeenCalledOnce();
    });

    it('awaits a stream that completes without emitting', async () => {
      const { server } = setup();
      const endHook = vi.fn();
      server.setOnProcessingEndHook(endHook);
      server.addHandler(topic, async () => EMPTY, true);

      await expect(
        server.handleEvent(topic, { pattern: topic, data: null }, context()),
      ).resolves.toBeUndefined();

      expect(endHook).toHaveBeenCalledOnce();
    });

    it('rejects when the handler throws, running the end hook once', async () => {
      const { server } = setup();
      const endHook = vi.fn();
      server.setOnProcessingEndHook(endHook);
      server.addHandler(
        topic,
        async () => {
          throw new Error('handler failed');
        },
        true,
      );

      await expect(
        server.handleEvent(topic, { pattern: topic, data: null }, context()),
      ).rejects.toThrow('handler failed');

      expect(endHook).toHaveBeenCalledOnce();
    });

    it('rejects when the stream fails', async () => {
      const { server } = setup();
      server.addHandler(
        topic,
        async () => throwError(() => new Error('stream failed')),
        true,
      );

      await expect(
        server.handleEvent(topic, { pattern: topic, data: null }, context()),
      ).rejects.toThrow('stream failed');
    });

    it('rethrows a retriable exception', async () => {
      const { server } = setup();
      server.addHandler(
        topic,
        async () => {
          throw new KafkaRetriableException('retry me');
        },
        true,
      );

      await expect(
        server.handleEvent(topic, { pattern: topic, data: null }, context()),
      ).rejects.toThrow(KafkaRetriableException);
    });
  });

  // D1: headers ?? {}. D2: Buffer + isUtf8 per header.
  describe('readMetadata', () => {
    async function metadataOf(headers?: Record<string, any>) {
      const { server } = setup();
      const handleEvent = vi
        .spyOn(server, 'handleEvent')
        .mockResolvedValue(undefined);
      await server.handleMessage({
        ...eachPayload(topic),
        message: { ...kafkaMessage(), headers },
      });
      const context: KafkaContext = handleEvent.mock.calls[0][2];
      return context.getMetadata();
    }

    it('exposes text headers as they arrived', async () => {
      expect(
        await metadataOf({
          'x-request-id': Buffer.from('trace-1'),
          'x-json': Buffer.from('{"a":1}'),
          plain: 'already a string',
        }),
      ).toEqual({
        'x-request-id': 'trace-1',
        'x-json': '{"a":1}',
        plain: 'already a string',
      });
    });

    it('leaves out repeated, binary and undefined headers', async () => {
      expect(
        await metadataOf({
          'x-request-id': Buffer.from('trace-1'),
          'x-tag': [Buffer.from('a'), Buffer.from('b')],
          'x-binary': Buffer.from([0x00, 0xff, 0xfe]),
          'x-absent': undefined,
        }),
      ).toEqual({ 'x-request-id': 'trace-1' });
    });

    it('is undefined for a message without headers', async () => {
      expect(await metadataOf(undefined)).toBeUndefined();
    });
  });

  // D1: err instanceof KafkaRetriableException.
  describe('shouldAnswerRejectedRequest', () => {
    it.each([
      ['a retriable exception', new KafkaRetriableException('retry'), false],
      ['any other error', new Error('boom'), true],
    ])('answers %s: %s', (_label, error, expected) => {
      const { server } = setup();

      expect((server as any).shouldAnswerRejectedRequest(error)).toBe(expected);
    });
  });

  // D1: isNil(replyPartition) inside assignReplyPartition. D2: err branches
  // of the assigned headers (see the assign* describe blocks).
  describe('sendMessage', () => {
    function setupSend() {
      const context = setup();
      const sendSpy = context.producer.send;
      context.untyped.producer = context.producer;
      return { ...context, sendSpy };
    }

    it('sends the response to the reply topic and partition', async () => {
      const { server, sendSpy } = setupSend();

      await server.sendMessage(
        { id: correlationId, response: messageValue },
        replyTopic,
        '0',
        correlationId,
        new KafkaContext([] as any),
      );

      expect(sendSpy).toHaveBeenCalledWith({
        topic: replyTopic,
        messages: [
          {
            partition: 0,
            value: messageValue,
            headers: {
              [KafkaHeaders.CORRELATION_ID]: Buffer.from(correlationId),
            },
          },
        ],
      });
    });

    it('sends without a partition when it is not given', async () => {
      const { server, sendSpy } = setupSend();

      await server.sendMessage(
        { id: correlationId, response: messageValue },
        replyTopic,
        undefined,
        correlationId,
        new KafkaContext([] as any),
      );

      const sent = sendSpy.mock.calls[0][0].messages[0];
      expect(sent.partition).toBeUndefined();
      expect(sent.value).toBe(messageValue);
    });

    it('sends the error header of a failed request', async () => {
      const { server, sendSpy } = setupSend();

      await server.sendMessage(
        { id: correlationId, err: NO_MESSAGE_HANDLER },
        replyTopic,
        '0',
        correlationId,
        new KafkaContext([] as any),
      );

      const sent = sendSpy.mock.calls[0][0].messages[0];
      expect(sent.value).toBeNull();
      expect(sent.headers[KafkaHeaders.NEST_ERR].toString()).toBe(
        NO_MESSAGE_HANDLER,
      );
    });

    it('marks a completion-only reply with no response', async () => {
      const { server, sendSpy } = setupSend();

      await server.sendMessage(
        { id: correlationId, isDisposed: true },
        replyTopic,
        '0',
        correlationId,
        new KafkaContext([] as any),
      );

      const sent = sendSpy.mock.calls[0][0].messages[0];
      expect(sent.headers).toEqual({
        [KafkaHeaders.CORRELATION_ID]: Buffer.from(correlationId),
        [KafkaHeaders.NEST_IS_DISPOSED]: Buffer.alloc(1),
        [KafkaHeaders.NEST_NO_RESPONSE]: Buffer.alloc(1),
      });
    });

    it('marks a disposed reply that carries a response', async () => {
      const { server, sendSpy } = setupSend();

      await server.sendMessage(
        { id: correlationId, response: undefined, isDisposed: true },
        replyTopic,
        '0',
        correlationId,
        new KafkaContext([] as any),
      );

      const sent = sendSpy.mock.calls[0][0].messages[0];
      expect(sent.headers).toHaveProperty(KafkaHeaders.NEST_IS_DISPOSED);
      expect(sent.headers).not.toHaveProperty(KafkaHeaders.NEST_NO_RESPONSE);
    });
  });

  // D1: !outgoingResponse.isDisposed. D2: 'response' in it. D3: its err.
  describe('assignIsDisposedHeader', () => {
    const outgoing = () => ({ value: null, headers: {} }) as any;

    it('writes nothing when the reply is not disposed', () => {
      const message = outgoing();

      setup().server.assignIsDisposedHeader({ id: '1' }, message);

      expect(message.headers).toEqual({});
    });

    it('marks a disposed reply without a response or an error', () => {
      const message = outgoing();

      setup().server.assignIsDisposedHeader(
        { id: '1', isDisposed: true },
        message,
      );

      expect(message.headers[KafkaHeaders.NEST_IS_DISPOSED]).toEqual(
        Buffer.alloc(1),
      );
      expect(message.headers[KafkaHeaders.NEST_NO_RESPONSE]).toEqual(
        Buffer.alloc(1),
      );
    });

    it('marks a disposed reply that carries a response', () => {
      const message = outgoing();

      setup().server.assignIsDisposedHeader(
        { id: '1', response: 'value', isDisposed: true },
        message,
      );

      expect(message.headers[KafkaHeaders.NEST_IS_DISPOSED]).toBeDefined();
      expect(message.headers[KafkaHeaders.NEST_NO_RESPONSE]).toBeUndefined();
    });

    it('marks a disposed reply that carries an error', () => {
      const message = outgoing();

      setup().server.assignIsDisposedHeader(
        { id: '1', err: 'boom', isDisposed: true },
        message,
      );

      expect(message.headers[KafkaHeaders.NEST_IS_DISPOSED]).toBeDefined();
      expect(message.headers[KafkaHeaders.NEST_NO_RESPONSE]).toBeUndefined();
    });
  });

  // D1: !outgoingResponse.err. D2: typeof err === 'object'.
  describe('assignErrorHeader', () => {
    it.each([
      ['no error', { id: '1' }, undefined],
      ['a string error', { id: '1', err: 'boom' }, 'boom'],
      [
        'an object error',
        { id: '1', err: { status: 'error' } },
        '{"status":"error"}',
      ],
    ])('writes the header for %s', (_label, response, expected) => {
      const message = { value: null, headers: {} } as any;

      setup().server.assignErrorHeader(response as any, message);

      if (expected === undefined) {
        expect(message.headers[KafkaHeaders.NEST_ERR]).toBeUndefined();
      } else {
        expect(message.headers[KafkaHeaders.NEST_ERR].toString()).toBe(
          expected,
        );
      }
    });
  });

  describe('assignCorrelationIdHeader', () => {
    it('writes the correlation id as a buffer', () => {
      const message = { value: null, headers: {} } as any;

      setup().server.assignCorrelationIdHeader(correlationId, message);

      expect(message.headers[KafkaHeaders.CORRELATION_ID]).toEqual(
        Buffer.from(correlationId),
      );
    });
  });

  // D1: isNil(replyPartition).
  describe('assignReplyPartition', () => {
    it.each([
      ['a text partition', '2', 2],
      ['a decimal partition', '1.5', 1.5],
    ])('writes %s as a number', (_label, partition, expected) => {
      const message = { value: null, headers: {} } as any;

      setup().server.assignReplyPartition(partition, message);

      expect(message.partition).toBe(expected);
    });

    it.each([
      ['null', null],
      ['undefined', undefined],
    ])('leaves the partition out for %s', (_label, partition) => {
      const message = { value: null, headers: {} } as any;

      setup().server.assignReplyPartition(partition, message);

      expect(message).not.toHaveProperty('partition');
    });
  });

  // D1: the found pattern is a RegExp. D2: isPatternMatch.
  describe('isPatternMatch', () => {
    it('resets lastIndex before and after a global match', () => {
      const { server } = setup();
      const pattern = /^test\..+$/g;

      expect((server as any).isPatternMatch(pattern, topic)).toBe(true);
      expect(pattern.lastIndex).toBe(0);
      expect((server as any).isPatternMatch(pattern, topic)).toBe(true);
    });

    it('is false when the pattern does not match', () => {
      const { server } = setup();

      expect((server as any).isPatternMatch(/^other\..*/, topic)).toBe(false);
    });
  });

  // D1: !isPromiseResolved on next. D2: err instanceof
  // KafkaRetriableException. D3: !isPromiseResolved on error.
  // D4: !isPromiseResolved on complete.
  describe('combineStreamsAndThrowIfRetriable', () => {
    it('resolves on the first emitted value and replays it', async () => {
      const { server } = setup();
      const replay$ = new ReplaySubject<unknown>();
      const values: unknown[] = [];
      replay$.subscribe(value => values.push(value));

      await (server as any).combineStreamsAndThrowIfRetriable(
        of('first', 'second'),
        replay$,
      );

      expect(values).toEqual(['first', 'second']);
    });

    it('resolves when the stream completes without emitting', async () => {
      const { server } = setup();
      const replay$ = new ReplaySubject<unknown>();

      await expect(
        (server as any).combineStreamsAndThrowIfRetriable(EMPTY, replay$),
      ).resolves.toBeUndefined();
    });

    it('rejects a retriable exception that arrives before any value', async () => {
      const { server } = setup();
      const replay$ = new ReplaySubject<unknown>();

      await expect(
        (server as any).combineStreamsAndThrowIfRetriable(
          throwError(() => new KafkaRetriableException('retry me')),
          replay$,
        ),
      ).rejects.toThrow(KafkaRetriableException);
    });

    it('resolves a retriable exception that arrives after a value', async () => {
      const { server } = setup();
      const replay$ = new ReplaySubject<unknown>();

      await expect(
        (server as any).combineStreamsAndThrowIfRetriable(
          concat(
            of('first'),
            throwError(() => new KafkaRetriableException('retry me')),
          ),
          replay$,
        ),
      ).resolves.toBeUndefined();
    });

    it('resolves a non-retriable error and forwards it on the stream', async () => {
      const { server } = setup();
      const replay$ = new ReplaySubject<unknown>();
      const errors: unknown[] = [];
      replay$.subscribe({ error: err => errors.push(err) });

      await expect(
        (server as any).combineStreamsAndThrowIfRetriable(
          throwError(() => new Error('boom')),
          replay$,
        ),
      ).resolves.toBeUndefined();

      expect(errors).toHaveLength(1);
    });
  });

  // D1: !this.client.
  describe('unwrap', () => {
    it('throws before the client is created', () => {
      const { server } = setup();

      expect(() => server.unwrap()).toThrow(/Not initialized/);
    });

    it('returns the client, the consumer and the producer', () => {
      const { server, untyped, consumer, producer, kafka } = setup();
      untyped.client = kafka;
      untyped.consumer = consumer;
      untyped.producer = producer;

      expect(server.unwrap()).toEqual([kafka, consumer, producer]);
    });
  });

  describe('on', () => {
    it('is not supported', () => {
      const { server } = setup();

      expect(() => server.on('event', () => undefined)).toThrow(
        'Method is not supported for Kafka server',
      );
    });
  });

  describe('propagatesEventHandlerErrors', () => {
    it('is enabled, as handleEvent awaits the stream', () => {
      expect(setup().server.propagatesEventHandlerErrors).toBe(true);
    });
  });
});
