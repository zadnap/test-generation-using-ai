import { firstValueFrom, of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { StandardSchemaSerializerInterceptor } from '../../../../packages/common/serializer/standard-schema-serializer.interceptor.js';
import { StreamableFile } from '../../../../packages/common/file-stream/streamable-file.js';
import { CLASS_SERIALIZER_OPTIONS } from '../../../../packages/common/serializer/class-serializer.constants.js';

const schemaOf = (validate: any) => ({ '~standard': { validate } });

const context = () => ({
  getHandler: () => 'handler',
  getClass: () => 'class',
});

const reflector = (handlerOptions?: any, classOptions?: any) => ({
  getAll: vi.fn(() => [handlerOptions, classOptions]),
});

describe('StandardSchemaSerializerInterceptor', () => {
  it('intercepts and serializes with a default schema', async () => {
    const schema = schemaOf((value: any) => ({ value: { ...value, ok: true } }));
    const instance = new StandardSchemaSerializerInterceptor(reflector(), {
      schema,
    });
    const result = await firstValueFrom(
      await instance.intercept(context() as any, {
        handle: () => of({ value: 'x' }),
      } as any),
    );
    expect(result).toEqual({ value: 'x', ok: true });
  });

  it('prefers per-handler options over defaults', async () => {
    const defaultSchema = schemaOf(() => ({ value: 'default' }));
    const handlerSchema = schemaOf(() => ({ value: 'handler' }));
    const instance = new StandardSchemaSerializerInterceptor(
      reflector({ schema: handlerSchema }),
      { schema: defaultSchema },
    );
    const result = await firstValueFrom(
      await instance.intercept(context() as any, {
        handle: () => of({}),
      } as any),
    );
    expect(result).toBe('handler');
  });

  it.each([
    ['no schema', undefined, { a: 1 }],
    ['null response', schemaOf(() => ({})), null],
    ['string response', schemaOf(() => ({})), 'x'],
  ])('returns %s values unchanged', (_label, schema, value) => {
    const instance = new StandardSchemaSerializerInterceptor(reflector());
    expect(instance.serialize(value as any, schema as any)).toBe(value);
  });

  it('returns StreamableFile and streaming bodies unchanged', () => {
    const instance = new StandardSchemaSerializerInterceptor(reflector());
    const schema: any = schemaOf(() => ({}));
    const file = new StreamableFile(Buffer.from('x'));
    expect(instance.serialize(file as any, schema)).toBe(file);
    const body = {
      [Symbol.asyncIterator]: async function* () {
        yield 'x';
      },
    };
    expect(instance.serialize(body as any, schema)).toBe(body);
  });

  it('serializes arrays with Promise.all', async () => {
    const schema = schemaOf((value: any) => ({ value: { ...value, ok: true } }));
    const instance = new StandardSchemaSerializerInterceptor(reflector());
    const result = await instance.serialize([{ a: 1 }, { b: 2 }], schema);
    expect(result).toEqual([
      { a: 1, ok: true },
      { b: 2, ok: true },
    ]);
  });

  it('forwards validate options', async () => {
    const validate = vi.fn(() => ({ value: 'ok' }));
    const instance = new StandardSchemaSerializerInterceptor(reflector());
    await instance.serialize({}, schemaOf(validate), { mode: 'strict' } as any);
    expect(validate).toHaveBeenCalledWith({}, { mode: 'strict' });
  });

  describe('transformToPlain', () => {
    it('returns falsy values unchanged', async () => {
      const instance = new StandardSchemaSerializerInterceptor(reflector());
      const schema: any = schemaOf(() => ({}));
      await expect(instance.transformToPlain(null, schema)).resolves.toBeNull();
      await expect(
        instance.transformToPlain(undefined, schema),
      ).resolves.toBeUndefined();
    });

    it('throws when the schema reports issues', async () => {
      const schema = schemaOf(() => ({
        issues: [{ message: 'one' }, { message: 'two' }],
      }));
      const instance = new StandardSchemaSerializerInterceptor(reflector());
      await expect(instance.transformToPlain({}, schema as any)).rejects.toThrow(
        'Serialization failed: one, two',
      );
    });
  });

  describe('getContextOptions', () => {
    it('returns undefined when neither level has options', () => {
      const instance: any = new StandardSchemaSerializerInterceptor(
        reflector(),
      );
      expect(instance.getContextOptions(context())).toBeUndefined();
    });

    it('returns the only available options', () => {
      const classOptions = { schema: schemaOf(() => ({})) };
      const instance: any = new StandardSchemaSerializerInterceptor(
        reflector(undefined, classOptions),
      );
      expect(instance.getContextOptions(context())).toBe(classOptions);
      expect(
        (instance as any).getContextOptions(context()),
      ).toBe(classOptions);
    });

    it('merges handler and class options key by key', () => {
      const classOptions = {
        schema: 'class-schema',
        validateOptions: { a: 1 },
      };
      const handlerOptions = { validateOptions: { b: 2 } };
      const instance: any = new StandardSchemaSerializerInterceptor(
        reflector(handlerOptions, classOptions),
      );
      expect(instance.getContextOptions(context())).toEqual({
        schema: 'class-schema',
        validateOptions: { b: 2 },
      });
    });

    it('passes both handler and class to the reflector', () => {
      const ref = reflector();
      const instance = new StandardSchemaSerializerInterceptor(ref);
      (instance as any).getContextOptions(context());
      expect(ref.getAll).toHaveBeenCalledWith(CLASS_SERIALIZER_OPTIONS, [
        'handler',
        'class',
      ]);
    });
  });
});
