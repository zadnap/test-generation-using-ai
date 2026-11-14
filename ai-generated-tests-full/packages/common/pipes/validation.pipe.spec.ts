import { describe, expect, it, vi } from 'vitest';
import { ValidationPipe } from '../../../../packages/common/pipes/validation.pipe.js';
import { HttpStatus } from '../../../../packages/common/enums/http-status.enum.js';

class Dto {
  value?: string;
}

const metadata = (extra: Record<string, any> = {}) =>
  ({ type: 'body', metatype: Dto, ...extra }) as any;

const createTransformer = () => ({
  plainToInstance: vi.fn((metatype: any, value: any) => {
    if (typeof value !== 'object' || value === null) return value;
    return Object.assign(Object.create(metatype.prototype), value);
  }),
  classToPlain: vi.fn((value: any) => ({ plain: value })),
});

const createPipe = (overrides: Record<string, any> = {}) => {
  const validate = vi.fn(() => []);
  const transformer = createTransformer();
  const exceptionFactory = vi.fn((errors: any) =>
    Object.assign(new Error('validation'), { errors }),
  );
  const pipe = new ValidationPipe({
    transform: true,
    validatorPackage: { validate } as any,
    transformerPackage: transformer as any,
    exceptionFactory,
    ...overrides,
  });
  return { pipe, validate, transformer, exceptionFactory };
};

