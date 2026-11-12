import { describe, expect, it } from 'vitest';
import { KafkaHeaders } from '../../../../packages/microservices/enums/kafka-headers.enum.js';
import { MaxKafkaHeadersExceededException } from '../../../../packages/microservices/errors/max-kafka-headers-exceeded.exception.js';
import { KafkaRequestSerializer } from '../../../../packages/microservices/serializers/kafka-request.serializer.js';

/**
 * CFG / C3 decisions of KafkaRequestSerializer.
 *
 * serialize:
 * D1: isNil(value) || !isObject(value) || (!('key' in value) && !('value' in value))
 *     conditions: c1 isNil, c2 !isObject, c3 !('key' in value), c4 !('value' in value)
 * D2: isObject(record.headers) && !Array.isArray(record.headers)
 *     conditions: c1 isObject, c2 !Array.isArray
 * D3: Array.isArray(headerValue) ? headerValue.length : 1   (per header value)
 * D4: headerValues > MAX_HEADER_VALUES (10_000)              (single condition)
 * D5: !isNil(request.key)                                    (single condition)
 *
 * encode:
 * D6: !isNil(value) && !isString(value) && !Buffer.isBuffer(value)
 *     conditions: c1 !isNil, c2 !isString, c3 !isBuffer
 * D7: isPlainObject(value) || Array.isArray(value) || value.toString == Object.prototype.toString
 *     conditions: c1 isPlainObject, c2 Array.isArray, c3 default toString
 * D8: isUndefined(value)                                     (single condition)
 *
 * Infeasible: none - every single condition and every decision outcome is
 * reachable with a concrete value.
 */
