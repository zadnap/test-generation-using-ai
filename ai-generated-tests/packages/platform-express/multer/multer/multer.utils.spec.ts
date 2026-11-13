/**
 * CFT planning inventory for packages/platform-express/multer/multer/multer.utils.ts.
 * Decisions are numbered separately inside each function in source order.
 * xc1/xc2 identify atomic operands; &&/|| short-circuit before the next operand.
 * Loop and case guards count as decisions. Fallback operands are syntactic
 * planning entries, not independent boolean conditions. P=D+1 follows the
 * requested planning rule; these counts do not prove executable independent paths.
 * Cases exercise feasible T/F and error paths. V8 measures branch coverage,
 * not C3 or MC/DC directly. Nested callbacks have their own entries below.
 * isRejectedByPipes @L30: syntactic D=1, planning P=D+1=2.
 *   if: 1=req?.[REJECTED_BY_PIPES] === true
 * mergeMulterOptions @L52: syntactic D=4, planning P=D+1=5.
 *   if: 1c1=isPlainObject(options.limits) | 1c2=isPlainObject(localOptions.limits)
 *   if: 2c1=localOptions.dest | 2c2=!localOptions.storage
 * applyDefaultLimits @L74: syntactic D=1, planning P=D+1=2.
 *   conditional: 1=typeof limits === 'function'
 * callback @L80: syntactic D=0, planning P=D+1=1.
 * withDefaultLimits @L85: syntactic D=4, planning P=D+1=5.
 *   logical/fallback expression: 1c1=limits?.fieldNestingDepth | 1c2=DEFAULT_FIELD_NAME_LIMITS.fieldNestingDepth
 *   logical/fallback expression: 2c1=limits?.fieldArrayIndexLimit | 2c2=DEFAULT_FIELD_NAME_LIMITS.fieldArrayIndexLimit
 * removeFilesOnPipeRejection @L104: syntactic D=0, planning P=D+1=1.
 * callback @L109: syntactic D=1, planning P=D+1=2.
 *   if: 1=isRejectedByPipes(req)
 * callback @L111: syntactic D=1, planning P=D+1=2.
 *   loop: 1=next iteration
 * callback @L114: syntactic D=0, planning P=D+1=1.
 * callback @L121: syntactic D=0, planning P=D+1=1.
 * storedFiles @L125: syntactic D=4, planning P=D+1=5.
 *   if: 1=file
 *   conditional: 2=Array.isArray(files)
 *   logical/fallback expression: 3c1=files | 3c2={}
 * transformException @L135: syntactic D=20, planning P=D+1=21.
 *   if: 1c1=!error | 1c2=error instanceof HttpException
 *   conditional: 2=isMulterExceptionCode(error.code)
 *   case: 3=multerExceptions.LIMIT_FILE_SIZE
 *   case: 4=multerExceptions.LIMIT_FILE_COUNT
 *   case: 5=multerExceptions.LIMIT_FIELD_KEY
 *   case: 6=multerExceptions.LIMIT_FIELD_VALUE
 *   case: 7=multerExceptions.LIMIT_FIELD_COUNT
 *   case: 8=multerExceptions.LIMIT_FIELD_NESTING
 *   case: 9=multerExceptions.LIMIT_FIELD_ARRAY_INDEX
 *   case: 10=multerExceptions.INVALID_FIELD_NAME
 *   case: 11=multerExceptions.LIMIT_UNEXPECTED_FILE
 *   case: 12=multerExceptions.LIMIT_PART_COUNT
 *   case: 13=multerExceptions.MISSING_FIELD_NAME
 *   if: 14=error.field
 *   case: 15=busboyExceptions.MULTIPART_BOUNDARY_NOT_FOUND
 *   case: 16=busboyExceptions.MULTIPART_MALFORMED_PART_HEADER
 *   case: 17=busboyExceptions.MULTIPART_UNEXPECTED_END_OF_FORM
 *   case: 18=busboyExceptions.MULTIPART_UNEXPECTED_END_OF_FILE
 *   if: 19=error.message?.startsWith(busboyExceptions.UNSUPPORTED_CONTENT_TYPE)
 * isMulterExceptionCode @L188: syntactic D=2, planning P=D+1=3.
 *   logical/fallback expression: 1c1=typeof code === 'string' | 1c2=Object.hasOwn(multerExceptions, code)
 */
import { describe, it } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { of, throwError, lastValueFrom } from 'rxjs';
import { Writable } from 'node:stream';
import { finished } from 'node:stream/promises';
import {
  applyDefaultLimits,
  mergeMulterOptions,
  removeFilesOnPipeRejection,
  transformException,
} from '../../../../../packages/platform-express/multer/multer/multer.utils.js';
import {
  multerExceptions,
  busboyExceptions,
} from '../../../../../packages/platform-express/multer/multer/multer.constants.js';

