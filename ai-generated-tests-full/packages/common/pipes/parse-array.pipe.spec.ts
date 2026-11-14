import { describe, expect, it } from 'vitest';
import { ParseArrayPipe } from '../../../../packages/common/pipes/parse-array.pipe.js';

const metadata = { type: 'query' } as any;

class Item {
  value?: string;
}

describe('ParseArrayPipe', () => {
  describe('transform', () => {
    it.each([
      ['undefined', undefined],
      ['null', null],
    ])('rejects %s without optional', async (_label, value) => {
      await expect(
        new ParseArrayPipe().transform(value, metadata),
      ).rejects.toThrow('Validation failed (parsable array expected)');
    });

    it.each([
      ['undefined', undefined],
      ['null', null],
    ])('returns %s when optional', async (_label, value) => {
      await expect(
        new ParseArrayPipe({ optional: true }).transform(value, metadata),
      ).resolves.toBe(value);
    });

    it.each([
      ['boolean', true],
      ['object', {}],
    ])('rejects non-string %s values', async (_label, value) => {
      await expect(
        new ParseArrayPipe().transform(value, metadata),
      ).rejects.toThrow('Validation failed (parsable array expected)');
    });

    it('splits strings with the default separator and trims the whole input', async () => {
      await expect(
        new ParseArrayPipe().transform(' a, b ', metadata),
      ).resolves.toEqual(['a', ' b']);
    });

    it('splits strings with a custom separator', async () => {
      await expect(
        new ParseArrayPipe({ separator: ';' }).transform('a;b', metadata),
      ).resolves.toEqual(['a', 'b']);
    });

    it('keeps an array value as is', async () => {
      const value = ['a', 'b'];
      await expect(new ParseArrayPipe().transform(value, metadata)).resolves.toBe(
        value,
      );
    });

    it('validates primitive numbers', async () => {
      await expect(
        new ParseArrayPipe({ items: Number }).transform(['1', '2'], metadata),
      ).resolves.toEqual([1, 2]);
    });

    it('rejects invalid primitive numbers in the default mode', async () => {
      await expect(
        new ParseArrayPipe({ items: Number }).transform(['1', 'x'], metadata),
      ).rejects.toThrow('item must be a number');
    });

    it('collects every error when stopAtFirstError is false', async () => {
      await expect(
        new ParseArrayPipe({ items: Number, stopAtFirstError: false }).transform(
          ['x', 'y'],
          metadata,
        ),
      ).rejects.toBeTruthy();
    });

    it('returns transformed primitive values when stopAtFirstError is false', async () => {
      await expect(
        new ParseArrayPipe({
          items: Boolean,
          stopAtFirstError: false,
        }).transform(['true', 'false'], metadata),
      ).resolves.toEqual([true, false]);
    });

    it('stringifies non-string items for String', async () => {
      await expect(
        new ParseArrayPipe({ items: String }).transform([1, 2], metadata),
      ).resolves.toEqual([1, 2].map(String));
    });

    it('parses JSON items for non-primitive item types', async () => {
      await expect(
        new ParseArrayPipe({ items: Item }).transform(['{"value":"a"}'], metadata),
      ).resolves.toBeInstanceOf(Array);
    });

    it('ignores invalid JSON and still validates the raw item', async () => {
      await expect(
        new ParseArrayPipe({ items: Item }).transform(['{invalid'], metadata),
      ).resolves.toBeInstanceOf(Array);
    });

    it('supports a custom exception factory', async () => {
      await expect(
        new ParseArrayPipe({
          exceptionFactory: e => new Error(`custom:${e}`),
        }).transform(undefined, metadata),
      ).rejects.toThrow('custom:Validation failed (parsable array expected)');
    });
  });

  describe('isNumeric', () => {
    const pipe = new ParseArrayPipe();
    it.each([
      ['finite number', 1, true],
      ['infinite number', Infinity, false],
      ['boolean', true, false],
      ['empty string', '', false],
      ['blank string', '  ', false],
      ['hex', '0x10', false],
      ['binary', '0b10', false],
      ['octal', '0o10', false],
      ['numeric string', '1.5', true],
      ['invalid string', 'x', false],
    ])('returns expected for %s', (_label, value, expected) => {
      expect((pipe as any).isNumeric(value)).toBe(expected);
    });
  });

  describe('isExpectedTypePrimitive', () => {
    it.each([
      ['Number', Number, true],
      ['String', String, true],
      ['Boolean', Boolean, true],
      ['Object', Object, false],
      ['undefined', undefined, false],
    ])('returns expected for %s', (_label, items, expected) => {
      expect(
        (new ParseArrayPipe({ items: items as any }) as any).isExpectedTypePrimitive(),
      ).toBe(expected);
    });
  });
});
