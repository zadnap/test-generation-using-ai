import { describe, expect, it } from 'vitest';
import { ParseDatePipe } from '../../../../packages/common/pipes/parse-date.pipe.js';
import { HttpStatus } from '../../../../packages/common/enums/http-status.enum.js';
import { ImATeapotException } from '../../../../packages/common/exceptions/im-a-teapot.exception.js';

describe('ParseDatePipe (C3)', () => {
  describe('nil handling', () => {
    it('returns the default factory result when one is provided', () => {
      const defaultValue = new Date('2024-01-01T00:00:00.000Z');
      const pipe = new ParseDatePipe({ default: () => defaultValue });

      expect(pipe.transform(undefined)).toBe(defaultValue);
      expect(pipe.transform(null)).toBe(defaultValue);
    });

    it('prefers the default over optional', () => {
      const defaultValue = new Date('2024-01-01T00:00:00.000Z');
      const pipe = new ParseDatePipe({
        optional: true,
        default: () => defaultValue,
      });

      expect(pipe.transform(undefined)).toBe(defaultValue);
    });

    it.each([undefined, null])(
      'returns nil when optional is enabled (%s)',
      value => {
        const pipe = new ParseDatePipe({ optional: true });
        expect(pipe.transform(value)).toBe(value);
      },
    );

    it.each([undefined, null])(
      'throws when nil and neither default nor optional is enabled (%s)',
      value => {
        const pipe = new ParseDatePipe();
        expect(() => pipe.transform(value)).toThrowError();
      },
    );

    it('throws for an empty string even when a default exists', () => {
      const pipe = new ParseDatePipe({ default: () => new Date() });
      expect(() => pipe.transform('')).toThrowError();
    });
  });

  describe('date conversion', () => {
    it.each([
      ['ISO string', '2024-01-01T00:00:00.000Z'],
      ['epoch number', 0],
      ['positive timestamp', 1700000000000],
      ['Date instance', new Date('2024-01-01T00:00:00.000Z')],
    ])('converts a %s', (_label, value) => {
      const pipe = new ParseDatePipe();
      expect(pipe.transform(value)).toBeInstanceOf(Date);
    });

    it.each([
      ['arbitrary object', {}],
      ['boolean', true],
      ['array', [1]],
      ['invalid string', 'not-a-date'],
      ['NaN', Number.NaN],
    ])('rejects an invalid %s', (_label, value) => {
      const pipe = new ParseDatePipe();
      expect(() => pipe.transform(value)).toThrowError();
    });

    it('uses a custom exception factory', () => {
      const pipe = new ParseDatePipe({
        exceptionFactory: () => new ImATeapotException(),
      });
      expect(() => pipe.transform('bad')).toThrowError(ImATeapotException);
    });

    it('uses the configured status code for the default factory', () => {
      const pipe = new ParseDatePipe({
        errorHttpStatusCode: HttpStatus.I_AM_A_TEAPOT,
      });
      expect(() => pipe.transform('bad')).toThrowError(
        expect.objectContaining({ status: HttpStatus.I_AM_A_TEAPOT }),
      );
    });

    it('uses the default factory when options are omitted', () => {
      const pipe = new ParseDatePipe();
      expect(() => pipe.transform('bad')).toThrowError(
        expect.objectContaining({ status: HttpStatus.BAD_REQUEST }),
      );
    });
  });
});
