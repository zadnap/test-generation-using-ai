import type { StandardSchemaV1 } from '@standard-schema/spec';
import { describe, expect, it, vi } from 'vitest';
import {
  StandardSchemaValidationPipe,
  type StandardSchemaValidationPipeOptions,
} from '../../../../packages/common/pipes/standard-schema-validation.pipe.js';
import { HttpStatus } from '../../../../packages/common/enums/http-status.enum.js';
import { ImATeapotException } from '../../../../packages/common/exceptions/im-a-teapot.exception.js';
import type { ArgumentMetadata } from '../../../../packages/common/interfaces/features/pipe-transform.interface.js';

type ValidateFn = (
  value: unknown,
  options?: Record<string, unknown>,
) => StandardSchemaV1.Result<any> | Promise<StandardSchemaV1.Result<any>>;

function createSchema(validate: ValidateFn): StandardSchemaV1 {
  return {
    '~standard': {
      version: 1,
      vendor: 'test',
      validate,
    },
  };
}

class ExposedStandardSchemaValidationPipe extends StandardSchemaValidationPipe {
  callToValidate(metadata: ArgumentMetadata) {
    return this.toValidate(metadata);
  }
  callFormatIssueMessages(issues: readonly StandardSchemaV1.Issue[]) {
    return this.formatIssueMessages(issues);
  }
  callStripProtoKeys(value: any) {
    return this.stripProtoKeys(value);
  }
  callValidate(
    value: unknown,
    schema: StandardSchemaV1,
    options?: Record<string, unknown>,
  ) {
    return this.validate(value, schema, options);
  }
}

const bodyMetadata = (schema?: StandardSchemaV1) =>
  ({ type: 'body', schema }) as ArgumentMetadata;

