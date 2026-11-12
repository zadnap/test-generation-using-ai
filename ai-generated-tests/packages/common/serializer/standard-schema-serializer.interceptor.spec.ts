import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { StandardSchemaV1 } from '@standard-schema/spec';
import { lastValueFrom, of } from 'rxjs';
import { Readable } from 'stream';
import { StandardSchemaSerializerInterceptor } from '../../../../packages/common/serializer/standard-schema-serializer.interceptor.js';
import { CLASS_SERIALIZER_OPTIONS } from '../../../../packages/common/serializer/class-serializer.constants.js';
import { StreamableFile } from '../../../../packages/common/file-stream/index.js';
import { ExecutionContext, CallHandler } from '../../../../packages/common/interfaces/index.js';

function createSchema(
  validateFn: (
    value: unknown,
    options?: StandardSchemaV1.Options,
  ) => StandardSchemaV1.Result<any> | Promise<StandardSchemaV1.Result<any>>,
): StandardSchemaV1 {
  return {
    '~standard': {
      version: 1,
      vendor: 'test-standard-schema',
      validate: validateFn,
    },
  };
}

describe('StandardSchemaSerializerInterceptor (C3)', () => {
  let mockReflector: any;

  beforeEach(() => {
    mockReflector = {
      getAll: vi.fn().mockReturnValue([undefined, undefined]),
    };
  });

  describe('constructor', () => {
    it.each([
      ['default options omitted', undefined],
      ['empty options object', {}],
      [
        'schema and validateOptions provided',
        {
          schema: createSchema(v => ({ value: v })),
          validateOptions: { libraryOptions: { strict: true } },
        },
      ],
    ])('constructs interceptor with %s', (_label, options) => {
      const interceptor = options
        ? new StandardSchemaSerializerInterceptor(mockReflector, options as any)
        : new StandardSchemaSerializerInterceptor(mockReflector);

      expect(interceptor).toBeInstanceOf(StandardSchemaSerializerInterceptor);
    });
  });

  describe('serialize', () => {
    const dummySchema = createSchema(val => ({
      value: { ...(val as any), validated: true },
    }));

    let interceptor: StandardSchemaSerializerInterceptor;

    beforeEach(() => {
      interceptor = new StandardSchemaSerializerInterceptor(mockReflector, {
        schema: dummySchema,
      });
    });

    describe('atomic condition 1c1: !schema [True -> short-circuit return response]', () => {
      it('returns response unchanged when schema is undefined', async () => {
        const response = { id: 1, name: 'Unchanged' };
        const result = await interceptor.serialize(response, undefined);

        expect(result).toBe(response);
      });
    });

    describe('atomic condition 1c2: !isObject(response) [1c1: F, 1c2: T -> return response]', () => {
      it.each([
        ['null', null],
        ['undefined', undefined],
        ['string primitive', 'hello'],
        ['empty string', ''],
        ['number primitive', 100],
        ['zero', 0],
        ['boolean true', true],
        ['boolean false', false],
        ['symbol', Symbol('sym')],
      ])('returns primitive response unchanged for %s', async (_label, input) => {
        const result = await interceptor.serialize(input as any, dummySchema);
        expect(result).toBe(input);
      });
    });

    describe('atomic condition 1c3: response instanceof StreamableFile [1c1: F, 1c2: F, 1c3: T -> return response]', () => {
      it('returns StreamableFile unchanged without serialization', async () => {
        const streamable = new StreamableFile(Buffer.from('streamable payload'));
        const result = await interceptor.serialize(streamable as any, dummySchema);

        expect(result).toBe(streamable);
      });
    });

    describe('atomic condition 1c4: isStreamingBody(response) [1c1: F, 1c2: F, 1c3: F, 1c4: T -> return response]', () => {
      it.each([
        ['Readable stream instance', new Readable({ read() {} })],
        ['Response object', new Response('body')],
        [
          'custom async iterable object without then',
          {
            [Symbol.asyncIterator]: () => ({
              next: async () => ({ done: true, value: undefined }),
            }),
          },
        ],
      ])('returns stream unchanged without serialization for %s', async (_label, stream) => {
        const result = await interceptor.serialize(stream as any, dummySchema);
        expect(result).toBe(stream);
      });
    });

    describe('decision 2: Array.isArray(response) [1c1: F, 1c2: F, 1c3: F, 1c4: F]', () => {
      it('branches to 2(T): Promise.all maps each item in array', async () => {
        const arr = [{ id: 1 }, { id: 2 }];
        const result = await interceptor.serialize(arr, dummySchema);

        expect(result).toEqual([
          { id: 1, validated: true },
          { id: 2, validated: true },
        ]);
      });

      it('branches to 2(T) with an empty array', async () => {
        const arr: any[] = [];
        const result = await interceptor.serialize(arr, dummySchema);

        expect(result).toEqual([]);
      });

      it('branches to 2(F): serializes single object', async () => {
        const obj = { id: 10, name: 'Single' };
        const result = await interceptor.serialize(obj, dummySchema);

        expect(result).toEqual({ id: 10, name: 'Single', validated: true });
      });
    });
  });

  describe('transformToPlain', () => {
    let interceptor: StandardSchemaSerializerInterceptor;

    beforeEach(() => {
      interceptor = new StandardSchemaSerializerInterceptor(mockReflector);
    });

    describe('decision 1: !plainOrClass', () => {
      it.each([
        ['null', null],
        ['undefined', undefined],
        ['empty string', ''],
        ['zero', 0],
        ['false', false],
      ])('branches to 1(T): returns falsy value unchanged for %s', async (_label, input) => {
        const validateSpy = vi.fn();
        const schema = createSchema(validateSpy);

        const result = await interceptor.transformToPlain(input, schema);
        expect(result).toBe(input);
        expect(validateSpy).not.toHaveBeenCalled();
      });
    });

    describe('decision 2: result.issues [1: F]', () => {
      it('branches to 2(T): throws Error when result has issues', async () => {
        const schema = createSchema(() => ({
          issues: [
            { message: 'field "email" is invalid' },
            { message: 'field "age" must be at least 18' },
          ],
        }));

        await expect(
          interceptor.transformToPlain({ email: 'bad' }, schema),
        ).rejects.toThrowError(
          'Serialization failed: field "email" is invalid, field "age" must be at least 18',
        );
      });

      it('branches to 2(F): returns result.value when validation succeeds', async () => {
        const schema = createSchema((val, opts) => ({
          value: { ...(val as any), processed: true, optsUsed: opts },
        }));

        const validateOptions = { libraryOptions: { custom: 123 } };
        const result = await interceptor.transformToPlain(
          { key: 'val' },
          schema,
          validateOptions,
        );

        expect(result).toEqual({
          key: 'val',
          processed: true,
          optsUsed: validateOptions,
        });
      });
    });
  });

  describe('getContextOptions', () => {
    class TestStandardSchemaSerializerInterceptor extends StandardSchemaSerializerInterceptor {
      public exposeGetContextOptions(context: ExecutionContext) {
        return this.getContextOptions(context);
      }
    }

    const s1 = createSchema(v => ({ value: v }));
    const s2 = createSchema(v => ({ value: v }));
    const v1: StandardSchemaV1.Options = { libraryOptions: { level: 1 } };
    const v2: StandardSchemaV1.Options = { libraryOptions: { level: 2 } };

    it.each([
      [
        'both handler and class options undefined (1c1: T, class undefined)',
        [undefined, undefined],
        undefined,
      ],
      [
        'handler undefined, class options defined (1c1: T, class defined)',
        [undefined, { schema: s2, validateOptions: v2 }],
        { schema: s2, validateOptions: v2 },
      ],
      [
        'handler defined, class options undefined (1c1: F, 1c2: T)',
        [{ schema: s1, validateOptions: v1 }, undefined],
        { schema: s1, validateOptions: v1 },
      ],
      [
        'both defined: handler overrides both schema and validateOptions (1c1: F, 1c2: F, 2c1: T, 3c1: T)',
        [{ schema: s1, validateOptions: v1 }, { schema: s2, validateOptions: v2 }],
        { schema: s1, validateOptions: v1 },
      ],
      [
        'both defined: handler overrides schema only (2c1: T, 3c1: F)',
        [{ schema: s1 }, { validateOptions: v2 }],
        { schema: s1, validateOptions: v2 },
      ],
      [
        'both defined: handler overrides validateOptions only (2c1: F, 3c1: T)',
        [{ validateOptions: v1 }, { schema: s2 }],
        { schema: s2, validateOptions: v1 },
      ],
      [
        'both defined: neither defines schema or validateOptions (2c1: F, 3c1: F)',
        [{}, {}],
        { schema: undefined, validateOptions: undefined },
      ],
    ])('resolves context options correctly for %s', (_label, reflectorReturn, expected) => {
      mockReflector.getAll.mockReturnValue(reflectorReturn);
      const interceptor = new TestStandardSchemaSerializerInterceptor(mockReflector);

      const mockContext = {
        getHandler: vi.fn().mockReturnValue('handlerRef'),
        getClass: vi.fn().mockReturnValue('classRef'),
      } as any;

      const result = interceptor.exposeGetContextOptions(mockContext);

      expect(mockReflector.getAll).toHaveBeenCalledWith(
        CLASS_SERIALIZER_OPTIONS,
        ['handlerRef', 'classRef'],
      );
      expect(result).toEqual(expected);
    });
  });

  describe('intercept', () => {
    it.each([
      [
        'schema from contextOptions overrides default schema',
        { schema: createSchema(v => ({ value: { ...(v as any), from: 'context' } })) },
        { schema: createSchema(v => ({ value: { ...(v as any), from: 'default' } })) },
        { id: 1 },
        { id: 1, from: 'context' },
      ],
      [
        'schema falls back to default when context schema is undefined',
        { validateOptions: { libraryOptions: { test: true } } },
        { schema: createSchema(v => ({ value: { ...(v as any), from: 'default' } })) },
        { id: 2 },
        { id: 2, from: 'default' },
      ],
      [
        'no schema provided anywhere: returns response untouched',
        undefined,
        {},
        { id: 3 },
        { id: 3 },
      ],
    ])('intercepts and transforms response for %s', async (_label, contextOptions, defaultOptions, response, expected) => {
      mockReflector.getAll.mockReturnValue([contextOptions, undefined]);

      const interceptor = new StandardSchemaSerializerInterceptor(
        mockReflector,
        defaultOptions as any,
      );

      const mockContext = {
        getHandler: vi.fn(),
        getClass: vi.fn(),
      } as any;

      const mockCallHandler: CallHandler = {
        handle: vi.fn().mockReturnValue(of(response)),
      };

      const result$ = interceptor.intercept(mockContext, mockCallHandler);
      const output = await lastValueFrom(result$);

      expect(output).toEqual(expected);
      expect(mockCallHandler.handle).toHaveBeenCalled();
    });
  });
});
