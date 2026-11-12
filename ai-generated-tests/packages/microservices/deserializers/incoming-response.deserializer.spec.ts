import { describe, expect, it } from 'vitest';
import { IncomingResponseDeserializer } from '../../../../packages/microservices/deserializers/incoming-response.deserializer.js';

/**
 * CFG / C3 decisions of IncomingResponseDeserializer.
 *
 * deserialize:
 * D1: this.isExternal(value)                                 (single condition)
 *
 * isExternal:
 * D2: !value || typeof value !== 'object'                    c1 !value, c2 type
 * D3: keys.length === 0                                      (single condition)
 * D4: keys.some(key => !ENVELOPE_KEYS.has(key))              (single condition,
 *     true as soon as one key is outside id/err/response/isDisposed/status)
 *
 * mapToSchema:
 * D5: value && value.id                                      c1 value, c2 value.id
 *
 * Infeasible: none.
 */
describe('IncomingResponseDeserializer', () => {
  const deserializer = new IncomingResponseDeserializer();

  describe('deserialize', () => {
    it('D1 T - a non-object value is wrapped as the response', () => {
      expect(deserializer.deserialize('plain')).toEqual({
        id: undefined,
        response: 'plain',
        isDisposed: true,
      });
    });

    it('D1 T - a foreign object with an extra key is wrapped', () => {
      const value = { response: 'ok', extra: true };

      expect(deserializer.deserialize(value)).toEqual({
        id: undefined,
        response: value,
        isDisposed: true,
      });
    });

    it('D1 F - a Nest envelope is returned by reference', () => {
      const value = { id: '1', response: 'ok', isDisposed: false };

      expect(deserializer.deserialize(value)).toBe(value);
    });
  });

  describe('isExternal', () => {
    it.each([
      ['undefined (D2 c1 T)', undefined],
      ['null (D2 c1 T)', null],
      ['zero (D2 c1 T)', 0],
      ['an empty string (D2 c1 T)', ''],
      ['a string (D2 c2 T)', 'plain'],
      ['a number (D2 c2 T)', 42],
      ['a boolean (D2 c2 T)', true],
    ])('D2 - %s is external', (_, value) => {
      expect(deserializer.isExternal(value)).toBe(true);
    });

    it('D2 F + D3 T - an object without keys is external', () => {
      expect(deserializer.isExternal({})).toBe(true);
    });

    it.each([
      ['id and response', { id: '1', response: 'ok' }],
      ['err', { err: 'boom' }],
      ['status', { status: 'NO_HANDLER' }],
      ['isDisposed', { isDisposed: true }],
      ['all envelope keys', { id: '1', response: 'ok', isDisposed: true }],
    ])(
      'D2 F + D3 F + D4 F - an object with %s keys is not external',
      (_, value) => {
        expect(deserializer.isExternal(value)).toBe(false);
      },
    );

    it('D2 F + D3 F + D4 T - one extra key makes the object external', () => {
      expect(deserializer.isExternal({ id: '1', extra: true })).toBe(true);
    });
  });

  describe('mapToSchema', () => {
    it('D5 c1 T c2 T - keeps the id', () => {
      const value = { id: 'abc', response: 'ok' };

      expect(deserializer.mapToSchema(value)).toEqual({
        id: 'abc',
        response: value,
        isDisposed: true,
      });
    });

    it('D5 c1 T c2 F - an object without id gets an undefined id', () => {
      const value = { response: 'ok' };

      const result = deserializer.mapToSchema(value);

      expect(result.id).toBeUndefined();
      expect(result.response).toBe(value);
      expect(result.isDisposed).toBe(true);
    });

    it.each([
      ['null', null, null],
      ['undefined', undefined, undefined],
      ['zero', 0, 0],
      ['an empty string', '', ''],
    ])('D5 c1 F - %s is returned as the id itself', (_, value, expectedId) => {
      const result = deserializer.mapToSchema(value);

      expect(result.id).toBe(expectedId);
      expect(result.response).toBe(value);
      expect(result.isDisposed).toBe(true);
    });
  });
});
