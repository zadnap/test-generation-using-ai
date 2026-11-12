import { describe, expect, it, vi } from 'vitest';
import { KafkaContext } from '../../../../packages/microservices/ctx-host/kafka.context.js';

/**
 * CFG / C3 decisions of KafkaContext:
 * getMessage/getPartition/getTopic/getConsumer/getHeartbeat/getProducer are
 * straight-line getters (no decisions).
 * D1 getMetadata: args[6] present (T) vs absent (F) - the optional tuple slot
 *    is returned as-is, no sub-conditions.
 */
describe('KafkaContext', () => {
  const message = { value: Buffer.from('payload'), headers: { a: 'b' } };
  const consumer = { subscribe: vi.fn() };
  const producer = { send: vi.fn() };
  const heartbeat = vi.fn(async () => undefined);

  const buildArgs = (metadata?: { traceId: string }) =>
    [
      message,
      2,
      'orders.created',
      consumer,
      heartbeat,
      producer,
      metadata,
    ] as any;

  describe('getMessage', () => {
    // No decisions: returns tuple slot 0.
    it('returns the original Kafka message', () => {
      expect(new KafkaContext(buildArgs()).getMessage()).toBe(message);
    });
  });

  describe('getPartition', () => {
    // No decisions: returns tuple slot 1.
    it('returns the partition number', () => {
      expect(new KafkaContext(buildArgs()).getPartition()).toBe(2);
    });
  });

  describe('getTopic', () => {
    // No decisions: returns tuple slot 2.
    it('returns the topic name', () => {
      expect(new KafkaContext(buildArgs()).getTopic()).toBe('orders.created');
    });
  });

  describe('getConsumer', () => {
    // No decisions: returns tuple slot 3.
    it('returns the consumer reference', () => {
      expect(new KafkaContext(buildArgs()).getConsumer()).toBe(consumer);
    });
  });

  describe('getHeartbeat', () => {
    // No decisions: returns tuple slot 4.
    it('returns the heartbeat callback', () => {
      expect(new KafkaContext(buildArgs()).getHeartbeat()).toBe(heartbeat);
    });
  });

  describe('getProducer', () => {
    // No decisions: returns tuple slot 5.
    it('returns the producer reference', () => {
      expect(new KafkaContext(buildArgs()).getProducer()).toBe(producer);
    });
  });

  describe('getMetadata', () => {
    // D1 (args[6] defined): T/F covered. No infeasible path.
    it('D1(T) - returns the packet metadata when the tuple carries it', () => {
      const metadata = { traceId: 'trace-1' };

      expect(new KafkaContext(buildArgs(metadata)).getMetadata()).toBe(
        metadata,
      );
    });

    it('D1(F) - returns undefined when the tuple has no metadata slot', () => {
      expect(new KafkaContext(buildArgs()).getMetadata()).toBeUndefined();
    });
  });
});
