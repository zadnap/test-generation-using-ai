import { Writable } from 'stream';
import { firstValueFrom, throwError } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  BadRequestException,
  HttpException,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import {
  applyDefaultLimits,
  mergeMulterOptions,
  removeFilesOnPipeRejection,
  transformException,
} from '../../../../../packages/platform-node/multer/multer/multer.utils.js';
import {
  DEFAULT_FIELD_NAME_LIMITS,
  busboyExceptions,
  multerExceptions,
} from '../../../../../packages/platform-node/multer/multer/multer.constants.js';

const REJECTED = Symbol.for('nestjs:rejected-by-pipes');

afterEach(() => {
  vi.restoreAllMocks();
});

// CFG (C3) of mergeMulterOptions:
//   1  isPlainObject(options.limits)                 T/F (short-circuit)
//   2  isPlainObject(localOptions.limits)            T/F
//   3c1 localOptions.dest                            T/F
//   3c2 !localOptions.storage                        T/F (only when 3c1 T)
describe('mergeMulterOptions', () => {
  it('should merge local options over global ones', () => {
    expect(
      mergeMulterOptions({ preservePath: true }, { preservePath: false }),
    ).toEqual({ preservePath: false });
  });

  it('should use empty objects by default', () => {
    expect(mergeMulterOptions()).toEqual({});
    expect(mergeMulterOptions({}, {})).toEqual({});
  });

  it('should merge plain-object limits key by key', () => {
    expect(
      mergeMulterOptions(
        { limits: { fileSize: 1, files: 2 } },
        { limits: { fileSize: 3 } },
      ),
    ).toEqual({ limits: { fileSize: 3, files: 2 } });
  });

  it.each([
    ['global only', { limits: { fileSize: 1 } }, {}],
    ['local only', {}, { limits: { fileSize: 2 } }],
    ['global function', { limits: () => ({}) }, { limits: { fileSize: 2 } }],
    ['local function', { limits: { fileSize: 1 } }, { limits: () => ({}) }],
    ['both functions', { limits: () => ({}) }, { limits: () => ({}) }],
  ])('should let the local limits win when %s is not a plain object', (_, gp, lp) => {
    expect(mergeMulterOptions(gp as any, lp as any).limits).toBe(
      lp.limits ?? gp.limits,
    );
  });

  it('should drop a global storage engine when a local dest is set', () => {
    expect(
      mergeMulterOptions(
        { storage: { engine: true }, dest: 'global' },
        { dest: 'local' },
      ),
    ).toEqual({ dest: 'local' });
  });

  it('should keep global storage when local storage is set too', () => {
    const storage = { engine: true };
    expect(
      mergeMulterOptions({ storage }, { dest: 'local', storage }),
    ).toEqual({ storage, dest: 'local' });
  });
});

// CFG (C3) of applyDefaultLimits:
//   1  typeof limits === 'function'                  T/F
//   2c1 limits?.fieldNestingDepth ?? default         T/F
//   2c2 limits?.fieldArrayIndexLimit ?? default      T/F
describe('applyDefaultLimits', () => {
  it('should add the missing default limits', () => {
    expect(applyDefaultLimits({}).limits).toEqual(DEFAULT_FIELD_NAME_LIMITS);
  });

  it('should keep explicit limits', () => {
    const limits = {
      fieldNestingDepth: 1,
      fieldArrayIndexLimit: 2,
      fileSize: 3,
    };
    expect(applyDefaultLimits({ limits }).limits).toEqual(limits);
  });

  it('should fill only the missing limit', () => {
    expect(
      applyDefaultLimits({ limits: { fieldNestingDepth: 5 } }).limits,
    ).toEqual({
      fieldNestingDepth: 5,
      fieldArrayIndexLimit: DEFAULT_FIELD_NAME_LIMITS.fieldArrayIndexLimit,
    });
  });

  it('should wrap a function-valued limits', () => {
    const limits = vi.fn(req => ({ fileSize: req.size }));
    const result = applyDefaultLimits({ limits });
    const resolved = (result.limits as Function)({ size: 10 });
    expect(limits).toHaveBeenCalledWith({ size: 10 });
    expect(resolved).toEqual({
      fileSize: 10,
      ...DEFAULT_FIELD_NAME_LIMITS,
    });
  });

  it('should handle a function returning undefined', () => {
    const result = applyDefaultLimits({ limits: () => undefined as any });
    expect((result.limits as Function)({})).toEqual(DEFAULT_FIELD_NAME_LIMITS);
  });

  it('should handle null limits from a function', () => {
    const result = applyDefaultLimits({ limits: () => null as any });
    expect((result.limits as Function)({})).toEqual(DEFAULT_FIELD_NAME_LIMITS);
  });
});

