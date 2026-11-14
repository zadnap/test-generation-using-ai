import { firstValueFrom, of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { ClassSerializerInterceptor } from '../../../../packages/common/serializer/class-serializer.interceptor.js';
import { StreamableFile } from '../../../../packages/common/file-stream/streamable-file.js';
import { CLASS_SERIALIZER_OPTIONS } from '../../../../packages/common/serializer/class-serializer.constants.js';

class Dto {
  value?: string;
}

const transformer = () => ({
  classToPlain: vi.fn((value: any) => ({ plain: value })),
  plainToInstance: vi.fn((type: any, value: any) =>
    Object.assign(Object.create(type.prototype), value),
  ),
});

const reflector = (options?: any) => ({
  getAllAndOverride: vi.fn(() => options),
});

const context = () => ({
  getHandler: () => 'handler',
  getClass: () => 'class',
});

describe('ClassSerializerInterceptor', () => {
  it('loads a default transformer package lazily', () => {
    const instance: any = new ClassSerializerInterceptor(reflector());
    expect(instance).toBeInstanceOf(ClassSerializerInterceptor);
  });

  it('intercepts and serializes the response', async () => {
    const stub = transformer();
    const instance = new ClassSerializerInterceptor(reflector({ type: Dto }), {
      transformerPackage: stub as any,
    });
    const result = await firstValueFrom(
      await instance.intercept(context() as any, {
        handle: () => of({ value: 'x' }),
      } as any),
    );
    expect(stub.classToPlain).toHaveBeenCalled();
    expect(result).toEqual({ plain: expect.anything() });
  });

  it('merges context options over the defaults', async () => {
    const stub = transformer();
    const instance = new ClassSerializerInterceptor(reflector({ type: Dto }), {
      transformerPackage: stub as any,
      excludeExtraneousValues: false,
    });
    const serialize = vi.spyOn(instance, 'serialize');
    await firstValueFrom(
      await instance.intercept(context() as any, {
        handle: () => of({ value: 'x' }),
      } as any),
    );
    expect(serialize).toHaveBeenCalledWith(
      { value: 'x' },
      expect.objectContaining({ type: Dto, excludeExtraneousValues: false }),
    );
  });

  describe('serialize', () => {
    const options = { type: Dto };

    it.each([
      ['null', null],
      ['string', 'x'],
      ['number', 1],
    ])('returns non-object %s values unchanged', (_label, value) => {
      const instance = new ClassSerializerInterceptor(reflector(), {
        transformerPackage: transformer() as any,
      });
      expect(instance.serialize(value as any, options as any)).toBe(value);
    });

    it('returns StreamableFile values unchanged', () => {
      const instance = new ClassSerializerInterceptor(reflector(), {
        transformerPackage: transformer() as any,
      });
      const file = new StreamableFile(Buffer.from('x'));
      expect(instance.serialize(file as any, options as any)).toBe(file);
    });

    it('returns streaming bodies unchanged', () => {
      const instance = new ClassSerializerInterceptor(reflector(), {
        transformerPackage: transformer() as any,
      });
      const body = {
        [Symbol.asyncIterator]: async function* () {
          yield 'x';
        },
      };
      expect(instance.serialize(body as any, options as any)).toBe(body);
    });

    it('serializes arrays element by element', () => {
      const instance = new ClassSerializerInterceptor(reflector(), {
        transformerPackage: transformer() as any,
      });
      const result: any = instance.serialize(
        [{ value: 'a' }, { value: 'b' }],
        options as any,
      );
      expect(result).toHaveLength(2);
      expect(result[0].plain).toBeDefined();
    });

    it('serializes a single object', () => {
      const instance = new ClassSerializerInterceptor(reflector(), {
        transformerPackage: transformer() as any,
      });
      const result: any = instance.serialize({ value: 'a' } as any, options as any);
      expect(result.plain).toBeDefined();
    });
  });

  describe('transformToPlain', () => {
    it('returns falsy values unchanged', () => {
      const instance = new ClassSerializerInterceptor(reflector(), {
        transformerPackage: transformer() as any,
      });
      expect((instance as any).transformToPlain(null, {})).toBeNull();
      expect((instance as any).transformToPlain(undefined, {})).toBeUndefined();
    });

    it('uses classToPlain when no type is configured', () => {
      const stub = transformer();
      const instance = new ClassSerializerInterceptor(reflector(), {
        transformerPackage: stub as any,
      });
      instance.transformToPlain({ a: 1 }, {} as any);
      expect(stub.classToPlain).toHaveBeenCalled();
    });

    it('uses classToPlain for an instance of the configured type', () => {
      const stub = transformer();
      const instance = new ClassSerializerInterceptor(reflector(), {
        transformerPackage: stub as any,
      });
      const dto = new Dto();
      instance.transformToPlain(dto, { type: Dto } as any);
      expect(stub.classToPlain).toHaveBeenCalledWith(dto, { type: Dto });
    });

    it('creates an instance before converting for a plain object', () => {
      const stub = transformer();
      const instance = new ClassSerializerInterceptor(reflector(), {
        transformerPackage: stub as any,
      });
      instance.transformToPlain({ value: 'x' }, { type: Dto } as any);
      expect(stub.plainToInstance).toHaveBeenCalled();
      expect(stub.classToPlain).toHaveBeenCalled();
    });
  });

  it('reads context options from the reflector', () => {
    const options = { type: Dto };
    const ref = reflector(options);
    const instance = new ClassSerializerInterceptor(ref, {
      transformerPackage: transformer() as any,
    });
    expect((instance as any).getContextOptions(context())).toBe(options);
    expect(ref.getAllAndOverride).toHaveBeenCalledWith(
      CLASS_SERIALIZER_OPTIONS,
      ['handler', 'class'],
    );
  });
});
