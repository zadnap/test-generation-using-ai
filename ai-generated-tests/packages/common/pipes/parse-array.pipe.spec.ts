import { IsString } from 'class-validator';
import { describe, expect, it, vi } from 'vitest';
import {
  ParseArrayPipe,
  type ParseArrayPipeOptions,
} from '../../../../packages/common/pipes/parse-array.pipe.js';
import { HttpStatus } from '../../../../packages/common/enums/http-status.enum.js';
import { ImATeapotException } from '../../../../packages/common/exceptions/im-a-teapot.exception.js';
import type { ArgumentMetadata } from '../../../../packages/common/interfaces/features/pipe-transform.interface.js';

const metadata = {} as ArgumentMetadata;
const hugeNumberString = '9'.repeat(400);

class Item {
  @IsString()
  name!: string;
}

class ExposedParseArrayPipe extends ParseArrayPipe {
  callIsExpectedTypePrimitive() {
    return this.isExpectedTypePrimitive();
  }
  callValidatePrimitive(value: any, index?: number) {
    return this.validatePrimitive(value, index);
  }
  callIsNumeric(value: unknown) {
    return this.isNumeric(value);
  }
}

function withStubbedValidator(
  options: ParseArrayPipeOptions,
  transform: (value: unknown, metadata: ArgumentMetadata) => unknown,
) {
  const pipe = new ParseArrayPipe(options);
  (pipe as any).validationPipe = { transform };
  return pipe;
}

function exceptionFactoryWithList() {
  return (errors: any) => {
    const error = new Error('validation failed');
    (error as any).errors = errors;
    return error;
  };
}

