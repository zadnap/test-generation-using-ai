import { describe, expect, it } from 'vitest';
import { MaxFileSizeValidator } from '../../../../../packages/common/pipes/file/max-file-size.validator.js';
import type { IFile } from '../../../../../packages/common/pipes/file/interfaces/file.interface.js';

describe('MaxFileSizeValidator (C3)', () => {
  describe('isValid', () => {
    it('returns true when no options are provided', () => {
      const validator = new MaxFileSizeValidator(undefined as any);
      expect(validator.isValid({ size: 100 } as IFile)).toBe(true);
    });

    it('returns true when no file is provided', () => {
      const validator = new MaxFileSizeValidator({ maxSize: 10 });
      expect(validator.isValid()).toBe(true);
      expect(validator.isValid(undefined)).toBe(true);
    });

    it.each([
      ['smaller', 9, true],
      ['equal', 10, false],
      ['larger', 11, false],
      ['zero', 0, true],
    ])('%s size', (_label, size, expected) => {
      const validator = new MaxFileSizeValidator({ maxSize: 10 });
      expect(validator.isValid({ size } as IFile)).toBe(expected);
    });

    it('returns false when the file has no size property', () => {
      const validator = new MaxFileSizeValidator({ maxSize: 10 });
      expect(validator.isValid({ mimetype: 'x' } as any)).toBe(false);
    });
  });

  describe('buildErrorMessage', () => {
    it('uses a static errorMessage', () => {
      const validator = new MaxFileSizeValidator({
        maxSize: 10,
        errorMessage: 'custom',
      });
      expect(validator.buildErrorMessage()).toBe('custom');
    });

    it('uses an errorMessage factory and excludes it from the config', () => {
      const validator = new MaxFileSizeValidator({
        maxSize: 10,
        message: 'deprecated',
        errorMessage: context =>
          `${context.file?.size}-${context.config.maxSize}-${
            'errorMessage' in context.config
          }`,
      });
      expect(
        validator.buildErrorMessage({ size: 20 } as IFile),
      ).toBe('20-10-false');
    });

    it('uses a static deprecated message', () => {
      const validator = new MaxFileSizeValidator({
        maxSize: 10,
        message: 'deprecated static',
      });
      expect(validator.buildErrorMessage()).toBe('deprecated static');
    });

    it('uses a deprecated message factory', () => {
      const validator = new MaxFileSizeValidator({
        maxSize: 10,
        message: maxSize => `limit ${maxSize}`,
      });
      expect(validator.buildErrorMessage()).toBe('limit 10');
    });

    it('includes the current size when the file has a size', () => {
      const validator = new MaxFileSizeValidator({ maxSize: 10 });
      expect(validator.buildErrorMessage({ size: 20 } as IFile)).toBe(
        'Validation failed (current file size is 20, expected size is less than 10)',
      );
    });

    it.each([
      ['missing file', undefined],
      ['zero size', { size: 0 } as IFile],
    ])('uses the expected-size message for %s', (_label, file) => {
      const validator = new MaxFileSizeValidator({ maxSize: 10 });
      expect(validator.buildErrorMessage(file)).toBe(
        'Validation failed (expected size is less than 10)',
      );
    });
  });
});
