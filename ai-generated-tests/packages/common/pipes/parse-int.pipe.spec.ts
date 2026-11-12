import { describe, expect, it } from 'vitest';
import { ParseIntPipe } from '../../../../packages/common/pipes/parse-int.pipe.js';
import { HttpStatus } from '../../../../packages/common/enums/http-status.enum.js';
import { ImATeapotException } from '../../../../packages/common/exceptions/im-a-teapot.exception.js';
import type { ArgumentMetadata } from '../../../../packages/common/interfaces/features/pipe-transform.interface.js';

const metadata = {} as ArgumentMetadata;
const hugeIntegerString = '9'.repeat(400);

class ExposedParseIntPipe extends ParseIntPipe {
  callIsNumeric(value: unknown) {
    return this.isNumeric(value);
  }
}

describe('ParseIntPipe (C3)', () => {
  describe('isNumeric', () => {
    it.each([
      ['positive string', '3', true],
      ['negative string', '-3', true],
      ['positive number', 3, true],
      ['negative number', -3, true],
      ['zero', 0, true],
      ['leading zeroes', '007', true],
    ])('accepts %s', (_label, value, expected) => {
      expect(new ExposedParseIntPipe().callIsNumeric(value)).toBe(expected);
    });

    it.each([
      ['boolean', true],
      ['object', {}],
      ['array', [1]],
      ['undefined', undefined],
      ['null', null],
      ['float string', '12.3'],
      ['plus sign', '+12'],
      ['space', ' 12'],
      ['trailing space', '12 '],
      ['empty string', ''],
      ['non numeric', 'abc'],
      ['exponent', '1e3'],
      ['hex', '0xFF'],
      ['Infinity number', Infinity],
      ['NaN number', Number.NaN],
      ['overflowing digit string', hugeIntegerString],
    ])('rejects %s', (_label, value) => {
      expect(new ExposedParseIntPipe().callIsNumeric(value)).toBe(false);
    });
  });

  describe('transform', () => {
    it.each([undefined, null])(
      'returns a nil value when optional is enabled (%s)',
      async value => {
        const pipe = new ParseIntPipe({ optional: true });
        expect(await pipe.transform(value, metadata)).toBe(value);
      },
    );

    it.each([undefined, null])(
      'rejects a nil value when optional is disabled (%s)',
      async value => {
        const pipe = new ParseIntPipe();
        await expect(pipe.transform(value, metadata)).rejects.toBeDefined();
      },
    );

    it.each([
      ['3', 3],
      ['-3', -3],
      ['007', 7],
      [3, 3],
      [-3, -3],
    ])('parses %s', async (value, expected) => {
      const pipe = new ParseIntPipe();
      expect(await pipe.transform(value, metadata)).toBe(expected);
    });

    it.each(['123abc', '0xFF', '1.5', true, {}, []])(
      'rejects %s',
      async value => {
        const pipe = new ParseIntPipe();
        await expect(pipe.transform(value, metadata)).rejects.toBeDefined();
      },
    );

    it('uses a custom exception factory', async () => {
      const pipe = new ParseIntPipe({
        exceptionFactory: () => new ImATeapotException(),
      });
      await expect(pipe.transform('bad', metadata)).rejects.toBeInstanceOf(
        ImATeapotException,
      );
    });

    it('uses the configured status code', async () => {
      const pipe = new ParseIntPipe({
        errorHttpStatusCode: HttpStatus.I_AM_A_TEAPOT,
      });
      await expect(pipe.transform('bad', metadata)).rejects.toMatchObject({
        status: HttpStatus.I_AM_A_TEAPOT,
      });
    });

    it('uses the default factory without options', async () => {
      const pipe = new ParseIntPipe();
      await expect(pipe.transform('bad', metadata)).rejects.toMatchObject({
        status: HttpStatus.BAD_REQUEST,
      });
    });
  });
});