describe('StandardSchemaValidationPipe (C3)', () => {
  describe('transform', () => {
    it('returns the value when no schema is present', async () => {
      const pipe = new StandardSchemaValidationPipe();
      const value = { name: 'test' };
      expect(await pipe.transform(value, bodyMetadata())).toBe(value);
    });

    it('returns the value for a custom decorator when custom validation is disabled', async () => {
      const validate = vi.fn(() => ({ value: 'changed' }));
      const pipe = new StandardSchemaValidationPipe();
      const value = { name: 'test' };
      const result = await pipe.transform(value, {
        type: 'custom',
        schema: createSchema(validate),
      } as ArgumentMetadata);

      expect(result).toBe(value);
      expect(validate).not.toHaveBeenCalled();
    });

    it('validates a custom decorator when custom validation is enabled', async () => {
      const pipe = new StandardSchemaValidationPipe({
        validateCustomDecorators: true,
      });
      const result = await pipe.transform(
        { name: 'test' },
        {
          type: 'custom',
          schema: createSchema(value => ({ value })),
        } as ArgumentMetadata,
      );

      expect(result).toEqual({ name: 'test' });
    });

    it('validates a non-custom parameter', async () => {
      const pipe = new StandardSchemaValidationPipe();
      const result = await pipe.transform(
        { name: 'test' },
        bodyMetadata(createSchema(value => ({ value }))),
      );
      expect(result).toEqual({ name: 'test' });
    });

    it('returns the schema value when transform is enabled', async () => {
      const pipe = new StandardSchemaValidationPipe();
      const original = { name: 'test' };
      const result = await pipe.transform(
        original,
        bodyMetadata(createSchema(() => ({ value: { transformed: true } }))),
      );

      expect(result).toEqual({ transformed: true });
    });

    it('returns the original value when transform is disabled', async () => {
      const pipe = new StandardSchemaValidationPipe({ transform: false });
      const original = { name: 'test' };
      const result = await pipe.transform(
        original,
        bodyMetadata(createSchema(() => ({ value: { transformed: true } }))),
      );

      expect(result).toBe(original);
    });

    it('awaits an asynchronous schema', async () => {
      const pipe = new StandardSchemaValidationPipe();
      const result = await pipe.transform(
        { name: 'test' },
        bodyMetadata(createSchema(async value => ({ value }))),
      );
      expect(result).toEqual({ name: 'test' });
    });

    it('forwards validateOptions to the schema', async () => {
      const validateOptions = { abortEarly: false };
      const validate = vi.fn((value: unknown) => ({ value }));
      const pipe = new StandardSchemaValidationPipe({ validateOptions });
      await pipe.transform(
        { name: 'test' },
        bodyMetadata(createSchema(validate)),
      );

      expect(validate).toHaveBeenCalledWith({ name: 'test' }, validateOptions);
    });

    it.each([
      ['an issue with a path', [{ message: 'bad', path: ['name'] }]],
      ['an issue without a path', [{ message: 'bad' }]],
      ['an empty issue list', []],
    ])('throws for %s', async (_label, issues) => {
      const pipe = new StandardSchemaValidationPipe();
      await expect(
        pipe.transform(
          { name: 'test' },
          bodyMetadata(createSchema(() => ({ issues }))),
        ),
      ).rejects.toMatchObject({ status: HttpStatus.BAD_REQUEST });
    });

    it('uses a custom exception factory', async () => {
      const pipe = new StandardSchemaValidationPipe({
        exceptionFactory: () => new ImATeapotException(),
      });
      await expect(
        pipe.transform(
          { name: 'test' },
          bodyMetadata(
            createSchema(() => ({ issues: [{ message: 'bad' }] })),
          ),
        ),
      ).rejects.toBeInstanceOf(ImATeapotException);
    });

    it('uses the configured status code', async () => {
      const pipe = new StandardSchemaValidationPipe({
        errorHttpStatusCode: HttpStatus.I_AM_A_TEAPOT,
      });
      await expect(
        pipe.transform(
          { name: 'test' },
          bodyMetadata(
            createSchema(() => ({ issues: [{ message: 'bad' }] })),
          ),
        ),
      ).rejects.toMatchObject({ status: HttpStatus.I_AM_A_TEAPOT });
    });

    it('strips protected prototype keys before validating', async () => {
      const pipe = new StandardSchemaValidationPipe();
      const value = JSON.parse(
        '{"__proto__":{"polluted":true},"prototype":"p","constructor":"c","safe":1}',
      );

      await pipe.transform(
        value,
        bodyMetadata(createSchema(current => ({ value: current }))),
      );

      expect(value).toEqual({ safe: 1 });
    });
  });

  describe('toValidate', () => {
    it.each([
      ['custom disabled', { type: 'custom' }, false, false],
      ['custom enabled', { type: 'custom' }, true, true],
      ['body', { type: 'body' }, false, true],
      ['query', { type: 'query' }, false, true],
    ])('%s', (_label, metadata, enabled, expected) => {
      const pipe = new ExposedStandardSchemaValidationPipe({
        validateCustomDecorators: enabled,
      });
      expect(pipe.callToValidate(metadata as ArgumentMetadata)).toBe(expected);
    });
  });

  describe('formatIssueMessages', () => {
    it('formats paths with string and object segments', () => {
      const pipe = new ExposedStandardSchemaValidationPipe();
      expect(
        pipe.callFormatIssueMessages([
          { message: 'bad', path: ['user', { key: 'name' }, 0 as any] },
          { message: 'second' },
          { message: 'empty path', path: [] },
        ]),
      ).toEqual(['user.name.0: bad', 'second', 'empty path']);
    });
  });

  describe('validate / stripProtoKeys', () => {
    it('returns the schema result synchronously', () => {
      const pipe = new ExposedStandardSchemaValidationPipe();
      const schema = createSchema(() => ({ value: 1 }));
      expect(pipe.callValidate(1, schema)).toEqual({ value: 1 });
    });

    it('delegates stripProtoKeys', () => {
      const pipe = new ExposedStandardSchemaValidationPipe();
      const value: any = {
        __proto__: { polluted: true },
        prototype: 1,
        constructor: 2,
        safe: 3,
      };
      pipe.callStripProtoKeys(value);
      expect(value).toEqual({ safe: 3 });
    });
  });
});
