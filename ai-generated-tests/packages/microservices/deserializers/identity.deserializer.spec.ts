import { describe, expect, it } from 'vitest';
import { IdentityDeserializer } from '../../../../packages/microservices/deserializers/identity.deserializer.js';

/**
 * CFG / C3 of IdentityDeserializer.deserialize:
 * no decisions (single straight-line return), therefore C3 = 1.
 * Infeasible: none.
 */
describe('IdentityDeserializer', () => {
  describe('deserialize', () => {
    const deserializer = new IdentityDeserializer();

    it.each([
      ['undefined', undefined],
      ['null', null],
      ['a string', 'value'],
      ['an empty string', ''],
      ['a number', 42],
      ['zero', 0],
      ['a boolean', false],
    ])('returns %s unchanged', (_, value) => {
      expect(deserializer.deserialize(value)).toBe(value);
    });

    it('returns the very same object reference', () => {
      const packet = { pattern: 'greeting', data: { id: 1 } };

      expect(deserializer.deserialize(packet)).toBe(packet);
    });

    it('returns the very same Buffer reference', () => {
      const packet = Buffer.from('raw');

      expect(deserializer.deserialize(packet)).toBe(packet);
    });

    it('ignores the options argument', () => {
      const packet = { pattern: 'greeting' };

      expect(deserializer.deserialize(packet, { channel: 'test' })).toBe(
        packet,
      );
    });
  });
});
