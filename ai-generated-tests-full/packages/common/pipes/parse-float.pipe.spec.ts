import { describe, expect, it } from 'vitest';
import { ParseFloatPipe } from '../../../../packages/common/pipes/parse-float.pipe.js';

const metadata = { type: 'query' } as any;

describe('ParseFloatPipe', () => {
  const pipe = new ParseFloatPipe();

  describe('isNumeric', () => {
    it.each([
      ['finite number', 1.5, true],
      ['infinite number', Infinity, false],
      ['NaN', Number.NaN, false],
      ['boolean', true, false],
      ['empty string', '', false],
      ['untrimmed string', ' 1.5', false],
      ['hex prefix', '0x10', false],
      ['upper hex prefix', '0X10', false],
      ['binary prefix', '0b10', false],
      ['upper binary prefix', '0B10', false],
      ['octal prefix', '0o10', false],
      ['upper octal prefix', '0O10', false],
      ['numeric string', '1.5', true],
      ['invalid string', 'x', false],
    ])('returns expected for %s', (_label, value, expected) => {
      expect((pipe as any).isNumeric(value)).toBe(expected);
    });
  });

  describe('transform', () => {
    it.each([
      ['undefined', undefined],
      ['null', null],
    ])('returns %s when optional', async (_label, value) => {
      await expect(
        new ParseFloatPipe({ optional: true }).transform(value, metadata),
      ).resolves.toBe(value);
    });

    it.each([
      ['string', '1.25', 1.25],
      ['number', 2.5, 2.5],
    ])('parses %s', async (_label, value, expected) => {
      await expect(pipe.transform(value, metadata)).resolves.toBe(expected);
    });

    it.each([
      ['invalid string', 'x'],
      ['null without optional', null],
    ])('rejects %s', async (_label, value) => {
      await expect(pipe.transform(value, metadata)).rejects.toBeInstanceOf(
        Error,
      );
    });

    it('supports a custom exception factory', async () => {
      await expect(
        new ParseFloatPipe({ exceptionFactory: e => new Error(e) }).transform(
          'x',
          metadata,
        ),
      ).rejects.toThrow('Validation failed (numeric string is expected)');
    });
  });
});