describe('ValidationPipe', () => {
  describe('constructor', () => {
    it('applies defaults when no options are provided', () => {
      const pipe = new ValidationPipe();
      expect((pipe as any).isTransformEnabled).toBe(false);
      expect((pipe as any).validateCustomDecorators).toBe(false);
      expect((pipe as any).errorHttpStatusCode).toBe(HttpStatus.BAD_REQUEST);
      expect((pipe as any).errorFormat).toBe('list');
      expect((pipe as any).maxErrorMessagesLength).toBe(1_000_000);
    });

    it('honours explicit options', () => {
      const pipe = new ValidationPipe({
        transform: true,
        disableErrorMessages: true,
        validateCustomDecorators: true,
        errorHttpStatusCode: HttpStatus.FORBIDDEN,
        errorFormat: 'grouped',
        maxErrorMessagesLength: 10,
        expectedType: Dto,
      });
      expect((pipe as any).isTransformEnabled).toBe(true);
      expect((pipe as any).isDetailedOutputDisabled).toBe(true);
      expect((pipe as any).validateCustomDecorators).toBe(true);
      expect((pipe as any).errorHttpStatusCode).toBe(HttpStatus.FORBIDDEN);
      expect((pipe as any).errorFormat).toBe('grouped');
      expect((pipe as any).maxErrorMessagesLength).toBe(10);
      expect((pipe as any).expectedType).toBe(Dto);
    });

    it('loads the default validator and transformer packages lazily', () => {
      const pipe = new ValidationPipe();
      expect((pipe as any).loadValidator()).toBeInstanceOf(Promise);
      expect((pipe as any).loadTransformer()).toBeInstanceOf(Promise);
    });

    it('accepts injected validator and transformer packages', () => {
      const validator = { validate: vi.fn() };
      const transformer = { plainToInstance: vi.fn(), classToPlain: vi.fn() };
      const pipe = new ValidationPipe({
        validatorPackage: validator as any,
        transformerPackage: transformer as any,
      });
      expect((pipe as any).loadValidator(validator)).toBe(validator);
      expect((pipe as any).loadTransformer(transformer)).toBe(transformer);
    });
  });

  describe('transform', () => {
    it('overrides the metatype with expectedType', async () => {
      const { pipe, transformer } = createPipe({ expectedType: Dto });
      await pipe.transform({ value: 'x' }, metadata({ metatype: undefined }));
      expect(transformer.plainToInstance).toHaveBeenCalledWith(
        Dto,
        { value: 'x' },
        undefined,
      );
    });

    it('returns a primitive transform when the metatype is native', async () => {
      const { pipe } = createPipe();
      await expect(
        pipe.transform(
          'true',
          metadata({ type: 'param', metatype: Boolean, data: 'flag' }),
        ),
      ).resolves.toBe(true);
    });

    it('returns the raw value when transform is disabled and the metatype is native', async () => {
      const { pipe } = createPipe({ transform: false });
      await expect(
        pipe.transform('x', metadata({ metatype: String })),
      ).resolves.toBe('x');
    });

    it('skips custom parameters unless validation is enabled', async () => {
      const { pipe, transformer } = createPipe();
      await expect(
        pipe.transform({ value: 'x' }, metadata({ type: 'custom' })),
      ).resolves.toEqual({ value: 'x' });
      expect(transformer.plainToInstance).not.toHaveBeenCalled();
    });

    it('validates custom parameters when enabled', async () => {
      const { pipe, transformer } = createPipe({
        validateCustomDecorators: true,
      });
      await pipe.transform({ value: 'x' }, metadata({ type: 'custom' }));
      expect(transformer.plainToInstance).toHaveBeenCalled();
    });

    it('returns the transformed entity', async () => {
      const { pipe } = createPipe();
      const result: any = await pipe.transform({ value: 'x' }, metadata());
      expect(result).toBeInstanceOf(Dto);
      expect(result.value).toBe('x');
    });

    it('throws when validation reports errors', async () => {
      const { pipe, validate } = createPipe();
      validate.mockReturnValueOnce([{ property: 'value' }] as any);
      await expect(pipe.transform({ value: 'x' }, metadata())).rejects.toThrow(
        'validation',
      );
    });

    it('reverts to the original value for a nil input when transform is disabled', async () => {
      const { pipe } = createPipe({ transform: false });
      await expect(pipe.transform(null, metadata())).resolves.toBeNull();
    });

    it('returns the class instance when transform is enabled', async () => {
      const { pipe } = createPipe({ transform: true });
      const result: any = await pipe.transform(undefined, metadata());
      expect(result).toBeInstanceOf(Dto);
    });

    it('converts to plain when validator options are configured and transform is disabled', async () => {
      const { pipe, transformer } = createPipe({
        transform: false,
        whitelist: true,
      });
      const result = await pipe.transform({ value: 'x' }, metadata());
      expect(transformer.classToPlain).toHaveBeenCalled();
      expect(result).toEqual({ plain: expect.anything() });
    });

    it('throws for a primitive that has validation rules', async () => {
      let call = 0;
      const validate = vi.fn(() => {
        call++;
        return call === 1 ? [] : [{ constraints: {} }];
      });
      const transformer = {
        plainToInstance: vi.fn(() => 'primitive'),
        classToPlain: vi.fn(),
      };
      const pipe = new ValidationPipe({
        transform: true,
        validatorPackage: { validate } as any,
        transformerPackage: transformer as any,
        exceptionFactory: errors =>
          Object.assign(new Error('object expected'), { errors }),
      });
      await expect(pipe.transform('x', metadata())).rejects.toThrow(
        'object expected',
      );
    });

    it('reverts to undefined when the original value was undefined and the entity is empty', async () => {
      const transformer = {
        plainToInstance: vi.fn(() => ''),
        classToPlain: vi.fn(),
      };
      const validate = vi
        .fn()
        .mockReturnValueOnce([])
        .mockReturnValueOnce([{ constraints: { unknownValue: 'x' } }]);
      const pipe = new ValidationPipe({
        transform: true,
        validatorPackage: { validate } as any,
        transformerPackage: transformer as any,
      });
      (pipe as any).isPrimitive = () => true;
      await expect(pipe.transform(undefined, metadata())).resolves.toBeUndefined();
    });
  });

  describe('toValidate', () => {
    it.each([
      ['string', String],
      ['boolean', Boolean],
      ['number', Number],
      ['array', Array],
      ['object', Object],
      ['buffer', Buffer],
      ['date', Date],
      ['nil', undefined],
    ])('rejects the native metatype %s', (_label, metatype) => {
      const { pipe } = createPipe();
      expect(
        (pipe as any).toValidate({ metatype, type: 'body' }),
      ).toBe(false);
    });

    it('accepts a custom class', () => {
      const { pipe } = createPipe();
      expect((pipe as any).toValidate({ metatype: Dto, type: 'body' })).toBe(
        true,
      );
    });

    it('rejects custom parameters unless enabled', () => {
      const { pipe } = createPipe();
      expect(
        (pipe as any).toValidate({ metatype: Dto, type: 'custom' }),
      ).toBe(false);
    });

    it('accepts custom parameters when enabled', () => {
      const { pipe } = createPipe({ validateCustomDecorators: true });
      expect(
        (pipe as any).toValidate({ metatype: Dto, type: 'custom' }),
      ).toBe(true);
    });
  });

  describe('transformPrimitive', () => {
    const run = (value: unknown, meta: any) =>
      (new ValidationPipe() as any).transformPrimitive(value, meta);

    it('leaves values without data untouched', () => {
      expect(run('x', { type: 'param' })).toBe('x');
    });

    it.each([
      ['custom type', { type: 'custom', metatype: Boolean, data: 'x' }],
      ['body type', { type: 'body', metatype: Boolean, data: 'x' }],
    ])('leaves %s untouched', (_label, meta) => {
      expect(run('x', meta)).toBe('x');
    });

    it('handles Boolean values', () => {
      const meta = { type: 'param', metatype: Boolean, data: 'x' };
      expect(run(undefined, meta)).toBeUndefined();
      expect(run(true, meta)).toBe(true);
      expect(run('true', meta)).toBe(true);
      expect(run('false', meta)).toBe(false);
    });

    it('handles Number values', () => {
      const meta = { type: 'param', metatype: Number, data: 'x' };
      expect(run(undefined, meta)).toBeUndefined();
      expect(run('5', meta)).toBe(5);
    });

    it('handles String values', () => {
      const meta = { type: 'query', metatype: String, data: 'x' };
      expect(run(5, meta)).toBe('5');
      expect(run(undefined, meta)).toBeUndefined();
    });

    it('returns values of other metatypes untouched', () => {
      const meta = { type: 'param', metatype: Object, data: 'x' };
      expect(run('x', meta)).toBe('x');
    });
  });

  describe('toEmptyIfNil', () => {
    const run = (value: unknown, metatype: any) =>
      (new ValidationPipe() as any).toEmptyIfNil(value, metatype);

    it('returns non-nil values unchanged', () => {
      expect(run('x', Dto)).toBe('x');
    });

    it('returns an empty object for a function metatype', () => {
      expect(run(undefined, Dto)).toEqual({});
    });

    it('returns an empty object for an object with a prototype constructor', () => {
      expect(run(null, { prototype: { constructor: Dto } })).toEqual({});
    });

    it('returns an empty string for other metatypes', () => {
      expect(run(null, {})).toBe('');
    });
  });

  describe('isPrimitive', () => {
    it.each([
      ['number', 1, true],
      ['boolean', true, true],
      ['string', 'x', true],
      ['object', {}, false],
      ['undefined', undefined, false],
    ])('returns expected for %s', (_label, value, expected) => {
      expect((new ValidationPipe() as any).isPrimitive(value)).toBe(expected);
    });
  });

  describe('hasValidationRules', () => {
    it('returns true when no unknown-value error is reported', async () => {
      const pipe = new ValidationPipe({
        validatorPackage: { validate: () => [] } as any,
        transformerPackage: {} as any,
      });
      await expect((pipe as any).hasValidationRules(Dto)).resolves.toBe(true);
    });

    it('returns false when the unknown-value error is reported', async () => {
      const pipe = new ValidationPipe({
        validatorPackage: {
          validate: () => [{ constraints: { unknownValue: 'x' } }],
        } as any,
        transformerPackage: {} as any,
      });
      await expect((pipe as any).hasValidationRules(Dto)).resolves.toBe(false);
    });
  });

  describe('flattenValidationErrors', () => {
    it('flattens nested constraints with parent paths', () => {
      const pipe = new ValidationPipe();
      const errors = [
        {
          property: 'a',
          constraints: { isString: 'a msg' },
          children: [
            { property: 'b', constraints: { isNumber: 'b msg' }, children: [] },
          ],
        },
      ];
      expect((pipe as any).flattenValidationErrors(errors)).toEqual([
        'a msg',
        'a.b msg',
      ]);
    });
  });

  describe('groupValidationErrors', () => {
    it('groups nested constraints by path', () => {
      const pipe = new ValidationPipe();
      const errors = [
        {
          property: 'a',
          constraints: { isString: 'a msg' },
          children: [
            { property: 'b', constraints: { isNumber: 'b msg' }, children: [] },
          ],
        },
      ];
      expect((pipe as any).groupValidationErrors(errors)).toEqual({
        a: ['a msg'],
        'a.b': ['b msg'],
      });
    });
  });

  describe('mapChildrenToValidationErrors', () => {
    it('returns the error when there are no children', () => {
      const pipe = new ValidationPipe();
      const error = { property: 'a', constraints: { x: 'x' } } as any;
      expect((pipe as any).mapChildrenToValidationErrors(error)).toEqual([
        error,
      ]);
    });

    it('does not add a parent without constraints when children exist', () => {
      const pipe = new ValidationPipe();
      const error = {
        property: 'a',
        children: [{ property: 'b', constraints: { x: 'x' } }],
      } as any;
      expect((pipe as any).mapChildrenToValidationErrors(error)).toEqual([
        { property: 'b', constraints: { x: 'a.x' } },
      ]);
    });

    it('adds a parent with constraints as well as its children', () => {
      const pipe = new ValidationPipe();
      const error = {
        property: 'a',
        constraints: { y: 'y' },
        children: [{ property: 'b', constraints: { x: 'x' } }],
      } as any;
      expect((pipe as any).mapChildrenToValidationErrors(error)).toEqual([
        {
          property: 'a',
          constraints: { y: 'y' },
          children: [{ property: 'b', constraints: { x: 'x' } }],
        },
        { property: 'b', constraints: { x: 'a.x' } },
      ]);
    });
  });

  describe('createExceptionFactory', () => {
    it('hides details when configured', async () => {
      const pipe = new ValidationPipe({ disableErrorMessages: true });
      const exception: any = await (pipe.createExceptionFactory() as any)([
        { property: 'a', constraints: { x: 'x' } },
      ]);
      expect(exception.getResponse()).toEqual({
        message: 'Bad Request',
        statusCode: HttpStatus.BAD_REQUEST,
      });
    });

    it('returns a list of messages', async () => {
      const pipe = new ValidationPipe();
      const exception: any = await (pipe.createExceptionFactory() as any)([
        { property: 'a', constraints: { x: 'x msg' } },
      ]);
      expect(exception.getResponse().message).toEqual(['x msg']);
    });

    it('returns grouped messages', async () => {
      const pipe = new ValidationPipe({ errorFormat: 'grouped' });
      const exception: any = await (pipe.createExceptionFactory() as any)([
        { property: 'a', constraints: { x: 'x msg' } },
      ]);
      expect(exception.getResponse().message).toEqual({ a: ['x msg'] });
    });

    it('appends an omitted-errors message in list format', async () => {
      const pipe = new ValidationPipe({ maxErrorMessagesLength: 0 });
      const exception: any = await (pipe.createExceptionFactory() as any)([
        { property: 'a', constraints: { x: 'x msg' } },
      ]);
      expect(exception.getResponse().message).toEqual([
        'Further validation errors were omitted',
      ]);
    });

    it('adds an omitted entry in grouped format', async () => {
      const pipe = new ValidationPipe({
        errorFormat: 'grouped',
        maxErrorMessagesLength: 0,
      });
      const exception: any = await (pipe.createExceptionFactory() as any)([
        { property: 'a', constraints: { x: 'x msg' } },
      ]);
      expect(exception.getResponse().message).toEqual({
        '...': ['Further validation errors were omitted'],
      });
    });
  });

  describe('limitValidationErrors', () => {
    it('returns the original list when nothing is omitted', () => {
      const pipe = new ValidationPipe();
      const errors = [{ property: 'a', constraints: {} }] as any;
      const budget = { remaining: 100, isExceeded: false };
      expect((pipe as any).limitValidationErrors(errors, budget)).toBe(errors);
      expect(budget.isExceeded).toBe(false);
    });

    it('stops when the budget is exhausted', () => {
      const pipe = new ValidationPipe();
      const errors = [
        { property: 'a', constraints: { x: 'abc' } },
        { property: 'b', constraints: { x: 'abc' } },
      ] as any;
      const budget = { remaining: 0, isExceeded: false };
      expect((pipe as any).limitValidationErrors(errors, budget)).toEqual([]);
      expect(budget.isExceeded).toBe(true);
    });

    it('copies errors whose children changed', () => {
      const pipe = new ValidationPipe();
      const errors = [
        {
          property: 'a',
          constraints: { x: 'abc' },
          children: [{ property: 'b', constraints: { x: 'abc' } }],
        },
      ] as any;
      const budget = { remaining: 3, isExceeded: false };
      const result = (pipe as any).limitValidationErrors(errors, budget);
      expect(result[0]).not.toBe(errors[0]);
      expect(result[0].children).toEqual([]);
      expect(budget.isExceeded).toBe(true);
    });
  });

  describe('prependConstraintsWithParentProp', () => {
    it('prefixes every constraint with the parent path', () => {
      const pipe = new ValidationPipe();
      expect(
        (pipe as any).prependConstraintsWithParentProp('parent', {
          property: 'child',
          constraints: { a: 'a msg', b: 'b msg' },
        }),
      ).toEqual({
        property: 'child',
        constraints: { a: 'parent.a msg', b: 'parent.b msg' },
      });
    });
  });

  describe('stripProtoKeys', () => {
    it('delegates to stripProtoKeys', () => {
      const pipe = new ValidationPipe();
      const value = JSON.parse('{"__proto__":{"x":1},"safe":1}');
      (pipe as any).stripProtoKeys(value);
      expect(Object.hasOwn(value, '__proto__')).toBe(false);
    });
  });
});