// CFG (C3) of transformException:
//   1  !error || HttpException                       T/F
//   2  isMulterExceptionCode(error.code)             T/F
//   3  error.field                                   T/F
//   4  exception matches a status branch            several T/F
//   5  message starts with unsupported content type  T/F
describe('transformException', () => {
  it.each([[undefined], [null]])(
    'should return a falsy error unchanged (%s)',
    error => {
      expect(transformException(error as any)).toBe(error);
    },
  );

  it('should return an HttpException unchanged', () => {
    const error = new HttpException('x', 400);
    expect(transformException(error)).toBe(error);
  });

  it('should map a file size error to PayloadTooLargeException', () => {
    const error = Object.assign(new Error('File too large'), {
      code: 'LIMIT_FILE_SIZE',
    });
    const result = transformException(error);
    expect(result).toBeInstanceOf(PayloadTooLargeException);
    expect((result as any).cause).toBe(error);
  });

  it.each([
    'LIMIT_FILE_COUNT',
    'LIMIT_FIELD_KEY',
    'LIMIT_FIELD_VALUE',
    'LIMIT_FIELD_COUNT',
    'LIMIT_FIELD_NESTING',
    'LIMIT_FIELD_ARRAY_INDEX',
    'INVALID_FIELD_NAME',
    'LIMIT_UNEXPECTED_FILE',
    'LIMIT_PART_COUNT',
    'MISSING_FIELD_NAME',
  ])('should map %s to BadRequestException', code => {
    const error = Object.assign(new Error('message'), { code });
    expect(transformException(error)).toBeInstanceOf(BadRequestException);
  });

  it('should append the field when the error has one', () => {
    const error = Object.assign(new Error('Unexpected field'), {
      code: 'LIMIT_UNEXPECTED_FILE',
      field: 'avatar',
    });
    const result = transformException(error) as BadRequestException;
    expect(result.message).toBe('Unexpected field - avatar');
  });

  it('should map a busboy boundary error to BadRequestException', () => {
    const error = new Error('Boundary not found');
    error.message = busboyExceptions.MULTIPART_BOUNDARY_NOT_FOUND;
    expect(transformException(error)).toBeInstanceOf(BadRequestException);
  });

  it.each([
    busboyExceptions.MULTIPART_MALFORMED_PART_HEADER,
    busboyExceptions.MULTIPART_UNEXPECTED_END_OF_FORM,
    busboyExceptions.MULTIPART_UNEXPECTED_END_OF_FILE,
  ])('should prefix the message of a malformed multipart error', message => {
    const result = transformException(new Error(message)) as BadRequestException;
    expect(result.message).toBe(`Multipart: ${message}`);
  });

  it('should map an unsupported content type to 415', () => {
    const error = new Error(
      `${busboyExceptions.UNSUPPORTED_CONTENT_TYPE} multipart/mixed`,
    );
    const result = transformException(error);
    expect(result).toBeInstanceOf(UnsupportedMediaTypeException);
    expect(result.message).toBe(busboyExceptions.UNSUPPORTED_CONTENT_TYPE);
  });

  it('should keep a message that merely starts with a non-busboy code', () => {
    const error = Object.assign(new Error('Too many parts?'), {
      code: 'STREAM_DESTROYED',
    });
    expect(transformException(error)).toBe(error);
  });

  it('should map a non-multer code by its message', () => {
    const error = Object.assign(new Error(multerExceptions.LIMIT_FILE_SIZE), {
      code: 'UNKNOWN',
    });
    expect(transformException(error)).toBeInstanceOf(PayloadTooLargeException);
  });

  it('should return an unknown error unchanged', () => {
    const error = new Error('boom');
    expect(transformException(error)).toBe(error);
  });

  it('should handle a multer code that maps to no status branch', () => {
    const error = Object.assign(new Error('Unknown code'), { code: 'NOPE' });
    expect(transformException(error)).toBe(error);
  });
});

