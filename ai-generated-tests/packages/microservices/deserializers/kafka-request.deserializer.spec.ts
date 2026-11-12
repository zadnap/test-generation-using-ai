import { describe, expect, it } from 'vitest';
import { KafkaRequestDeserializer } from '../../../../packages/microservices/deserializers/kafka-request.deserializer.js';

/**
 * CFG / C3 decisions of KafkaRequestDeserializer.mapToSchema:
 * D1: !options                                 (single condition)
 * D2: data?.value !== undefined                (single condition; the optional
 *     chaining short-circuits for a nil data, which makes D2 false)
 *
 * deserialize/isExternal are inherited from IncomingRequestDeserializer and
 * are exercised once to prove the override is dispatched.
 * Infeasible: none.
 */
describe('KafkaRequestDeserializer', () => {
  const deserializer = new KafkaRequestDeserializer();

  describe('mapToSchema', () => {
    it('D1 T - undefined options yield an empty envelope', () => {
      expect(deserializer.mapToSchema({ value: 'payload' } as any)).toEqual({
        pattern: undefined,
        data: undefined,
      });
    });

    it('D1 T - null options yield an empty envelope', () => {
      expect(
        deserializer.mapToSchema({ value: 'payload' } as any, null as any),
      ).toEqual({ pattern: undefined, data: undefined });
    });

    it('D1 F + D2 T - data.value is unwrapped', () => {
      expect(
        deserializer.mapToSchema({ value: 'payload' } as any, {
          channel: 'greeting',
        }),
      ).toEqual({ pattern: 'greeting', data: 'payload' });
    });

    it.each([
      ['an object value', { a: 1 }],
      ['zero', 0],
      ['null', null],
      ['an empty string', ''],
      ['false', false],
    ])('D1 F + D2 T - a defined %s is unwrapped', (_, value) => {
      expect(
        deserializer.mapToSchema({ value } as any, { channel: 'greeting' }),
      ).toEqual({ pattern: 'greeting', data: value });
    });

    it('D1 F + D2 F - an explicit undefined value falls back to the record', () => {
      const record = { value: undefined, headers: {} };

      expect(
        deserializer.mapToSchema(record as any, { channel: 'greeting' }),
      ).toEqual({ pattern: 'greeting', data: record });
    });

    it('D1 F + D2 F - a record without a value key falls back to the record', () => {
      const record = { key: 'k', headers: {} };

      expect(
        deserializer.mapToSchema(record as any, { channel: 'greeting' }),
      ).toEqual({ pattern: 'greeting', data: record });
    });

    it.each([
      ['undefined', undefined],
      ['null', null],
    ])('D1 F + D2 F - a %s record is returned as the data', (_, data) => {
      expect(deserializer.mapToSchema(data as any, { channel: 'x' })).toEqual({
        pattern: 'x',
        data,
      });
    });
  });

  describe('deserialize (inherited dispatch)', () => {
    it('maps an external record through the overridden mapToSchema', () => {
      expect(
        deserializer.deserialize({ value: 'payload' }, { channel: 'greeting' }),
      ).toEqual({ pattern: 'greeting', data: 'payload' });
    });

    it('returns an existing envelope by reference', () => {
      const envelope = { pattern: 'greeting', data: { id: 1 } };

      expect(deserializer.deserialize(envelope, { channel: 'other' })).toBe(
        envelope,
      );
    });
  });
});
