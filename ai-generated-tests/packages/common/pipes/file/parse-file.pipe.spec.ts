import { describe, expect, it, vi } from 'vitest';
import {
  ParseFilePipe,
  type ParseFileOptions,
} from '../../../../../packages/common/pipes/file/parse-file.pipe.js';
import { FileValidator } from '../../../../../packages/common/pipes/file/file-validator.interface.js';
import { HttpStatus } from '../../../../../packages/common/enums/http-status.enum.js';
import { ImATeapotException } from '../../../../../packages/common/exceptions/im-a-teapot.exception.js';

class AlwaysValidValidator extends FileValidator {
  isValid = vi.fn(() => true);
  buildErrorMessage = vi.fn(() => 'invalid');
}

class AlwaysInvalidValidator extends FileValidator {
  isValid = vi.fn(() => false);
  buildErrorMessage = vi.fn(() => 'invalid file');
}

class AsyncValidValidator extends FileValidator {
  isValid = vi.fn(async () => true);
  buildErrorMessage = vi.fn(() => 'invalid');
}

class AsyncInvalidValidator extends FileValidator {
  isValid = vi.fn(async () => false);
  buildErrorMessage = vi.fn(() => 'async invalid');
}

function createPipe(options?: ParseFileOptions) {
  return new ParseFilePipe(options);
}

describe('ParseFilePipe (C3)', () => {
  describe('required and absent files', () => {
    it.each([
      ['undefined', undefined],
      ['null', null],
      ['empty array', []],
      ['empty object', {}],
    ])('throws when %s is required', async (_label, value) => {
      const pipe = createPipe();
      await expect(pipe.transform(value)).rejects.toBeDefined();
    });

    it.each([
      ['undefined', undefined],
      ['null', null],
      ['empty array', []],
      ['empty object', {}],
      ['empty string', ''],
      ['zero', 0],
    ])('returns %s when it is not required', async (_label, value) => {
      const pipe = createPipe({ fileIsRequired: false });
      expect(await pipe.transform(value)).toBe(value);
    });

    it('uses a custom exception factory for a required file', async () => {
      const pipe = createPipe({
        exceptionFactory: () => new ImATeapotException(),
      });
      await expect(pipe.transform(undefined)).rejects.toBeInstanceOf(
        ImATeapotException,
      );
    });

    it('uses the configured status code for a required file', async () => {
      const pipe = createPipe({
        errorHttpStatusCode: HttpStatus.I_AM_A_TEAPOT,
      });
      await expect(pipe.transform(undefined)).rejects.toMatchObject({
        status: HttpStatus.I_AM_A_TEAPOT,
      });
    });

    it('uses the default factory when options are omitted', async () => {
      const pipe = new ParseFilePipe();
      await expect(pipe.transform(undefined)).rejects.toMatchObject({
        status: HttpStatus.BAD_REQUEST,
      });
    });
  });

  describe('file detection', () => {
    it.each([
      ['non-empty object', { path: 'a' }],
      ['non-empty array', [{ path: 'a' }]],
      ['string', 'a'],
      ['number', 1],
      ['boolean', true],
    ])('treats %s as a file', async (_label, value) => {
      const pipe = createPipe({ fileIsRequired: false });
      expect(await pipe.transform(value)).toBe(value);
    });

    it('treats a function as a file', async () => {
      const pipe = createPipe({ fileIsRequired: false });
      const value = () => undefined;
      expect(await pipe.transform(value)).toBe(value);
    });
  });

  describe('validators', () => {
    it('returns the file when there are no validators', async () => {
      const pipe = createPipe({ validators: [] });
      const value = { path: 'a' };
      expect(await pipe.transform(value)).toBe(value);
    });

    it('returns the file when all validators pass', async () => {
      const validator = new AlwaysValidValidator({});
      const pipe = createPipe({ validators: [validator] });
      const value = { path: 'a' };

      expect(await pipe.transform(value)).toBe(value);
      expect(validator.isValid).toHaveBeenCalledWith(value);
    });

    it('runs validators in order for a single file', async () => {
      const first = new AlwaysValidValidator({});
      const second = new AsyncValidValidator({});
      const pipe = createPipe({ validators: [first, second] });
      const value = { path: 'a' };

      expect(await pipe.transform(value)).toBe(value);
      expect(first.isValid).toHaveBeenCalledTimes(1);
      expect(second.isValid).toHaveBeenCalledTimes(1);
    });

    it('throws on the first invalid validator', async () => {
      const valid = new AlwaysValidValidator({});
      const invalid = new AlwaysInvalidValidator({});
      const pipe = createPipe({ validators: [valid, invalid] });

      await expect(pipe.transform({ path: 'a' })).rejects.toThrowError(
        'invalid file',
      );
    });

    it('uses the custom exception factory for a validation failure', async () => {
      const invalid = new AlwaysInvalidValidator({});
      const pipe = createPipe({
        validators: [invalid],
        exceptionFactory: () => new ImATeapotException(),
      });

      await expect(pipe.transform({ path: 'a' })).rejects.toBeInstanceOf(
        ImATeapotException,
      );
    });

    it('validates every file in an array', async () => {
      const validator = new AsyncValidValidator({});
      const pipe = createPipe({ validators: [validator] });
      const value = [{ path: 'a' }, { path: 'b' }];

      expect(await pipe.transform(value)).toBe(value);
      expect(validator.isValid).toHaveBeenCalledTimes(2);
    });

    it('rejects when an array item is invalid', async () => {
      const invalid = new AsyncInvalidValidator({});
      const pipe = createPipe({ validators: [invalid] });

      await expect(pipe.transform([{ path: 'a' }])).rejects.toThrowError(
        'async invalid',
      );
    });

    it('does not run validators when no file is present and the file is optional', async () => {
      const validator = new AlwaysValidValidator({});
      const pipe = createPipe({
        fileIsRequired: false,
        validators: [validator],
      });

      await pipe.transform(undefined);
      expect(validator.isValid).not.toHaveBeenCalled();
    });

    it('does not run validators for an empty object when the file is optional', async () => {
      const validator = new AlwaysValidValidator({});
      const pipe = createPipe({
        fileIsRequired: false,
        validators: [validator],
      });

      await pipe.transform({});
      expect(validator.isValid).not.toHaveBeenCalled();
    });

    it('does not run validators for an empty array when the file is optional', async () => {
      const validator = new AlwaysValidValidator({});
      const pipe = createPipe({
        fileIsRequired: false,
        validators: [validator],
      });

      await pipe.transform([]);
      expect(validator.isValid).not.toHaveBeenCalled();
    });

    it('exposes the configured validators', () => {
      const validator = new AlwaysValidValidator({});
      const pipe = createPipe({ validators: [validator] });
      expect(pipe.getValidators()).toEqual([validator]);
    });
  });
});