describe('removeFilesOnPipeRejection', () => {
  const run = async (req: any, res: any, storage: any) => {
    const operator = removeFilesOnPipeRejection(storage, req, res);
    const error = new Error('pipe rejected');
    await expect(
      firstValueFrom(throwError(() => error).pipe(operator)),
    ).rejects.toBe(error);
  };

  it('should remove a single req.file when the request was rejected by pipes', async () => {
    const file = { path: 'a' };
    const storage = { _removeFile: vi.fn((_req, _file, cb) => cb()) };
    const res = new Writable({ write(_chunk, _encoding, callback) { callback(); } });
    await run({ [REJECTED]: true, file }, res, storage);
    res.end();
    await new Promise(resolve => setImmediate(resolve));
    expect(storage._removeFile).toHaveBeenCalledWith(
      expect.anything(),
      file,
      expect.any(Function),
    );
  });

  it('should remove every file of req.files', async () => {
    const storage = { _removeFile: vi.fn((_req, _file, cb) => cb()) };
    const res = new Writable({ write(_chunk, _encoding, callback) { callback(); } });
    await run(
      { [REJECTED]: true, files: { a: [{ n: 1 }], b: [{ n: 2 }] } },
      res,
      storage,
    );
    res.end();
    await new Promise(resolve => setImmediate(resolve));
    expect(storage._removeFile).toHaveBeenCalledTimes(2);
  });

  it('should remove files from an array req.files', async () => {
    const storage = { _removeFile: vi.fn((_req, _file, cb) => cb()) };
    const res = new Writable({ write(_chunk, _encoding, callback) { callback(); } });
    await run({ [REJECTED]: true, files: [{ n: 1 }, { n: 2 }] }, res, storage);
    res.end();
    await new Promise(resolve => setImmediate(resolve));
    expect(storage._removeFile).toHaveBeenCalledTimes(2);
  });

  it('should do nothing without req.files', async () => {
    const storage = { _removeFile: vi.fn() };
    const res = new Writable({ write(_chunk, _encoding, callback) { callback(); } });
    await run({ [REJECTED]: true }, res, storage);
    res.end();
    await new Promise(resolve => setImmediate(resolve));
    expect(storage._removeFile).not.toHaveBeenCalled();
  });

  it('should not remove files when the request was not rejected by pipes', async () => {
    const storage = { _removeFile: vi.fn() };
    const res = new Writable({ write(_chunk, _encoding, callback) { callback(); } });
    await run({ file: {} }, res, storage);
    res.end();
    await new Promise(resolve => setImmediate(resolve));
    expect(storage._removeFile).not.toHaveBeenCalled();
  });

  it('should ignore errors thrown by the storage cleanup', async () => {
    const storage = {
      _removeFile: vi.fn(() => {
        throw new Error('cleanup failed');
      }),
    };
    const res = new Writable({ write(_chunk, _encoding, callback) { callback(); } });
    await run({ [REJECTED]: true, file: {} }, res, storage);
    res.end();
    await new Promise(resolve => setImmediate(resolve));
    expect(storage._removeFile).toHaveBeenCalled();
  });
});
