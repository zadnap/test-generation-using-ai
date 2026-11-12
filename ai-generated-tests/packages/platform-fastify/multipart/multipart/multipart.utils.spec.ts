import {
  BadRequestException,
  HttpException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { multerExceptions } from '../../../../../packages/platform-fastify/multipart/multipart/multipart.constants.js';
import { MultipartError } from '../../../../../packages/platform-fastify/multipart/multipart/multipart.error.js';
import {
  mergeMultipartOptions,
  transformException,
} from '../../../../../packages/platform-fastify/multipart/multipart/multipart.utils.js';
import { memoryStorage } from '../../../../../packages/platform-fastify/multipart/storage/memory.storage.js';

/**
 * CFG (C3) for mergeMultipartOptions:
 *   1c1 isPlainObject(options.limits) && isPlainObject(localOptions.limits)
 *   1c2 isPlainObject(localOptions.limits)            (only when 1c1 True)
 *   2c1 localOptions.dest && !localOptions.storage
 *   2c2 !localOptions.storage                          (only when 2c1 True)
 *
 * CFG (C3) for transformException:
 *   1c1 !error || error instanceof HttpException
 *   1c2 error instanceof HttpException                 (only when !error False)
 *   2   isFastifyMultipartLimitCode(error.code)
 *   3   error instanceof MultipartError
 *   4   error.code === 'LIMIT_FILE_SIZE'
 *   5   error.field
 *   6c1 error.code && fastifyMultipartBadRequestCodes.includes(error.code)
 *   6c2 fastifyMultipartBadRequestCodes.includes(error.code)
 *   7c1 message === BOUNDARY_NOT_FOUND
 *   8c1 message === UNEXPECTED_END_OF_FORM
 *   8c2 message.includes(PART_TERMINATED_EARLY)       (only when 8c1 False)
 *   9c1 typeof code === 'string' && Object.hasOwn(...)
 *   9c2 Object.hasOwn(...)                            (only when 9c1 True)
 * All feasible T/F are exercised below.
 */
describe('mergeMultipartOptions', () => {
  it('should return an empty object without options', () => {
    expect(mergeMultipartOptions()).toEqual({});
  });

  it('should let local options override global options', () => {
    expect(mergeMultipartOptions({ dest: '/global' }, { dest: '/local' })).toEqual({
      dest: '/local',
    });
  });

  it('should merge limits key-by-key when both are plain objects', () => {
    const merged = mergeMultipartOptions(
      { limits: { files: 2, fileSize: 1 } },
      { limits: { fileSize: 10 } },
    );
    expect(merged.limits).toEqual({ files: 2, fileSize: 10 });
    // A new object, not one of the inputs.
    expect(merged.limits).not.toBe(undefined);
  });

  it('should let a local limits function win outright', () => {
    const limits = () => ({ fileSize: 1 });
    const merged = mergeMultipartOptions({ limits: { files: 2 } }, { limits });
    expect(merged.limits).toBe(limits);
  });

  it('should let a local plain limits object win over a global function', () => {
    const localLimits = { files: 3 };
    const merged = mergeMultipartOptions(
      { limits: (() => ({})) as any },
      { limits: localLimits },
    );
    expect(merged.limits).toBe(localLimits);
  });

  it('should let a local "dest" remove a global "storage"', () => {
    const storage = memoryStorage();
    expect(mergeMultipartOptions({ storage }, { dest: '/local' })).toEqual({
      dest: '/local',
    });
  });

  it('should keep a global "storage" when the local options carry one', () => {
    const globalStorage = memoryStorage();
    const localStorage = memoryStorage();
    const merged = mergeMultipartOptions(
      { storage: globalStorage },
      { dest: '/local', storage: localStorage },
    );
    expect(merged.storage).toBe(localStorage);
  });

  it('should keep a global "storage" when the route sets no "dest"', () => {
    const storage = memoryStorage();
    expect(
      mergeMultipartOptions({ storage }, { preservePath: true }).storage,
    ).toBe(storage);
  });

  it('should not remove "storage" for an empty local "dest"', () => {
    const storage = memoryStorage();
    expect(mergeMultipartOptions({ storage }, { dest: '' }).storage).toBe(storage);
  });
});

describe('transformException', () => {
  const fastifyError = (code: string | undefined, message = 'x', extra = {}) =>
    Object.assign(new Error(message), { code, ...extra });

  it('should pass through a missing error', () => {
    expect(transformException(undefined)).toBeUndefined();
  });

  it('should pass through an HttpException', () => {
    const error = new HttpException('x', 418);
    expect(transformException(error)).toBe(error);
  });

  it('should pass through an unknown error', () => {
    const error = new Error('boom');
    expect(transformException(error)).toBe(error);
  });

  it.each([
    ['FST_FILES_LIMIT', BadRequestException, 'Too many files'],
    ['FST_PARTS_LIMIT', BadRequestException, 'Too many parts'],
    ['FST_FIELDS_LIMIT', BadRequestException, 'Too many fields'],
    ['FST_PROTO_VIOLATION', BadRequestException, 'Invalid field name'],
    ['FST_REQ_FILE_TOO_LARGE', PayloadTooLargeException, 'File too large'],
  ] as const)(
    'should map the @fastify/multipart code %s like multer',
    (code, type, message) => {
      const result = transformException(fastifyError(code));
      expect(result).toBeInstanceOf(type);
      expect(result!.message).toBe(message);
    },
  );

  it('should append the field name carried by the fastify part', () => {
    const result = transformException(
      fastifyError('FST_PROTO_VIOLATION', 'x', { part: { fieldname: 'a' } }),
    );
    expect(result).toBeInstanceOf(BadRequestException);
    expect(result!.message).toBe('Invalid field name - a');
  });

  it('should tolerate a fastify part without a field name', () => {
    expect(
      transformException(fastifyError('FST_PROTO_VIOLATION', 'x', { part: {} }))!
        .message,
    ).toBe('Invalid field name');
  });

  it('should tolerate an error without a part at all', () => {
    expect(
      transformException(fastifyError('FST_FILES_LIMIT'))!.message,
    ).toBe('Too many files');
  });

  it.each(Object.keys(multerExceptions) as Array<keyof typeof multerExceptions>)(
    'should map MultipartError %s to the multer message',
    code => {
      const result = transformException(new MultipartError(code));
      expect(result).toBeInstanceOf(
        code === 'LIMIT_FILE_SIZE'
          ? PayloadTooLargeException
          : BadRequestException,
      );
      expect(result!.message).toBe(multerExceptions[code]);
    },
  );

  it('should append the field name of a MultipartError', () => {
    expect(
      transformException(new MultipartError('LIMIT_UNEXPECTED_FILE', 'f'))!
        .message,
    ).toBe('Unexpected file field - f');
  });

  it.each(['FST_MP_PREMATURE_CLOSE', 'FST_INVALID_JSON_FIELD_ERROR'])(
    'should report %s as a 400 with its own message',
    code => {
      expect(transformException(fastifyError(code, 'msg'))).toEqual(
        new BadRequestException('msg'),
      );
    },
  );

  it('should pass through an error with an unknown string code', () => {
    const error = fastifyError('FST_UNKNOWN', 'msg');
    expect(transformException(error)).toBe(error);
  });

  it('should pass through an error with a non-string code', () => {
    const error = Object.assign(new Error('msg'), { code: 42 });
    expect(transformException(error as any)).toBe(error);
  });

  it('should not treat an inherited Object property as a fastify code', () => {
    const error = fastifyError('toString', 'msg');
    expect(transformException(error)).toBe(error);
  });

  it.each([
    ['Multipart: Boundary not found', 'Multipart: Boundary not found'],
    ['Unexpected end of multipart data', 'Multipart: Unexpected end of form'],
    [
      'Part terminated early due to unexpected end of multipart data',
      'Multipart: Unexpected end of form',
    ],
  ])('should rewrite the @fastify/busboy message "%s"', (message, expected) => {
    expect(transformException(new Error(message))).toEqual(
      new BadRequestException(expected),
    );
  });

  it('should use an empty message when the error carries none', () => {
    const error = { code: 'FST_UNKNOWN' } as any;
    expect(transformException(error)).toBe(error);
  });
});
