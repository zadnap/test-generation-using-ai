import { describe, expect, it } from 'vitest';
import { IncomingRequestDeserializer } from '../../../../packages/microservices/deserializers/incoming-request.deserializer.js';

/**
 * CFG / C3 decisions of IncomingRequestDeserializer.
 *
 * deserialize:
 * D1: this.isExternal(value)                    (single condition)
 *
 * isExternal:
 * D2: !value                                    (single condition)
 * D3: !isUndefined(value.pattern) || !isUndefined(value.data)
 *     conditions: c1 pattern, c2 data
 *
 * mapToSchema:
 * D4: !options                                  (single condition)
 *
 * Infeasible: none. `{ pattern: undefined, data: undefined }` looks like an
 * envelope but both conditions are false, so D3 takes the true outcome.
 */
describe('IncomingRequestDeserializer', () => {
  const deserializer = new IncomingRequestDeserializer();

  describe('deserialize', () => {
    it('D1 T - an external object is mapped with the channel option', () => {
      const value = { id: 'abc' };

      expect(deserializer.deserialize(value, { channel: 'greeting' })).toEqual({
        pattern: 'greeting',
        data: value,
      });
    });

    it('D1 T - a falsy value is mapped with the channel option', () => {
      expect(deserializer.deserialize(null, { channel: 'greeting' })).toEqual({
        pattern: 'greeting',
        data: null,
      });
    });

    it('D1 T - without options the pattern and data are undefined', () => {
      expect(deserializer.deserialize({ id: 'abc' })).toEqual({
        pattern: undefined,
        data: undefined,
      });
    });

    it('D1 F - an existing envelope is returned by reference', () => {
      const value = { pattern: 'greeting', data: { id: 1 } };

      expect(deserializer.deserialize(value, { channel: 'other' })).toBe(value);
    });
  });

  describe('isExternal', () => {
    it.each([
      ['undefined', undefined],
      ['null', null],
      ['zero', 0],
      ['an empty string', ''],
      ['false', false],
    ])('D2 T - %s is external', (_, value) => {
      expect(deserializer.isExternal(value)).toBe(true);
    });

    it.each([
      ['an empty object', {}],
      ['an object with an unrelated key', { id: 'abc' }],
      [
        'both envelope keys explicitly undefined',
        {
          pattern: undefined,
          data: undefined,
        },
      ],
    ])('D2 F + D3 both false - %s is external', (_, value) => {
      expect(deserializer.isExternal(value)).toBe(true);
    });

    it('D2 F + D3 c1 T - a defined pattern is not external', () => {
      expect(deserializer.isExternal({ pattern: 'greeting' })).toBe(false);
    });

    it('D2 F + D3 c1 F + D3 c2 T - defined data is not external', () => {
      expect(deserializer.isExternal({ data: { id: 1 } })).toBe(false);
    });

    it('D2 F + D3 both true - a full envelope is not external', () => {
      expect(
        deserializer.isExternal({ pattern: 'greeting', data: { id: 1 } }),
      ).toBe(false);
    });
  });

  describe('mapToSchema', () => {
    it('D4 T - undefined options yield an empty envelope', () => {
      expect(deserializer.mapToSchema({ id: 'abc' })).toEqual({
        pattern: undefined,
        data: undefined,
      });
    });

    it('D4 T - null options yield an empty envelope', () => {
      expect(deserializer.mapToSchema({ id: 'abc' }, null as any)).toEqual({
        pattern: undefined,
        data: undefined,
      });
    });

    it('D4 F - options.channel becomes the pattern', () => {
      const value = { id: 'abc' };

      expect(deserializer.mapToSchema(value, { channel: 'greeting' })).toEqual({
        pattern: 'greeting',
        data: value,
      });
    });

    it('D4 F - options without a channel keep the pattern undefined', () => {
      expect(deserializer.mapToSchema('raw', {})).toEqual({
        pattern: undefined,
        data: 'raw',
      });
    });
  });
});