describe('KafkaRequestSerializer', () => {
  const serializer = new KafkaRequestSerializer();

  describe('serialize', () => {
    // ---------------------------------------------------------------- D1
    describe('D1 - wrap anything that is not a Kafka message into { value }', () => {
      it.each([
        ['undefined (c1 T)', undefined, { headers: {}, value: null }],
        ['null (c1 T)', null, { headers: {}, value: null }],
        ['a string (c1 F, c2 T)', 'string', { headers: {}, value: 'string' }],
        ['a number (c1 F, c2 T)', 12345, { headers: {}, value: '12345' }],
        ['a boolean (c1 F, c2 T)', true, { headers: {}, value: 'true' }],
        [
          'a plain object without key/value (c2 F, c3 T, c4 T)',
          { prop: 'value' },
          { headers: {}, value: '{"prop":"value"}' },
        ],
        ['an array (c3 T, c4 T)', [1, 2, 3], { headers: {}, value: '[1,2,3]' }],
        [
          'a Buffer (c3 T, c4 T)',
          Buffer.from('buffer'),
          { headers: {}, value: Buffer.from('buffer') },
        ],
      ])('%s', (_, value, expected) => {
        expect(serializer.serialize(value)).toEqual(expected);
      });

      it('D1 c3 T c4 F - an object that only has a value is a Kafka message', () => {
        expect(serializer.serialize({ value: 'string' })).toEqual({
          headers: {},
          value: 'string',
        });
      });

      it('D1 c3 F (c4 not evaluated) - an object that has a key is a Kafka message', () => {
        expect(serializer.serialize({ key: '1' })).toEqual({
          headers: {},
          key: '1',
          value: null,
        });
      });
    });

    // ---------------------------------------------------------------- D2
    describe('D2 - headers must be a non-array object', () => {
      it.each([
        ['a string', 'AAAA'],
        ['a number', 1234],
        ['an array', ['A', 'A']],
        ['null', null],
        ['undefined', undefined],
      ])('D2 - %s headers are dropped', (_, headers) => {
        expect(serializer.serialize({ value: 'x', headers })).toEqual({
          value: 'x',
          headers: {},
        });
      });

      it('D2 c1 T c2 T - plain object headers are kept and copied', () => {
        const headers = { [KafkaHeaders.CORRELATION_ID]: '1234' };

        const result = serializer.serialize({ value: 'x', headers });

        expect(result.headers).toEqual(headers);
        expect(result.headers).not.toBe(headers);
      });

      it('D2 c1 T c2 T - class instance headers are copied', () => {
        class Headers {
          tenant = 'custom';
        }

        expect(
          serializer.serialize({ value: 'x', headers: new Headers() }),
        ).toEqual({ value: 'x', headers: { tenant: 'custom' } });
      });
    });

    // ---------------------------------------------------------------- D3
    describe('D3 - header values are counted per element for arrays', () => {
      it('D3 T - an array header value counts one per item', () => {
        const headers = { repeated: ['a', 'b', 'c'], single: 'x' };

        // 3 + 1 = 4 header values, below the limit
        expect(serializer.serialize({ value: 'x', headers }).headers).toEqual(
          headers,
        );
      });

      it('D3 F - a scalar header value counts as one', () => {
        const headers = { a: '1', b: '2' };

        expect(serializer.serialize({ value: 'x', headers }).headers).toEqual(
          headers,
        );
      });
    });

    // ---------------------------------------------------------------- D4
    describe('D4 - header value limit of 10 000', () => {
      it('D4 F - exactly 10 000 header values are accepted', () => {
        const headers = { repeated: new Array(10_000).fill('') };

        const result = serializer.serialize({ value: 'x', headers });

        expect(result.headers).toEqual(headers);
      });

      it('D4 T - one header with a 10 001-item array throws', () => {
        expect(() =>
          serializer.serialize({
            value: 'x',
            headers: { repeated: new Array(10_001).fill('') },
          }),
        ).toThrow(MaxKafkaHeadersExceededException);
      });

      it('D4 T - 10 000 array values plus one scalar throws with the counts', () => {
        expect(() =>
          serializer.serialize({
            value: 'x',
            headers: { repeated: new Array(10_000).fill(''), single: '' },
          }),
        ).toThrow(/10001 header values.*maximum allowed 10000/);
      });
    });

    // ---------------------------------------------------------------- D5
    describe('D5 - a nil key is not encoded', () => {
      it.each([
        ['a string key (D5 T)', { key: '1', value: 'v' }, '1'],
        ['a number key (D5 T)', { key: 1, value: 'v' }, '1'],
        ['an object key (D5 T)', { key: { id: 1 }, value: 'v' }, '{"id":1}'],
      ])('encodes %s', (_, record, expectedKey) => {
        expect(serializer.serialize(record)).toEqual({
          headers: {},
          key: expectedKey,
          value: 'v',
        });
      });

      it('D5 T - a Buffer key stays a Buffer', () => {
        const key = Buffer.from('key');

        expect(serializer.serialize({ key, value: 'v' }).key).toEqual(key);
      });

      it('D5 F - a null key is left as null', () => {
        expect(serializer.serialize({ key: null, value: 'v' })).toEqual({
          headers: {},
          key: null,
          value: 'v',
        });
      });

      it('D5 F - an absent key stays absent', () => {
        const result = serializer.serialize({ value: 'v' });

        expect(result).toEqual({ headers: {}, value: 'v' });
        expect(result).not.toHaveProperty('key');
      });
    });

    it('does not mutate the caller record or its headers', () => {
      const record = {
        key: '1',
        value: { price: 100 },
        headers: { tenant: 'custom' },
      };
      const headers = record.headers;

      const result = serializer.serialize(record);

      expect(result).not.toBe(record);
      expect(result.headers).not.toBe(headers);
      expect(record).toEqual({
        key: '1',
        value: { price: 100 },
        headers: { tenant: 'custom' },
      });
    });
  });

  describe('encode', () => {
    class WithCustomToString {
      public toString(): string {
        return 'custom';
      }
    }

    class WithoutToString {
      private readonly name = 'plain';
    }

    class ChildWithCustomToString extends WithCustomToString {}

    // ---------------------------------------------------------------- D6/D7
    describe('D6 T + D7 - non string/Buffer objects are stringified', () => {
      it.each([
        ['a plain object (D7 c1 T)', { a: 1 }, '{"a":1}'],
        ['a nested plain object (D7 c1 T)', { a: { b: 2 } }, '{"a":{"b":2}}'],
        ['an array (D7 c2 T)', [1, 2], '[1,2]'],
        [
          'a class without its own toString (D7 c3 T)',
          new WithoutToString(),
          '{"name":"plain"}',
        ],
        [
          'a class with a custom toString (D7 c3 F)',
          new WithCustomToString(),
          'custom',
        ],
        [
          'a subclass inheriting a custom toString (D7 c3 F)',
          new ChildWithCustomToString(),
          'custom',
        ],
      ])('%s', (_, value, expected) => {
        expect(serializer.encode(value)).toBe(expected);
      });
    });

    // ---------------------------------------------------------------- D6
    describe('D6 c3 F - a Buffer is returned untouched', () => {
      it('returns the same Buffer instance', () => {
        const buffer = Buffer.from('buffer');

        const result = serializer.encode(buffer);

        expect(result).toBe(buffer);
        expect(Buffer.isBuffer(result)).toBe(true);
      });
    });

    describe('D6 c2 F - a string is returned untouched', () => {
      it.each(['string', ''])('returns %j untouched', value => {
        expect(serializer.encode(value)).toBe(value);
      });
    });

    describe('D6 c1 F - nil values skip the object branch', () => {
      it('D6 c1 F then D8 F - null is returned as null', () => {
        expect(serializer.encode(null)).toBeNull();
      });

      it('D6 c1 F then D8 T - undefined is returned as null', () => {
        expect(serializer.encode(undefined)).toBeNull();
      });
    });

    // ---------------------------------------------------------------- scalars
    describe('D6 all T, D7 all F - scalars fall back to toString()', () => {
      it.each([
        ['a number', 12345, '12345'],
        ['zero', 0, '0'],
        ['true', true, 'true'],
        ['false', false, 'false'],
      ])('%s is stringified', (_, value, expected) => {
        expect(serializer.encode(value)).toBe(expected);
      });
    });
  });
});
