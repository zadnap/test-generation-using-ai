import { describe, expect, it } from 'vitest';
import { ParseBoolPipe } from '../../../../packages/common/pipes/parse-bool.pipe.js';
import { HttpStatus } from '../../../../packages/common/enums/http-status.enum.js';
import { ImATeapotException } from '../../../../packages/common/exceptions/im-a-teapot.exception.js';
import type { ArgumentMetadata } from '../../../../packages/common/interfaces/features/pipe-transform.interface.js';

const metadata = {} as ArgumentMetadata;

class ExposedParseBoolPipe extends ParseBoolPipe {
  callIsTrue(value: unknown) {
    return this.isTrue(value);
  }
  callIsFalse(value: unknown) {
    return this.isFalse(value);
  }
}

describe('ParseBoolPipe (C3)', () => {
  describe('transform', () => {
    it.each([
      [undefined, true],
      [null, true],
    ])(
      'returns a nil value when optional is enabled (%s)',
      async (value, optional) => {
        const pipe = new ParseBoolPipe({ optional });
        expect(await pipe.transform(value, metadata)).toBe(value);
      },
    );

    it.each([
      [true, true],
      ['true', true],
      [false, false],
      ['false', false],
    ])('accepts %s', async (value, expected) => {
      const pipe = new ParseBoolPipe();
      expect(await pipe.transform(value, metadata)).toBe(expected);
    });

    it.each([undefined, null, 'TRUE', 'FALSE', 0, 1, {}, []])(
      'rejects %s when optional is disabled',
      async value => {
        const pipe = new ParseBoolPipe();
        await expect(pipe.transform(value, metadata)).rejects.toBeDefined();
      },
    );

    it('uses a custom exception factory', async () => {
      const pipe = new ParseBoolPipe({
        exceptionFactory: () => new ImATeapotException(),
      });
      await expect(pipe.transform('nope', metadata)).rejects.toBeInstanceOf(
        ImATeapotException,
      );
    });

    it('uses the configured HTTP status code for the default factory', async () => {
      const pipe = new ParseBoolPipe({
        errorHttpStatusCode: HttpStatus.I_AM_A_TEAPOT,
      });
      await expect(pipe.transform('nope', metadata)).rejects.toMatchObject({
        status: HttpStatus.I_AM_A_TEAPOT,
      });
    });

    it('uses the default factory when options are omitted', async () => {
      const pipe = new ParseBoolPipe();
      await expect(pipe.transform('nope', metadata)).rejects.toMatchObject({
        status: HttpStatus.BAD_REQUEST,
      });
    });
  });

  describe('isTrue / isFalse condition coverage', () => {
    it.each([
      [true, true],
      ['true', true],
      [false, false],
      ['false', false],
      [1, false],
      ['', false],
    ])('isTrue(%s)', (value, expected) => {
      const pipe = new ExposedParseBoolPipe();
      expect(pipe.callIsTrue(value)).toBe(expected);
    });

    it.each([
      [false, true],
      ['false', true],
      [true, false],
      ['true', false],
      [0, false],
      ['', false],
    ])('isFalse(%s)', (value, expected) => {
      const pipe = new ExposedParseBoolPipe();
      expect(pipe.callIsFalse(value)).toBe(expected);
    });
  });
});
