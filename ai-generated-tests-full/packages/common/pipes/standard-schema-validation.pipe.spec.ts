import { describe, expect, it } from 'vitest';
import { StandardSchemaValidationPipe } from '../../../../packages/common/pipes/standard-schema-validation.pipe.js';
import { HttpStatus } from '../../../../packages/common/enums/http-status.enum.js';

const metadata = (extra: Record<string, any> = {}) =>
  ({ type: 'body', ...extra }) as any;

const schemaOf = (validate: any) => ({ '~standard': { validate } });

describe('StandardSchemaValidationPipe', () => {
  it('returns the value when no schema is present', async () => {
    const pipe = new StandardSchemaValidationPipe();
    await expect(pipe.transform('x', metadata())).resolves.toBe('x');
  });

  it('skips custom decorators unless enabled', async () => {
    const validate = () => ({ value: 'validated' });
    const pipe = new StandardSchemaValidationPipe();
    await expect(
      pipe.transform('x', metadata({ type: 'custom', schema: schemaOf(validate) })),
    ).resolves.toBe('x');
  });

  it('validates custom decorators when enabled', async () => {
    const validate = () => ({ value: 'validated' });
    const pipe = new StandardSchemaValidationPipe({
      validateCustomDecorators: true,
    });
    await expect(
      pipe.transform('x', metadata({ type: 'custom', schema: schemaOf(validate) })),
    ).resolves.toBe('validated');
  });

  it('returns the original value when transform is disabled', async () => {
    const validate = () => ({ value: 'validated' });
    const pipe = new StandardSchemaValidationPipe({ transform: false });
    await expect(
      pipe.transform('x', metadata({ schema: schemaOf(validate) })),
    ).resolves.toBe('x');
  });

  it('forwards validate options to the schema', async () => {
    const validate = (...args: any[]) => ({ value: args[1] });
    const pipe = new StandardSchemaValidationPipe({
      validateOptions: { mode: 'strict' },
    });
    await expect(
      pipe.transform('x', metadata({ schema: schemaOf(validate) })),
    ).resolves.toEqual({ mode: 'strict' });
  });

  it('throws with formatted issue messages including paths', async () => {
    const validate = () => ({
      issues: [
        { message: 'root issue' },
        { message: 'nested issue', path: ['a', { key: 'b' }, 0] },
      ],
    });
    const pipe = new StandardSchemaValidationPipe();
    let caught: any;
    try {
      await pipe.transform({}, metadata({ schema: schemaOf(validate) }));
    } catch (error) {
      caught = error;
    }
    expect(caught.getResponse()).toEqual({
      message: ['root issue', 'a.b.0: nested issue'],
      error: 'Bad Request',
      statusCode: HttpStatus.BAD_REQUEST,
    });
  });

  it('throws with a custom status code and exception factory', async () => {
    const validate = () => ({ issues: [{ message: 'nope' }] });
    const custom = new StandardSchemaValidationPipe({
      exceptionFactory: issues =>
        Object.assign(new Error('custom'), { issues }),
    });
    await expect(
      custom.transform({}, metadata({ schema: schemaOf(validate) })),
    ).rejects.toThrow('custom');

    const forbidden = new StandardSchemaValidationPipe({
      errorHttpStatusCode: 403,
    });
    let caught: any;
    try {
      await forbidden.transform({}, metadata({ schema: schemaOf(validate) }));
    } catch (error) {
      caught = error;
    }
    expect(caught.getStatus()).toBe(403);
  });

  it('strips prototype pollution keys before validation', async () => {
    let received: any;
    const validate = (value: any) => {
      received = value;
      return { value };
    };
    const pipe = new StandardSchemaValidationPipe();
    const value = JSON.parse('{"__proto__":{"x":1},"safe":1}');
    await pipe.transform(value, metadata({ schema: schemaOf(validate) }));
    expect(Object.hasOwn(received, '__proto__')).toBe(false);
  });

  it('handles asynchronous schemas', async () => {
    const validate = async () => ({ value: 'async' });
    const pipe = new StandardSchemaValidationPipe();
    await expect(
      pipe.transform('x', metadata({ schema: schemaOf(validate) })),
    ).resolves.toBe('async');
  });
});
