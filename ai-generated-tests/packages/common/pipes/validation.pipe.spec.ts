import { Type } from 'class-transformer';
import {
  IsDefined,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { describe, expect, it, vi } from 'vitest';
import {
  ValidationPipe,
  type ValidationPipeOptions,
} from '../../../../packages/common/pipes/validation.pipe.js';
import { HttpStatus } from '../../../../packages/common/enums/http-status.enum.js';
import { ImATeapotException } from '../../../../packages/common/exceptions/im-a-teapot.exception.js';
import type { ArgumentMetadata } from '../../../../packages/common/interfaces/features/pipe-transform.interface.js';
import type { ValidationError } from '../../../../packages/common/interfaces/external/validation-error.interface.js';

class Model {
  @IsString()
  prop1!: string;

  @IsOptional()
  @IsString()
  prop2?: string;
}

class OptionalModel {
  @IsOptional()
  @IsString()
  prop1?: string;
}

class RequiredModel {
  @IsDefined()
  prop!: string;
}

class NoRules {}

class Child {
  @IsString()
  name!: string;
}

class Parent {
  @ValidateNested()
  @Type(() => Child)
  child!: Child;
}

class ExposedValidationPipe extends ValidationPipe {
  callToValidate(metadata: ArgumentMetadata) {
    return this.toValidate(metadata);
  }
  callTransformPrimitive(value: unknown, metadata: ArgumentMetadata) {
    return this.transformPrimitive(value, metadata);
  }
  callToEmptyIfNil(value: unknown, metatype: any) {
    return this.toEmptyIfNil(value, metatype);
  }
  callIsPrimitive(value: unknown) {
    return this.isPrimitive(value);
  }
  callStripProtoKeys(value: any) {
    return this.stripProtoKeys(value);
  }
  callValidate(object: object, options?: any) {
    return this.validate(object, options);
  }
  callHasValidationRules(metatype: any) {
    return this.hasValidationRules(metatype);
  }
  callFlatten(errors: ValidationError[]) {
    return this.flattenValidationErrors(errors);
  }
  callGroup(errors: ValidationError[], parentPath?: string) {
    return this.groupValidationErrors(errors, parentPath);
  }
  callMap(
    error: ValidationError,
    parentPath?: string,
    validationErrors: ValidationError[] = [],
  ) {
    return this.mapChildrenToValidationErrors(
      error,
      parentPath,
      validationErrors,
    );
  }
  callPrepend(parentPath: string, error: ValidationError) {
    return this.prependConstraintsWithParentProp(parentPath, error);
  }
  callLimit(
    errors: ValidationError[],
    budget: { remaining: number; isExceeded: boolean },
    parentPathLength = 0,
  ) {
    return this.limitValidationErrors(errors, budget, parentPathLength);
  }
  callLoadValidator(pkg?: any) {
    return this.loadValidator(pkg);
  }
  callLoadTransformer(pkg?: any) {
    return this.loadTransformer(pkg);
  }
}

class OverrideGroupPipe extends ExposedValidationPipe {
  protected groupValidationErrors(
    errors: ValidationError[],
    parentPath?: string,
    result: Record<string, string[]> = {},
  ): Record<string, string[]> {
    const base = super.groupValidationErrors(errors, parentPath, result);
    return parentPath ? { ...base, extra: ['override'] } : base;
  }
}

class OverrideMapPipe extends ExposedValidationPipe {
  protected mapChildrenToValidationErrors(
    error: ValidationError,
    parentPath?: string,
    validationErrors: ValidationError[] = [],
  ): ValidationError[] {
    const base = super.mapChildrenToValidationErrors(
      error,
      parentPath,
      validationErrors,
    );
    return parentPath
      ? [...base, { property: 'extra', constraints: { extra: 'extra' } }]
      : base;
  }
}

class StubbedHasRulesPipe extends ExposedValidationPipe {
  constructor(private readonly errors: ValidationError[]) {
    super();
  }
  protected validate(): Promise<ValidationError[]> | ValidationError[] {
    return this.errors;
  }
}

const metadata = (metatype?: any, type = 'body', data?: string) =>
  ({ type, metatype, data }) as ArgumentMetadata;

const transformerStub = (plainToInstance: any) => ({
  plainToInstance,
  classToPlain: (value: any) => value,
});

describe('ValidationPipe (C3)', () => {
  describe('constructor and package loading', () => {
    it('loads the validator and transformer packages by default', async () => {
      const pipe = new ExposedValidationPipe();

      const validator: any = pipe.callLoadValidator();
      const transformer: any = pipe.callLoadTransformer();

      await expect(validator).resolves.toHaveProperty('validate');
      await expect(transformer).resolves.toHaveProperty('plainToInstance');
    });

    it('returns provided packages as is', () => {
      const pipe = new ExposedValidationPipe();
      const validator = { validate: () => [] };
      const transformer = { plainToInstance: () => ({}), classToPlain: () => ({}) };

      expect(pipe.callLoadValidator(validator)).toBe(validator);
      expect(pipe.callLoadTransformer(transformer)).toBe(transformer);
    });

    it('uses a custom exception factory instead of the default', async () => {
      const pipe = new ValidationPipe({
        exceptionFactory: () => new ImATeapotException(),
      });
      await expect(
        pipe.transform({ prop1: 1 }, metadata(Model)),
      ).rejects.toBeInstanceOf(ImATeapotException);
    });
  });

  describe('transform - primitive and skipped metatypes', () => {
    it('returns the primitive value when transform is disabled', async () => {
      const pipe = new ValidationPipe({ transform: false });
      const value = { prop1: 'x' };
      expect(await pipe.transform(value, metadata(undefined))).toBe(value);
    });

    it('returns the value for a missing metatype when transform is enabled', async () => {
      const pipe = new ValidationPipe({ transform: true });
      const value = { prop1: 'x' };
      expect(await pipe.transform(value, metadata(undefined))).toBe(value);
    });

    it.each([
      [String, 5, '5'],
      [String, 'x', 'x'],
      [Number, '5', 5],
      [Number, 5, 5],
      [Boolean, 'true', true],
      [Boolean, true, true],
      [Boolean, 'false', false],
      [Boolean, 0, false],
    ])(
      'transforms a primitive %s with value %s',
      async (metatype, value, expected) => {
        const pipe = new ValidationPipe({ transform: true });
        const result = await pipe.transform(
          value,
          metadata(metatype, 'query', 'field'),
        );
        expect(result).toBe(expected);
      },
    );

    it.each([
      [Boolean, undefined],
      [Number, undefined],
      [String, undefined],
    ])('keeps undefined for %s', async (metatype, value) => {
      const pipe = new ValidationPipe({ transform: true });
      expect(
        await pipe.transform(value, metadata(metatype, 'query', 'field')),
      ).toBeUndefined();
    });

    it.each([Array, Object, Buffer, Date])(
      'leaves %s values untouched',
      async metatype => {
        const value: any = metatype === Date ? new Date() : [];
        const pipe = new ValidationPipe({ transform: true });
        expect(
          await pipe.transform(value, metadata(metatype, 'query', 'field')),
        ).toBe(value);
      },
    );

    it('skips custom parameters when custom validation is disabled', async () => {
      const pipe = new ValidationPipe({ transform: true });
      const value = { prop1: 'x' };
      expect(await pipe.transform(value, metadata(Model, 'custom'))).toBe(
        value,
      );
    });

    it('validates custom parameters when enabled', async () => {
      const pipe = new ValidationPipe({
        transform: true,
        validateCustomDecorators: true,
      });
      expect(
        await pipe.transform({ prop1: 'x' }, metadata(Model, 'custom')),
      ).toBeInstanceOf(Model);
    });
  });

  describe('transform - validation flow', () => {
    it('returns a transformed instance for valid input', async () => {
      const pipe = new ValidationPipe({ transform: true });
      const result = await pipe.transform({ prop1: 'x' }, metadata(Model));
      expect(result).toBeInstanceOf(Model);
    });

    it('throws when validation finds errors', async () => {
      const pipe = new ValidationPipe({ transform: true });
      await expect(
        pipe.transform({ prop1: 1 }, metadata(Model)),
      ).rejects.toMatchObject({ status: HttpStatus.BAD_REQUEST });
    });

    it('uses the expectedType when provided', async () => {
      const pipe = new ValidationPipe({
        transform: true,
        expectedType: OptionalModel,
      });
      const result = await pipe.transform(
        { prop1: 'x' },
        metadata(String, 'body'),
      );
      expect(result).toBeInstanceOf(OptionalModel);
    });

    it('returns the original value when transform is disabled and no extra options exist', async () => {
      const pipe = new ValidationPipe({ transform: false });
      const value = { prop1: 'x' };
      expect(await pipe.transform(value, metadata(OptionalModel))).toBe(value);
    });

    it('returns a plain object when transform is disabled and extra options exist', async () => {
      const pipe = new ValidationPipe({ transform: false, whitelist: true });
      const value = { prop1: 'x' };
      const result = await pipe.transform(value, metadata(OptionalModel));
      expect(result).not.toBe(value);
      expect(result).toEqual({ prop1: 'x' });
    });

    it('reverts undefined input when there is nothing to validate', async () => {
      const pipe = new ValidationPipe({ transform: false });
      expect(
        await pipe.transform(undefined, metadata(OptionalModel)),
      ).toBeUndefined();
    });

    it('returns undefined when the transformer produces an empty string', async () => {
      const validator = {
        validate: (_object: unknown, options: any) =>
          options?.forbidUnknownValues
            ? [{ constraints: { unknownValue: 'unknown' } }]
            : [],
      };
      const pipe = new ValidationPipe({
        transform: false,
        validatorPackage: validator as any,
        transformerPackage: transformerStub(() => '') as any,
      });

      expect(await pipe.transform(undefined, metadata({ A: 'a' }))).toBe(
        undefined,
      );
    });

    it('assigns the metatype when a non-primitive entity has another constructor', async () => {
      const validator = { validate: () => [] };
      const pipe = new ValidationPipe({
        transform: true,
        validatorPackage: validator as any,
        transformerPackage: transformerStub(() => ({})) as any,
      });

      const result: any = await pipe.transform(
        { prop1: 'x' },
        metadata(Model),
      );
      expect(result.constructor).toBe(Model);
    });

    it('uses a stand-in and throws for a primitive entity with validation rules', async () => {
      const validator = {
        validate: (_object: unknown, options: any) =>
          options?.forbidUnknownValues ? [] : [],
      };
      const pipe = new ValidationPipe({
        transform: true,
        validatorPackage: validator as any,
        transformerPackage: transformerStub(() => 'x') as any,
      });

      await expect(pipe.transform('x', metadata(Model))).rejects.toBeDefined();
    });

    it('does not throw for a primitive entity without validation rules', async () => {
      const validator = {
        validate: (_object: unknown, options: any) =>
          options?.forbidUnknownValues
            ? [{ constraints: { unknownValue: 'unknown' } }]
            : [],
      };
      const pipe = new ValidationPipe({
        transform: true,
        validatorPackage: validator as any,
        transformerPackage: transformerStub(() => 'x') as any,
      });

      expect(await pipe.transform('x', metadata(NoRules))).toBe('x');
    });

    it('throws for an array entity with validation rules', async () => {
      const validator = { validate: () => [] };
      const pipe = new ValidationPipe({
        transform: true,
        validatorPackage: validator as any,
        transformerPackage: transformerStub(() => []) as any,
      });

      await expect(pipe.transform([], metadata(Model))).rejects.toBeDefined();
    });
  });

  describe('toValidate', () => {
    it.each([
      [String, 'body', false],
      [Boolean, 'body', false],
      [Number, 'body', false],
      [Array, 'body', false],
      [Object, 'body', false],
      [Buffer, 'body', false],
      [Date, 'body', false],
      [Model, 'body', true],
      [undefined, 'body', false],
      [Model, 'custom', false],
    ])('metatype %s type %s -> %s', (metatype, type, expected) => {
      const pipe = new ExposedValidationPipe();
      expect(
        pipe.callToValidate({ type, metatype } as ArgumentMetadata),
      ).toBe(expected);
    });

    it('validates custom parameters when enabled', () => {
      const pipe = new ExposedValidationPipe({
        validateCustomDecorators: true,
      });
      expect(
        pipe.callToValidate({
          type: 'custom',
          metatype: Model,
        } as ArgumentMetadata),
      ).toBe(true);
    });
  });

  describe('transformPrimitive', () => {
    const pipe = new ExposedValidationPipe({ transform: true });

    it('leaves a value without metadata.data untouched', () => {
      const value = { a: 1 };
      expect(pipe.callTransformPrimitive(value, metadata(String))).toBe(value);
    });

    it.each(['body', 'custom', 'param2'])(
      'leaves a value for type %s untouched',
      type => {
        const value = 5;
        expect(
          pipe.callTransformPrimitive(value, metadata(String, type, 'f')),
        ).toBe(value);
      },
    );

    it('returns undefined for an undefined Boolean/Number', () => {
      expect(
        pipe.callTransformPrimitive(undefined, metadata(Boolean, 'param', 'f')),
      ).toBeUndefined();
      expect(
        pipe.callTransformPrimitive(undefined, metadata(Number, 'param', 'f')),
      ).toBeUndefined();
    });

    it('returns the value for an undefined String', () => {
      expect(
        pipe.callTransformPrimitive(undefined, metadata(String, 'param', 'f')),
      ).toBeUndefined();
    });

    it('returns the value for another primitive metatype', () => {
      const value = {};
      expect(
        pipe.callTransformPrimitive(value, metadata(Object, 'query', 'f')),
      ).toBe(value);
    });
  });

  describe('toEmptyIfNil', () => {
    const pipe = new ExposedValidationPipe();

    it('returns a non-nil value', () => {
      const value = { a: 1 };
      expect(pipe.callToEmptyIfNil(value, Model)).toBe(value);
    });

    it('returns an empty object for a function metatype', () => {
      expect(pipe.callToEmptyIfNil(undefined, Model)).toEqual({});
    });

    it('returns an empty object for an object with a prototype constructor', () => {
      const metatype = { prototype: { constructor: function Value() {} } };
      expect(pipe.callToEmptyIfNil(null, metatype)).toEqual({});
    });

    it('returns an empty string for a plain object metatype', () => {
      expect(pipe.callToEmptyIfNil(undefined, { A: 'a' })).toBe('');
    });
  });

  describe('isPrimitive', () => {
    const pipe = new ExposedValidationPipe();

    it.each([
      [1, true],
      [true, true],
      ['x', true],
      [{}, false],
      [[], false],
      [null, false],
      [undefined, false],
      [Symbol('x'), false],
      [1n, false],
      [() => undefined, false],
    ])('%s -> %s', (value, expected) => {
      expect(pipe.callIsPrimitive(value)).toBe(expected);
    });
  });

  describe('hasValidationRules', () => {
    it.each([
      [[], true],
      [[{ constraints: {} }], true],
      [[{ constraints: undefined }], true],
      [[{ constraints: { unknownValue: 'unknown' } }], false],
    ])('errors %j -> %s', async (errors, expected) => {
      const pipe = new StubbedHasRulesPipe(errors as ValidationError[]);
      expect(await pipe.callHasValidationRules(Model)).toBe(expected);
    });
  });

  describe('flattenValidationErrors', () => {
    const pipe = new ExposedValidationPipe();

    it('flattens nested constraints and drops entries without constraints', () => {
      expect(
        pipe.callFlatten([
          {
            property: 'parent',
            constraints: { invalid: 'parent invalid' },
            children: [
              {
                property: 'child',
                children: [
                  {
                    property: 'name',
                    constraints: { isString: 'name invalid' },
                  },
                  { property: 'empty' },
                ],
              },
            ],
          },
          { property: 'noConstraints' },
        ]),
      ).toEqual(['parent invalid', 'parent.child.name invalid']);
    });
  });

  describe('groupValidationErrors', () => {
    it('groups nested constraints by path', () => {
      const pipe = new ExposedValidationPipe();
      expect(
        pipe.callGroup(
          [
            {
              property: 'parent',
              constraints: { invalid: 'parent invalid' },
              children: [
                {
                  property: 'child',
                  constraints: { invalid: 'child invalid' },
                  children: [
                    {
                      property: 'name',
                      constraints: { isString: 'name invalid' },
                    },
                  ],
                },
              ],
            },
            { property: 'empty' },
          ],
          'root',
        ),
      ).toEqual({
        'root.parent': ['parent invalid'],
        'root.parent.child': ['child invalid'],
        'root.parent.child.name': ['name invalid'],
      });
    });

    it('merges a result returned by an override', () => {
      const pipe = new OverrideGroupPipe();
      const result = pipe.callGroup([
        {
          property: 'parent',
          children: [
            { property: 'child', constraints: { c: 'child invalid' } },
          ],
        },
      ]);
      expect(result).toMatchObject({ extra: ['override'] });
    });
  });

  describe('mapChildrenToValidationErrors', () => {
    const pipe = new ExposedValidationPipe();

    it('returns the error itself without a parent path or children', () => {
      const error = {
        property: 'name',
        constraints: { isString: 'invalid' },
      } as ValidationError;
      expect(pipe.callMap(error)).toEqual([error]);
    });

    it('prefixes constraints with the parent path', () => {
      const error = {
        property: 'name',
        constraints: { isString: 'invalid' },
      } as ValidationError;
      expect(pipe.callMap(error, 'parent')).toEqual([
        {
          property: 'name',
          constraints: { isString: 'parent.invalid' },
        },
      ]);
    });

    it('includes intermediate constraints and nested errors once', () => {
      const error: ValidationError = {
        property: 'parent',
        constraints: { invalid: 'parent invalid' },
        children: [
          {
            property: 'child',
            constraints: { invalid: 'child invalid' },
            children: [
              {
                property: 'name',
                constraints: { isString: 'name invalid' },
              },
            ],
          },
        ],
      };
      expect(pipe.callMap(error)).toEqual([
        error,
        expect.objectContaining({
          property: 'child',
          constraints: { invalid: 'parent.child invalid' },
        }),
        expect.objectContaining({
          property: 'name',
          constraints: { isString: 'parent.child.name invalid' },
        }),
      ]);
    });

    it('copies a list returned by an override', () => {
      const pipe = new OverrideMapPipe();
      const result = pipe.callMap({
        property: 'parent',
        children: [{ property: 'child', constraints: { c: 'c' } }],
      });
      expect(result.some(item => item.property === 'extra')).toBe(true);
    });
  });

  describe('prependConstraintsWithParentProp', () => {
    it('prefixes every constraint', () => {
      const pipe = new ExposedValidationPipe();
      expect(
        pipe.callPrepend('parent', {
          property: 'name',
          constraints: { a: 'a', b: 'b' },
        } as ValidationError),
      ).toEqual({
        property: 'name',
        constraints: { a: 'parent.a', b: 'parent.b' },
      });
    });
  });

  describe('limitValidationErrors', () => {
    const pipe = new ExposedValidationPipe();

    it('stops before visiting errors when the budget is already exhausted', () => {
      const budget = { remaining: 0, isExceeded: false };
      expect(
        pipe.callLimit(
          [{ property: 'a', constraints: { a: 'a' } }],
          budget,
        ),
      ).toEqual([]);
      expect(budget.isExceeded).toBe(true);
    });

    it('returns the same array when nothing changes', () => {
      const errors = [
        { property: 'a', constraints: { a: 'a' } },
        { property: 'b' },
      ] as ValidationError[];
      const budget = { remaining: 100, isExceeded: false };
      expect(pipe.callLimit(errors, budget)).toBe(errors);
      expect(budget.isExceeded).toBe(false);
    });

    it('returns a new array when children are limited', () => {
      const errors = [
        {
          property: 'parent',
          constraints: { p: 'p' },
          children: [
            { property: 'child', constraints: { c: 'child message' } },
          ],
        },
      ] as ValidationError[];
      const budget = { remaining: 4, isExceeded: false };
      const result = pipe.callLimit(errors, budget);

      expect(result).not.toBe(errors);
      expect(result[0].children).toEqual([]);
      expect(budget.isExceeded).toBe(true);
    });

    it('keeps an empty children array', () => {
      const errors = [
        { property: 'parent', children: [] },
      ] as ValidationError[];
      const budget = { remaining: 100, isExceeded: false };
      expect(pipe.callLimit(errors, budget)).toBe(errors);
    });

    it('counts the parent path length', () => {
      const errors = [
        { property: 'child', constraints: { c: 'message' } },
      ] as ValidationError[];
      const budget = { remaining: 100, isExceeded: false };
      expect(pipe.callLimit(errors, budget, 5)).toBe(errors);
      expect(budget.remaining).toBeLessThan(100);
    });
  });

  describe('createExceptionFactory', () => {
    it('returns a bare exception when detailed output is disabled', () => {
      const pipe = new ValidationPipe({ disableErrorMessages: true });
      const exception: any = pipe.createExceptionFactory()([
        { property: 'a', constraints: { a: 'a' } },
      ]);
      expect(exception.getStatus()).toBe(HttpStatus.BAD_REQUEST);
    });

    it('returns a list of messages', () => {
      const pipe = new ValidationPipe();
      const exception: any = pipe.createExceptionFactory()([
        { property: 'a', constraints: { isString: 'a must be a string' } },
      ]);
      expect(exception.getResponse().message).toEqual(['a must be a string']);
    });

    it('appends the omission message when the budget is exceeded', () => {
      const pipe = new ValidationPipe({ maxErrorMessagesLength: 0 });
      const exception: any = pipe.createExceptionFactory()([
        { property: 'a', constraints: { isString: 'a must be a string' } },
      ]);
      expect(exception.getResponse().message).toEqual([
        'Further validation errors were omitted',
      ]);
    });

    it('returns grouped messages with the standard envelope', () => {
      const pipe = new ValidationPipe({ errorFormat: 'grouped' });
      const exception: any = pipe.createExceptionFactory()([
        { property: 'a', constraints: { isString: 'a must be a string' } },
      ]);
      expect(exception.getResponse()).toMatchObject({
        message: { a: ['a must be a string'] },
        statusCode: HttpStatus.BAD_REQUEST,
      });
    });

    it('adds the omission entry to grouped messages', () => {
      const pipe = new ValidationPipe({
        errorFormat: 'grouped',
        maxErrorMessagesLength: 0,
      });
      const exception: any = pipe.createExceptionFactory()([
        { property: 'a', constraints: { isString: 'a must be a string' } },
      ]);
      expect(exception.getResponse().message).toEqual({
        '...': ['Further validation errors were omitted'],
      });
    });

    it('uses the configured status code', () => {
      const pipe = new ValidationPipe({
        errorHttpStatusCode: HttpStatus.I_AM_A_TEAPOT,
      });
      const exception: any = pipe.createExceptionFactory()([
        { property: 'a', constraints: { a: 'a' } },
      ]);
      expect(exception.getStatus()).toBe(HttpStatus.I_AM_A_TEAPOT);
    });
  });

  describe('stripProtoKeys', () => {
    it('removes dangerous keys', () => {
      const pipe = new ExposedValidationPipe();
      const value = JSON.parse(
        '{"__proto__":{"polluted":true},"prototype":"p","constructor":"c","safe":1}',
      );
      pipe.callStripProtoKeys(value);
      expect(value).toEqual({ safe: 1 });
    });
  });
});
