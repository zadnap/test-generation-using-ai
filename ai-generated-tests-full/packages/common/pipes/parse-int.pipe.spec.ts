import { describe, expect, it } from 'vitest';
import { ParseIntPipe } from '../../../../packages/common/pipes/parse-int.pipe.js';

const metadata = { type: 'query' } as any;

describe('ParseIntPipe', () => {
  const pipe = new ParseIntPipe();

  describe('isNumeric', () => {
    it.each([
      ['integer string', '10', true],
      ['negative string', '-10', true],
      ['numeric value', 10, true],
      ['decimal string', '1.5', false],
      ['infinite number', Infinity, false],
      ['boolean', true, false],
      ['object', {}, false],
      ['null', null, false],
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
        new ParseIntPipe({ optional: true }).transform(value, metadata),
      ).resolves.toBe(value);
    });

    it.each([
      ['string', '10', 10],
      ['negative string', '-3', -3],
      ['number', 4, 4],
    ])('parses %s', async (_label, value, expected) => {
      await expect(pipe.transform(value, metadata)).resolves.toBe(expected);
    });

    it.each([
      ['decimal', '1.5'],
      ['null without optional', null],
    ])('rejects %s', async (_label, value) => {
      await expect(pipe.transform(value, metadata)).rejects.toBeInstanceOf(
        Error,
      );
    });

    it('supports a custom exception factory', async () => {
      await expect(
        new ParseIntPipe({ exceptionFactory: e => new Error(e) }).transform(
          'x',
          metadata,
        ),
      ).rejects.toThrow('Validation failed (numeric string is expected)');
    });
  });
});
