import { describe, expect, it } from 'vitest';
import { ParseEnumPipe } from '../../../../packages/common/pipes/parse-enum.pipe.js';
import { HttpStatus } from '../../../../packages/common/enums/http-status.enum.js';
import { ImATeapotException } from '../../../../packages/common/exceptions/im-a-teapot.exception.js';
import type { ArgumentMetadata } from '../../../../packages/common/interfaces/features/pipe-transform.interface.js';

const metadata = {} as ArgumentMetadata;

enum StringEnum {
  Up = 'UP',
  Down = 'DOWN',
}

enum NumericEnum {
  Zero = 0,
  One = 1,
}

class ExposedParseEnumPipe<T = any> extends ParseEnumPipe<T> {
  callToEnumValue(value: unknown) {
    return this.toEnumValue(value);
  }
  callIsEnum(value: unknown) {
    return this.isEnum(value);
  }
  callGetEnumValues() {
    return this.getEnumValues();
  }
}

class InconsistentEnumPipe extends ExposedParseEnumPipe {
  protected isEnum(): boolean {
    return true;
  }
  protected toEnumValue(): undefined {
    return undefined;
  }
}

describe('ParseEnumPipe (C3)', () => {
  describe('constructor', () => {
    it.each([null, undefined])('rejects a missing enum type (%s)', value => {
      expect(() => new ParseEnumPipe(value as any)).toThrowError(
        '"ParseEnumPipe" requires "enumType" argument specified (to validate input values).',
      );
    });

    it('uses the default exception factory when options are omitted', async () => {
      const pipe = new ParseEnumPipe(StringEnum);
      await expect(pipe.transform('X', metadata)).rejects.toMatchObject({
        status: HttpStatus.BAD_REQUEST,
      });
    });

    it('uses the configured status code', async () => {
      const pipe = new ParseEnumPipe(StringEnum, {
        errorHttpStatusCode: HttpStatus.I_AM_A_TEAPOT,
      });
      await expect(pipe.transform('X', metadata)).rejects.toMatchObject({
        status: HttpStatus.I_AM_A_TEAPOT,
      });
    });

    it('uses a custom exception factory', async () => {
      const pipe = new ParseEnumPipe(StringEnum, {
        exceptionFactory: () => new ImATeapotException(),
      });
      await expect(pipe.transform('X', metadata)).rejects.toBeInstanceOf(
        ImATeapotException,
      );
    });
  });

  describe('transform', () => {
    it.each([undefined, null])(
      'returns a nil value when optional is enabled (%s)',
      async value => {
        const pipe = new ParseEnumPipe(StringEnum, { optional: true });
        expect(await pipe.transform(value, metadata)).toBe(value);
      },
    );

    it.each([undefined, null])(
      'rejects a nil value when optional is disabled (%s)',
      async value => {
        const pipe = new ParseEnumPipe(StringEnum);
        await expect(pipe.transform(value, metadata)).rejects.toBeDefined();
      },
    );

    it.each([
      ['UP', StringEnum.Up],
      ['DOWN', StringEnum.Down],
    ])('maps a string member %s', async (value, expected) => {
      const pipe = new ParseEnumPipe(StringEnum);
      expect(await pipe.transform(value, metadata)).toBe(expected);
    });

    it.each([
      [0, NumericEnum.Zero],
      [1, NumericEnum.One],
      ['0', NumericEnum.Zero],
      ['1', NumericEnum.One],
    ])('maps a numeric member %s', async (value, expected) => {
      const pipe = new ParseEnumPipe(NumericEnum);
      expect(await pipe.transform(value, metadata)).toBe(expected);
    });

    it('rejects an unknown member', async () => {
      const pipe = new ParseEnumPipe(StringEnum);
      await expect(pipe.transform('SIDEWAYS', metadata)).rejects.toBeDefined();
    });

    it('falls back to the original value when a subclass reports an enum member but returns none', async () => {
      const pipe = new InconsistentEnumPipe({ A: 'a' });
      expect(await pipe.transform('raw', metadata)).toBe('raw');
    });

    it('caches the computed enum values between calls', async () => {
      const pipe = new ExposedParseEnumPipe(StringEnum);
      const first = pipe.callGetEnumValues();
      const second = pipe.callGetEnumValues();
      expect(second).toBe(first);
      await pipe.transform('UP', metadata);
      expect(pipe.callGetEnumValues()).toBe(first);
    });
  });

  describe('toEnumValue / computeEnumValues condition coverage', () => {
    it('filters numeric reverse mappings and keeps real members', () => {
      const pipe = new ExposedParseEnumPipe({
        0: 'Zero',
        1: 'One',
        Zero: 0,
        One: 1,
        Name: 'Name',
        Alias: 'Name',
      });

      expect(pipe.callGetEnumValues()).toEqual([0, 1, 'Name', 'Name']);
      expect(pipe.callToEnumValue('Zero')).toBeUndefined();
      expect(pipe.callToEnumValue('0')).toBe(0);
      expect(pipe.callToEnumValue('Name')).toBe('Name');
      expect(pipe.callToEnumValue('missing')).toBeUndefined();
      expect(pipe.callIsEnum('1')).toBe(true);
      expect(pipe.callIsEnum('missing')).toBe(false);
    });

    it('does not filter a string mapping whose reverse value is not its key', () => {
      const pipe = new ExposedParseEnumPipe({ A: 'foo', foo: 1 });
      expect(pipe.callGetEnumValues()).toEqual(['foo', 1]);
    });

    it('does not filter a string member without a numeric reverse mapping', () => {
      const pipe = new ExposedParseEnumPipe({ A: 'foo', B: 'bar' });
      expect(pipe.callGetEnumValues()).toEqual(['foo', 'bar']);
    });
  });
});
