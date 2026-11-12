import { describe, expect, it, vi, beforeEach } from 'vitest';
import { firstValueFrom, of } from 'rxjs';
import { Readable } from 'stream';
import { ClassSerializerInterceptor } from '../../../../packages/common/serializer/class-serializer.interceptor.js';
import { CLASS_SERIALIZER_OPTIONS } from '../../../../packages/common/serializer/class-serializer.constants.js';
import { StreamableFile } from '../../../../packages/common/file-stream/index.js';
import { ExecutionContext, CallHandler } from '../../../../packages/common/interfaces/index.js';

class MockUser {
  id: number = 1;
  name: string = 'Alice';
}

class SubUser extends MockUser {}

describe('ClassSerializerInterceptor (C3)', () => {
  let mockReflector: any;
  let mockTransformerPackage: any;

  beforeEach(() => {
    mockReflector = {
      getAllAndOverride: vi.fn(),
    };
    mockTransformerPackage = {
      classToPlain: vi.fn((obj: any) => ({ ...obj, transformed: true })),
      plainToInstance: vi.fn((cls: any, obj: any) => Object.assign(new cls(), obj)),
    };
  });

  describe('constructor', () => {
    it.each([
      [
        'synchronous transformerPackage (1c1: T, 2: T)',
        () => ({ transformerPackage: mockTransformerPackage }),
      ],
      [
        'Promise transformerPackage (1c1: T, 2: F)',
        () => ({ transformerPackage: Promise.resolve(mockTransformerPackage) }),
      ],
      [
        'no transformerPackage provided (1c1: F, 2: F via loadPackage)',
        () => ({}),
      ],
      [
        'defaultOptions omitted completely (1c1: F, 2: F)',
        () => undefined,
      ],
    ])('constructs interceptor for %s', (_label, getOptions) => {
      const options = getOptions();
      const interceptor = options
        ? new ClassSerializerInterceptor(mockReflector, options as any)
        : new ClassSerializerInterceptor(mockReflector);

      expect(interceptor).toBeInstanceOf(ClassSerializerInterceptor);
    });
  });

  describe('serialize', () => {
    let interceptor: ClassSerializerInterceptor;

    beforeEach(() => {
      interceptor = new ClassSerializerInterceptor(mockReflector, {
        transformerPackage: mockTransformerPackage,
      });
    });

    describe('atomic condition 1c1: !isObject(response) [True -> short-circuit return response]', () => {
      it.each([
        ['null', null],
        ['undefined', undefined],
        ['string primitive', 'hello'],
        ['empty string', ''],
        ['number primitive', 42],
        ['zero', 0],
        ['boolean true', true],
        ['boolean false', false],
        ['symbol', Symbol('sym')],
      ])('returns primitive response unchanged for %s', (_label, input) => {
        const result = interceptor.serialize(input as any, {});
        expect(result).toBe(input);
        expect(mockTransformerPackage.classToPlain).not.toHaveBeenCalled();
      });
    });

    describe('atomic condition 1c2: response instanceof StreamableFile [1c1: F, 1c2: T -> return response]', () => {
      it('returns StreamableFile unchanged without serializing', () => {
        const file = new StreamableFile(Buffer.from('stream-content'));
        const result = interceptor.serialize(file as any, {});

        expect(result).toBe(file);
        expect(mockTransformerPackage.classToPlain).not.toHaveBeenCalled();
      });
    });

    describe('atomic condition 1c3: isStreamingBody(response) [1c1: F, 1c2: F, 1c3: T -> return response]', () => {
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
      ])('returns stream unchanged without serializing for %s', (_label, stream) => {
        const result = interceptor.serialize(stream as any, {});

        expect(result).toBe(stream);
        expect(mockTransformerPackage.classToPlain).not.toHaveBeenCalled();
      });
    });

    describe('decision 2: Array.isArray(response) [1c1: F, 1c2: F, 1c3: F]', () => {
      it('branches to 2(T): maps each item in array', () => {
        const arr = [{ id: 1 }, { id: 2 }];
        const result = interceptor.serialize(arr, {});

        expect(Array.isArray(result)).toBe(true);
        expect(mockTransformerPackage.classToPlain).toHaveBeenCalledTimes(2);
      });

      it('branches to 2(T) with an empty array', () => {
        const arr: any[] = [];
        const result = interceptor.serialize(arr, {});

        expect(result).toEqual([]);
        expect(mockTransformerPackage.classToPlain).not.toHaveBeenCalled();
      });

      it('branches to 2(F): serializes single object', () => {
        const obj = { id: 1, name: 'Alice' };
        const result = interceptor.serialize(obj, {});

        expect(result).toEqual({ id: 1, name: 'Alice', transformed: true });
        expect(mockTransformerPackage.classToPlain).toHaveBeenCalledWith(obj, {});
      });
    });
  });

  describe('transformToPlain', () => {
    let interceptor: ClassSerializerInterceptor;

    beforeEach(() => {
      interceptor = new ClassSerializerInterceptor(mockReflector, {
        transformerPackage: mockTransformerPackage,
      });
    });

    describe('decision 1: !plainOrClass', () => {
      it.each([
        ['null', null],
        ['undefined', undefined],
        ['empty string', ''],
        ['zero', 0],
        ['false', false],
      ])('branches to 1(T): returns falsy value unchanged for %s', (_label, input) => {
        const result = interceptor.transformToPlain(input, {});
        expect(result).toBe(input);
        expect(mockTransformerPackage.classToPlain).not.toHaveBeenCalled();
      });
    });

    describe('decision 2: !options.type [1: F]', () => {
      it.each([
        ['no options.type (undefined)', {}],
        ['options.type explicitly undefined', { type: undefined }],
      ])('branches to 2(T): calls classToPlain directly when %s', (_label, options) => {
        const obj = { id: 10 };
        const result = interceptor.transformToPlain(obj, options as any);

        expect(result).toEqual({ id: 10, transformed: true });
        expect(mockTransformerPackage.classToPlain).toHaveBeenCalledWith(obj, options);
        expect(mockTransformerPackage.plainToInstance).not.toHaveBeenCalled();
      });
    });

    describe('decision 3: plainOrClass instanceof options.type [1: F, 2: F]', () => {
      it.each([
        ['exact instance of options.type (3: T)', new MockUser()],
        ['subclass instance of options.type (3: T)', new SubUser()],
      ])('branches to 3(T): calls classToPlain directly for %s', (_label, instance) => {
        const options = { type: MockUser };
        const result = interceptor.transformToPlain(instance, options);

        expect(result).toEqual({ ...instance, transformed: true });
        expect(mockTransformerPackage.classToPlain).toHaveBeenCalledWith(instance, options);
        expect(mockTransformerPackage.plainToInstance).not.toHaveBeenCalled();
      });

      it.each([
        ['plain object literal (3: F)', { id: 99, name: 'Bob' }],
        ['instance of different class (3: F)', new (class OtherClass { id = 99; })()],
      ])('branches to 3(F): converts to instance first via plainToInstance for %s', (_label, input) => {
        const options = { type: MockUser };
        const result = interceptor.transformToPlain(input, options);

        expect(mockTransformerPackage.plainToInstance).toHaveBeenCalledWith(
          MockUser,
          input,
          options,
        );
        expect(mockTransformerPackage.classToPlain).toHaveBeenCalled();
        expect(result).toBeDefined();
      });
    });
  });

  describe('getContextOptions', () => {
    class TestClassSerializerInterceptor extends ClassSerializerInterceptor {
      public exposeGetContextOptions(context: ExecutionContext) {
        return this.getContextOptions(context);
      }
    }

    it.each([
      ['reflector returns options object', { groups: ['admin'], excludeExtraneousValues: true }],
      ['reflector returns undefined', undefined],
    ])('invokes reflector.getAllAndOverride with %s', (_label, reflectorReturn) => {
      mockReflector.getAllAndOverride.mockReturnValue(reflectorReturn);
      const interceptor = new TestClassSerializerInterceptor(mockReflector);

      const mockContext = {
        getHandler: vi.fn().mockReturnValue('mockHandler'),
        getClass: vi.fn().mockReturnValue('mockClass'),
      } as any;

      const result = interceptor.exposeGetContextOptions(mockContext);

      expect(mockReflector.getAllAndOverride).toHaveBeenCalledWith(
        CLASS_SERIALIZER_OPTIONS,
        ['mockHandler', 'mockClass'],
      );
      expect(result).toBe(reflectorReturn);
    });
  });

  describe('intercept', () => {
    it.each([
      [
        'single plain object response with merged options',
        { id: 1, name: 'Alice' },
        { excludeExtraneousValues: true },
        { groups: ['admin'] },
      ],
      [
        'array response with default options only (context options undefined)',
        [{ id: 1 }, { id: 2 }],
        { groups: ['public'] },
        undefined,
      ],
      [
        'empty options on both default and context',
        { key: 'value' },
        {},
        {},
      ],
    ])('intercepts call and serializes stream for %s', async (_label, response, defaultOptions, contextOptions) => {
      mockReflector.getAllAndOverride.mockReturnValue(contextOptions);

      const interceptor = new ClassSerializerInterceptor(mockReflector, {
        transformerPackage: mockTransformerPackage,
        ...defaultOptions,
      });

      const mockContext = {
        getHandler: vi.fn(),
        getClass: vi.fn(),
      } as any;

      const mockCallHandler: CallHandler = {
        handle: vi.fn().mockReturnValue(of(response)),
      };

      const result$ = await interceptor.intercept(mockContext, mockCallHandler);
      const emitted = await firstValueFrom(result$);

      expect(emitted).toBeDefined();
      expect(mockCallHandler.handle).toHaveBeenCalled();
    });
  });
});
