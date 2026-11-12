import { describe, expect, it } from 'vitest';
import { IdentitySerializer } from '../../../../packages/microservices/serializers/identity.serializer.js';

/**
 * CFG / C3 of IdentitySerializer.serialize:
 * There is no decision in this function (a single straight-line return),
 * therefore C3 = 1 and one path covers every atomic condition (there is none).
 * Infeasible: none.
 */
describe('IdentitySerializer', () => {
  describe('serialize', () => {
    const serializer = new IdentitySerializer();

    it.each([
      ['undefined', undefined],
      ['null', null],
      ['a string', 'value'],
      ['an empty string', ''],
      ['a number', 42],
      ['zero', 0],
      ['a boolean', false],
    ])('returns %s unchanged', (_, value) => {
      // toBe (identity, not equality) proves nothing is copied or encoded
      expect(serializer.serialize(value)).toBe(value);
    });

    it('returns the very same object reference', () => {
      const packet = { pattern: 'greeting', data: { id: 1 } };

      expect(serializer.serialize(packet)).toBe(packet);
    });

    it('returns the very same array reference', () => {
      const packet = [1, 2, 3];

      expect(serializer.serialize(packet)).toBe(packet);
    });

    it('returns the very same Buffer reference', () => {
      const packet = Buffer.from('raw');

      expect(serializer.serialize(packet)).toBe(packet);
    });
  });
});
