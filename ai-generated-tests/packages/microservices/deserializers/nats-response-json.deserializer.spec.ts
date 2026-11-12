import { describe, expect, it, vi } from 'vitest';
import { NatsResponseJSONDeserializer } from '../../../../packages/microservices/deserializers/nats-response-json.deserializer.js';

/**
 * CFG / C3 decisions of NatsResponseJSONDeserializer.deserialize:
 * There is no decision in this override itself: it calls value.json() and then
 * delegates to the real IncomingResponseDeserializer.deserialize (no mocking).
 * The delegated decisions are:
 * D1: isExternal(decoded)                                  -> both outcomes
 *     (non-object, empty object, extra key / envelope-only object)
 * D2: value && value.id (inside mapToSchema)               -> both outcomes
 * Infeasible: none.
 */
describe('NatsResponseJSONDeserializer', () => {
  const deserializer = new NatsResponseJSONDeserializer();

  describe('deserialize', () => {
    it('D1 T - a decoded foreign object is wrapped as the response', () => {
      const decoded = { result: 1 };
      const message = { json: vi.fn(() => decoded) };

      const result = deserializer.deserialize(message);

      expect(result).toEqual({
        id: undefined,
        response: decoded,
        isDisposed: true,
      });
      expect(message.json).toHaveBeenCalledTimes(1);
    });

    it('D1 F - a decoded envelope is returned by reference', () => {
      const decoded = { id: '1', response: 'ok', isDisposed: false };
      const message = { json: vi.fn(() => decoded) };

      expect(deserializer.deserialize(message)).toBe(decoded);
      expect(message.json).toHaveBeenCalledTimes(1);
    });

    it('D1 T + D2 T - a decoded object with an id keeps it', () => {
      const decoded = { id: 'abc', extra: true };
      const message = { json: vi.fn(() => decoded) };

      const result = deserializer.deserialize(message, { channel: 'ignored' });

      expect(result.id).toBe('abc');
      expect(result.response).toBe(decoded);
      expect(result.isDisposed).toBe(true);
    });

    it('D1 T - a decoded primitive is wrapped as the response', () => {
      const message = { json: vi.fn(() => 'plain') };

      expect(deserializer.deserialize(message)).toEqual({
        id: undefined,
        response: 'plain',
        isDisposed: true,
      });
    });
  });
});
