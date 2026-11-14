import { describe, expect, it } from 'vitest';
import { ParseEnumPipe } from '../../../../packages/common/pipes/parse-enum.pipe.js';

const metadata = { type: 'query' } as any;

enum StringEnum {
  A = 'a',
  B = 'b',
}

enum NumericEnum {
  Zero = 0,
  One = 1,
}

describe('ParseEnumPipe', () => {
  it('requires an enum type', () => {
    expect(() => new ParseEnumPipe(undefined as any)).toThrow(
      '"ParseEnumPipe" requires "enumType" argument specified (to validate input values).',
    );
  });

  describe('transform', () => {
    it.each([
      ['undefined', undefined],
      ['null', null],
    ])('returns %s when optional', async (_label, value) => {
      await expect(
        new ParseEnumPipe(StringEnum, { optional: true }).transform(
          value,
          metadata,
        ),
      ).resolves.toBe(value);
    });

    it.each([
      ['string member', StringEnum, 'a', 'a'],
      ['numeric member as number', NumericEnum, 1, 1],
      ['numeric member as string', NumericEnum, '1', 1],
    ])('accepts %s', async (_label, enumType, value, expected) => {
      await expect(
        new ParseEnumPipe(enumType).transform(value, metadata),
      ).resolves.toBe(expected);
    });

    it.each([
      ['unknown string', StringEnum, 'c'],
      ['null without optional', StringEnum, null],
    ])('rejects %s', async (_label, enumType, value) => {
      await expect(
        new ParseEnumPipe(enumType).transform(value, metadata),
      ).rejects.toBeInstanceOf(Error);
    });

    it('caches the computed enum values across calls', async () => {
      const pipe = new ParseEnumPipe(StringEnum);
      const first = (pipe as any).getEnumValues();
      const second = (pipe as any).getEnumValues();
      expect(second).toBe(first);
      expect(first).toEqual(['a', 'b']);
    });

    it('filters numeric reverse mappings from the enum values', () => {
      const pipe = new ParseEnumPipe(NumericEnum);
      expect((pipe as any).getEnumValues()).toEqual([0, 1]);
    });

    it('supports a custom exception factory', async () => {
      await expect(
        new ParseEnumPipe(StringEnum, {
          exceptionFactory: e => new Error(`custom:${e}`),
        }).transform('c', metadata),
      ).rejects.toThrow('custom:Validation failed (enum string is expected)');
    });
  });
});