describe('ParseArrayPipe (C3)', () => {
  describe('constructor / exception factory', () => {
    it('uses the default factory', async () => {
      const pipe = new ParseArrayPipe();
      await expect(pipe.transform(undefined, metadata)).rejects.toMatchObject({
        status: HttpStatus.BAD_REQUEST,
      });
    });

    it('uses a custom factory', async () => {
      const pipe = new ParseArrayPipe({
        exceptionFactory: () => new ImATeapotException(),
      });
      await expect(pipe.transform(undefined, metadata)).rejects.toBeInstanceOf(
        ImATeapotException,
      );
    });

    it('uses the configured status code', async () => {
      const pipe = new ParseArrayPipe({
        errorHttpStatusCode: HttpStatus.I_AM_A_TEAPOT,
      });
      await expect(pipe.transform(undefined, metadata)).rejects.toMatchObject({
        status: HttpStatus.I_AM_A_TEAPOT,
      });
    });
  });

  describe('nil values', () => {
    it.each([undefined, null])(
      'rejects nil when optional is disabled (%s)',
      async value => {
        const pipe = new ParseArrayPipe({ optional: false });
        await expect(pipe.transform(value, metadata)).rejects.toBeDefined();
      },
    );

    it.each([undefined, null])(
      'returns nil when optional is enabled (%s)',
      async value => {
        const pipe = new ParseArrayPipe({ optional: true });
        expect(await pipe.transform(value, metadata)).toBe(value);
      },
    );
  });

  describe('parsing strings and arrays without items', () => {
    it.each([
      ['comma default', 'a,b', undefined, ['a', 'b']],
      ['custom separator', 'a|b', '|', ['a', 'b']],
      ['empty separator falls back to comma', 'a,b', '', ['a', 'b']],
      ['single item', 'a', undefined, ['a']],
      ['empty string', '', undefined, ['']],
      ['whitespace is trimmed', ' a , b ', undefined, ['a ', ' b']],
    ])('%s', async (_label, value, separator, expected) => {
      const pipe = new ParseArrayPipe({ separator });
      expect(await pipe.transform(value, metadata)).toEqual(expected);
    });

    it('returns an array unchanged when items is not set', async () => {
      const pipe = new ParseArrayPipe();
      const value = ['a', 'b'];
      expect(await pipe.transform(value, metadata)).toBe(value);
    });

    it('rejects a non-string, non-array value', async () => {
      const pipe = new ParseArrayPipe();
      await expect(pipe.transform(true, metadata)).rejects.toBeDefined();
    });

    it('wraps a throwing separator and uses the exception factory', async () => {
      const separator = {
        [Symbol.split]() {
          throw new Error('boom');
        },
      };
      const pipe = new ParseArrayPipe({
        separator: separator as any,
        exceptionFactory: () => new ImATeapotException(),
      });
      await expect(pipe.transform('a,b', metadata)).rejects.toBeInstanceOf(
        ImATeapotException,
      );
    });
  });

  describe('primitive item conversion', () => {
    it.each([
      ['numbers', [1, 2], [1, 2]],
      ['numeric strings', ['1', '2'], [1, 2]],
      ['decimals', ['1.5'], [1.5]],
      ['negative', ['-1'], [-1]],
    ])('converts %s when items is Number', async (_label, value, expected) => {
      const pipe = new ParseArrayPipe({ items: Number });
      expect(await pipe.transform(value, metadata)).toEqual(expected);
    });

    it('converts non-string items when items is String', async () => {
      const pipe = new ParseArrayPipe({ items: String });
      expect(await pipe.transform([1, true, 'x'], metadata)).toEqual([
        '1',
        'true',
        'x',
      ]);
    });

    it('parses JSON booleans when items is Boolean', async () => {
      const pipe = new ParseArrayPipe({ items: Boolean });
      expect(await pipe.transform(['true', 'false'], metadata)).toEqual([
        true,
        false,
      ]);
    });

    it('keeps non-string values after JSON parsing when items is String', async () => {
      const pipe = new ParseArrayPipe({ items: String });
      expect(await pipe.transform([null, undefined], metadata)).toEqual([
        'null',
        'undefined',
      ]);
    });

    it.each([
      ['number', Number],
      ['boolean', Boolean],
    ])('rejects an invalid %s item', async (_label, items) => {
      const pipe = new ParseArrayPipe({ items });
      await expect(pipe.transform(['nope'], metadata)).rejects.toBeDefined();
    });

    it('rejects a JSON parse failure that is not numeric', async () => {
      const pipe = new ParseArrayPipe({ items: Number });
      await expect(pipe.transform(['not-json'], metadata)).rejects.toBeDefined();
    });

    it('validates class items through the validation pipe', async () => {
      const pipe = new ParseArrayPipe({ items: Item });
      await expect(
        pipe.transform([{ name: 'valid' }], metadata),
      ).resolves.toHaveLength(1);
    });

    it('rejects invalid class items through the validation pipe', async () => {
      const pipe = new ParseArrayPipe({ items: Item });
      await expect(
        pipe.transform([{ name: 12 }], metadata),
      ).rejects.toBeDefined();
    });
  });

  describe('stopAtFirstError === false', () => {
    it('returns all converted items when none fail', async () => {
      const pipe = new ParseArrayPipe({
        items: Number,
        stopAtFirstError: false,
      });
      expect(await pipe.transform(['1', '2'], metadata)).toEqual([1, 2]);
    });

    it('maps an array response message', async () => {
      const pipe = withStubbedValidator(
        {
          items: Item,
          stopAtFirstError: false,
          exceptionFactory: exceptionFactoryWithList(),
        },
        () => {
          throw {
            getResponse: () => ({ message: ['e1', 'e2'] }),
          };
        },
      );

      await expect(
        pipe.transform([{}], metadata),
      ).rejects.toMatchObject({ errors: ['[0] e1', '[0] e2'] });
    });

    it('maps a grouped object response message, including the "..." entry', async () => {
      const pipe = withStubbedValidator(
        {
          items: Item,
          stopAtFirstError: false,
          exceptionFactory: exceptionFactoryWithList(),
        },
        () => {
          throw {
            getResponse: () => ({
              message: {
                name: ['m1', 'm2'],
                '...': ['omitted'],
                other: 'single',
              },
            }),
          };
        },
      );

      await expect(pipe.transform([{}], metadata)).rejects.toMatchObject({
        errors: [
          '[0] name: m1',
          '[0] name: m2',
          '[0] omitted',
          '[0] other: single',
        ],
      });
    });

    it('maps a scalar response message', async () => {
      const pipe = withStubbedValidator(
        {
          items: Item,
          stopAtFirstError: false,
          exceptionFactory: exceptionFactoryWithList(),
        },
        () => {
          throw { getResponse: () => ({ message: 'scalar' }) };
        },
      );

      await expect(pipe.transform([{}], metadata)).rejects.toMatchObject({
        errors: ['[0] scalar'],
      });
    });

    it('maps a missing response message', async () => {
      const pipe = withStubbedValidator(
        {
          items: Item,
          stopAtFirstError: false,
          exceptionFactory: exceptionFactoryWithList(),
        },
        () => {
          throw { getResponse: () => ({}) };
        },
      );

      await expect(pipe.transform([{}], metadata)).rejects.toMatchObject({
        errors: ['[0] undefined'],
      });
    });

    it('keeps an error without getResponse', async () => {
      const pipe = withStubbedValidator(
        {
          items: Item,
          stopAtFirstError: false,
          exceptionFactory: exceptionFactoryWithList(),
        },
        () => {
          throw 'plain';
        },
      );

      await expect(pipe.transform([{}], metadata)).rejects.toMatchObject({
        errors: ['plain'],
      });
    });

    it('flattens an array error without getResponse', async () => {
      const pipe = withStubbedValidator(
        {
          items: Item,
          stopAtFirstError: false,
          exceptionFactory: exceptionFactoryWithList(),
        },
        () => {
          throw ['a', 'b'];
        },
      );

      await expect(pipe.transform([{}], metadata)).rejects.toMatchObject({
        errors: ['a', 'b'],
      });
    });
  });

  describe('default stop-at-first-error branch', () => {
    it('validates present entries and leaves holes untouched', async () => {
      const transform = vi.fn(async (value: unknown) => value);
      const pipe = withStubbedValidator({ items: Item }, transform);
      const sparse: unknown[] = new Array(2);
      sparse[0] = { name: 'valid' };

      expect(await pipe.transform(sparse, metadata)).toEqual([
        { name: 'valid' },
        undefined,
      ]);
      expect(transform).toHaveBeenCalledTimes(1);
    });
  });

  describe('validatePrimitive', () => {
    it.each([
      [Number, 1, undefined, 1],
      [Number, '1', undefined, 1],
      [Number, '1.5', undefined, 1.5],
      [String, 'x', undefined, 'x'],
      [String, 1, undefined, '1'],
      [Boolean, true, undefined, true],
    ])(
      'converts %s value %s',
      (items, value, index, expected) => {
        const pipe = new ExposedParseArrayPipe({ items });
        expect(pipe.callValidatePrimitive(value, index)).toBe(expected);
      },
    );

    it.each([
      [Number, 'nope', undefined, 'item must be a number'],
      [Number, 'nope', 2, '[2] item must be a number'],
      [Boolean, 'nope', undefined, 'item must be a boolean value'],
      [Boolean, 'nope', 3, '[3] item must be a boolean value'],
    ])(
      'rejects %s value %s including the index',
      (items, value, index, message) => {
        const pipe = new ExposedParseArrayPipe({
          items,
          exceptionFactory: (error: any) => new Error(error),
        });
        expect(() => pipe.callValidatePrimitive(value, index)).toThrowError(
          message,
        );
      },
    );

    it('returns the value for an unsupported items type', () => {
      const pipe = new ExposedParseArrayPipe({ items: Object });
      expect(pipe.callValidatePrimitive('x')).toBe('x');
    });
  });

  describe('isNumeric', () => {
    it.each([
      [0, true],
      [1.5, true],
      ['0', true],
      ['1.5', true],
      ['-1', true],
      [' 1 ', true],
    ])('accepts %s', (value, expected) => {
      expect(new ExposedParseArrayPipe().callIsNumeric(value)).toBe(expected);
    });

    it.each([
      ['NaN', Number.NaN],
      ['Infinity', Infinity],
      ['null', null],
      ['undefined', undefined],
      ['boolean', true],
      ['array', []],
      ['empty string', ''],
      ['blank string', '   '],
      ['hex lower', '0x10'],
      ['hex upper', '0X10'],
      ['binary lower', '0b10'],
      ['binary upper', '0B10'],
      ['octal lower', '0o10'],
      ['octal upper', '0O10'],
      ['non numeric', 'abc'],
      ['overflowing digit string', hugeNumberString],
    ])('rejects %s', (_label, value) => {
      expect(new ExposedParseArrayPipe().callIsNumeric(value)).toBe(false);
    });
  });

  describe('isExpectedTypePrimitive', () => {
    it.each([
      [Boolean, true],
      [Number, true],
      [String, true],
      [Object, false],
      [Item, false],
      [undefined, false],
    ])('returns the expected result for %s', (items, expected) => {
      const pipe = new ExposedParseArrayPipe({ items: items as any });
      expect(pipe.callIsExpectedTypePrimitive()).toBe(expected);
    });
  });
});
