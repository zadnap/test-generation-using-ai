import { describe, expect, it, vi } from 'vitest';
import { NatsRequestJSONDeserializer } from '../../../../packages/microservices/deserializers/nats-request-json.deserializer.js';

/**
 * CFG / C3 decisions of NatsRequestJSONDeserializer.deserialize:
 * There is no decision in this override itself: it calls value.json() and then
 * delegates to the real IncomingRequestDeserializer.deserialize (no mocking).
 * The delegated decisions are:
 * D1: isExternal(decoded)                    -> both outcomes below
 * D2: !options (inside mapToSchema)          -> both outcomes below
 * Infeasible: none.
 */
describe('NatsRequestJSONDeserializer', () => {
  const deserializer = new NatsRequestJSONDeserializer();

  describe('deserialize', () => {
    it('D1 F - a decoded envelope is returned by reference', () => {
      const decoded = { pattern: 'greeting', data: { id: 1 } };
      const message = { json: vi.fn(() => decoded) };

      const result = deserializer.deserialize(message, { channel: 'other' });

      expect(result).toBe(decoded);
      expect(message.json).toHaveBeenCalledTimes(1);
    });

    it('D1 T - a decoded foreign payload is mapped with the channel option', () => {
      const decoded = { id: 'abc' };
      const message = { json: vi.fn(() => decoded) };

      expect(deserializer.deserialize(message, { channel: 'nats' })).toEqual({
        pattern: 'nats',
        data: decoded,
      });
      expect(message.json).toHaveBeenCalledTimes(1);
    });

    it('D1 T - a decoded null payload is mapped with the channel option', () => {
      const message = { json: vi.fn(() => null) };

      expect(deserializer.deserialize(message, { channel: 'nats' })).toEqual({
        pattern: 'nats',
        data: null,
      });
    });

    it('D2 T - without options the decoded payload is dropped', () => {
      const message = { json: vi.fn(() => ({ id: 'abc' })) };

      expect(deserializer.deserialize(message)).toEqual({
        pattern: undefined,
        data: undefined,
      });
    });
  });
});
