import { describe, expect, it } from 'vitest';
import { ParseFloatPipe } from '../../../../packages/common/pipes/parse-float.pipe.js';
import { HttpStatus } from '../../../../packages/common/enums/http-status.enum.js';
import { ImATeapotException } from '../../../../packages/common/exceptions/im-a-teapot.exception.js';
import type { ArgumentMetadata } from '../../../../packages/common/interfaces/features/pipe-transform.interface.js';

const metadata = {} as ArgumentMetadata;

class ExposedParseFloatPipe extends ParseFloatPipe {
  callIsNumeric(value: unknown) {
    return this.isNumeric(value);
  }
}

describe('ParseFloatPipe (C3)', () => {
  describe('isNumeric', () => {
    it.each([
      [0, true],
      [1.5, true],
      [-1.5, true],
      [Number.MIN_SAFE_INTEGER, true],
      ['1.5', true],
      ['-1.5', true],
      ['1e3', true],
      ['.5', true],
    ])('accepts %s', (value, expected) => {
      expect(new ExposedParseFloatPipe().callIsNumeric(value)).toBe(expected);
    });

    it.each([
      ['NaN number', Number.NaN],
      ['Infinity number', Infinity],
      ['negative Infinity number', -Infinity],
      ['undefined', undefined],
      ['null', null],
      ['boolean', true],
      ['object', {}],
      ['array', []],
      ['empty string', ''],
      ['leading whitespace', ' 1'],
      ['trailing whitespace', '1 '],
      ['newline', '\n1'],
      ['non numeric string', 'abc'],
      ['Infinity string', 'Infinity'],
      ['negative Infinity string', '-Infinity'],
      ['NaN string', 'NaN'],
      ['hex lower', '0x10'],
      ['hex upper', '0X10'],
      ['binary lower', '0b10'],
      ['binary upper', '0B10'],
      ['octal lower', '0o10'],
      ['octal upper', '0O10'],
    ])('rejects %s', (_label, value) => {
      expect(new ExposedParseFloatPipe().callIsNumeric(value)).toBe(false);
    });
  });

  describe('transform', () => {
    it.each([undefined, null])(
      'returns a nil value when optional is enabled (%s)',
      async value => {
        const pipe = new ParseFloatPipe({ optional: true });
        expect(await pipe.transform(value, metadata)).toBe(value);
      },
    );

    it.each([undefined, null])(
      'rejects a nil value when optional is disabled (%s)',
      async value => {
        const pipe = new ParseFloatPipe();
        await expect(pipe.transform(value, metadata)).rejects.toBeDefined();
      },
    );

    it.each([
      ['3.33', 3.33],
      ['-3.33', -3.33],
      [3.33, 3.33],
      [0, 0],
    ])('parses %s', async (value, expected) => {
      const pipe = new ParseFloatPipe();
      expect(await pipe.transform(value, metadata)).toBe(expected);
    });

    it.each(['abc', '0xFF', ' 1', true, {}, []])(
      'rejects %s',
      async value => {
        const pipe = new ParseFloatPipe();
        await expect(pipe.transform(value, metadata)).rejects.toBeDefined();
      },
    );

    it('uses a custom exception factory', async () => {
      const pipe = new ParseFloatPipe({
        exceptionFactory: () => new ImATeapotException(),
      });
      await expect(pipe.transform('bad', metadata)).rejects.toBeInstanceOf(
        ImATeapotException,
      );
    });

    it('uses the configured status code', async () => {
      const pipe = new ParseFloatPipe({
        errorHttpStatusCode: HttpStatus.I_AM_A_TEAPOT,
      });
      await expect(pipe.transform('bad', metadata)).rejects.toMatchObject({
        status: HttpStatus.I_AM_A_TEAPOT,
      });
    });

    it('uses the default factory without options', async () => {
      const pipe = new ParseFloatPipe();
      await expect(pipe.transform('bad', metadata)).rejects.toMatchObject({
        status: HttpStatus.BAD_REQUEST,
      });
    });
  });
});