describe('Multer option utilities', () => {
  describe('mergeMulterOptions', () => {
    it.each([
      { global: undefined, local: undefined },
      { global: { limits: { files: 1 } }, local: {} },
      { global: {}, local: { limits: { fileSize: 2 } } },
      { global: { limits: { files: 1 } }, local: { limits: { fileSize: 2 } } },
      {
        global: { limits: () => ({ files: 1 }) },
        local: { limits: { files: 2 } },
      },
      {
        global: { limits: { files: 1 } },
        local: { limits: () => ({ files: 2 }) },
      },
      { global: { storage: {} }, local: { dest: 'virtual-destination' } },
      {
        global: { storage: {} },
        local: { dest: 'virtual-destination', storage: {} },
      },
    ])('options %j', ({ global, local }) => {
      mergeMulterOptions(global as any, local as any);
    });
  });

  describe('applyDefaultLimits/withDefaultLimits', () => {
    it.each(
      [
        undefined,
        null,
        {},
        { fieldNestingDepth: 0, fieldArrayIndexLimit: 0 },
        { fieldNestingDepth: Infinity, fieldArrayIndexLimit: 1 },
      ].map(limits => ({ limits })),
    )('limits $limits', ({ limits }) => {
      applyDefaultLimits({ limits } as any);
    });
    it.each([undefined, { fieldNestingDepth: 2, fieldArrayIndexLimit: 3 }])(
      'request-specific limits %j',
      limits => {
        const options = applyDefaultLimits({ limits: () => limits } as any);
        options.limits({ method: 'POST' });
      },
    );
  });
});

describe('transformException/isMulterExceptionCode', () => {
  it.each(
    Object.entries(multerExceptions).flatMap(([code, message]) =>
      [undefined, 'upload'].map(field => ({ code, message, field })),
    ),
  )('multer error $code/$field', ({ code, message, field }) => {
    transformException(Object.assign(new Error(message), { code, field }));
    transformException(
      Object.assign(new Error('changed upstream message'), { code, field }),
    );
  });
  it.each(Object.values(busboyExceptions))('busboy message %s', message => {
    transformException(new Error(message));
  });
  it.each([
    undefined,
    null,
    new BadRequestException('already mapped'),
    new Error('ordinary'),
    Object.assign(new Error('ordinary'), { code: 123 }),
    Object.assign(new Error('ordinary'), { code: 'UNKNOWN_CODE' }),
    { message: undefined },
  ])('passthrough %s', error => {
    transformException(error as any);
  });
});

describe('removeFilesOnPipeRejection/isRejectedByPipes/storedFiles', () => {
  it.each([
    { file: { fieldname: 'upload' } },
    { files: [{ fieldname: 'first' }, { fieldname: 'second' }] },
    { files: { upload: [{ fieldname: 'upload' }] } },
    { files: [] },
    {},
  ])('stored request %j', async stored => {
    const req = { ...stored, [Symbol.for('nestjs:rejected-by-pipes')]: true };
    const res = new Writable({
      write(_chunk, _encoding, callback) {
        callback();
      },
    });
    const storage = {
      _removeFile(_req: unknown, _file: unknown, callback: Function) {
        callback();
      },
    };
    await lastValueFrom(
      throwError(() => new Error('pipes rejected')).pipe(
        removeFilesOnPipeRejection(storage, req, res),
      ),
    ).catch(() => undefined);
    res.end();
    await finished(res);
  });

  it('handles a storage removal exception after response completion', async () => {
    const req = { file: {}, [Symbol.for('nestjs:rejected-by-pipes')]: true };
    const res = new Writable({
      write(_chunk, _encoding, callback) {
        callback();
      },
    });
    const storage = {
      _removeFile() {
        throw new Error('cleanup failed');
      },
    };
    await lastValueFrom(
      throwError(() => new Error('pipes')).pipe(
        removeFilesOnPipeRejection(storage, req, res),
      ),
    ).catch(() => undefined);
    res.end();
    await finished(res);
  });

  it.each([undefined, {}, { [Symbol.for('nestjs:rejected-by-pipes')]: false }])(
    'unmarked request %j',
    async req => {
      await lastValueFrom(
        throwError(() => new Error('handler')).pipe(
          removeFilesOnPipeRejection({}, req, {}),
        ),
      ).catch(() => undefined);
    },
  );
  it('passes successful handler output', async () => {
    await lastValueFrom(
      of('value').pipe(removeFilesOnPipeRejection({}, {}, {})),
    );
  });
});
