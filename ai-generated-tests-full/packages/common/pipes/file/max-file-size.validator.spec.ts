import { describe, expect, it } from 'vitest';
import { MaxFileSizeValidator } from '../../../../../packages/common/pipes/file/max-file-size.validator.js';

describe('MaxFileSizeValidator', () => {
  describe('isValid', () => {
    it('returns true when options or file are missing', () => {
      expect(new MaxFileSizeValidator(undefined as any).isValid(undefined)).toBe(
        true,
      );
      expect(new MaxFileSizeValidator({ maxSize: 10 }).isValid(undefined)).toBe(
        true,
      );
    });

    it.each([
      ['smaller size', { size: 5, mimetype: 'x' }, true],
      ['equal size', { size: 10, mimetype: 'x' }, false],
      ['larger size', { size: 11, mimetype: 'x' }, false],
      ['file without size', { mimetype: 'x' }, false],
    ])('handles %s', (_label, file, expected) => {
      expect(
        new MaxFileSizeValidator({ maxSize: 10 }).isValid(file as any),
      ).toBe(expected);
    });
  });

  describe('buildErrorMessage', () => {
    it('uses a string errorMessage', () => {
      const validator = new MaxFileSizeValidator({
        maxSize: 10,
        errorMessage: 'too big',
      });
      expect(validator.buildErrorMessage({ size: 11, mimetype: 'x' })).toBe(
        'too big',
      );
    });

    it('uses an errorMessage factory', () => {
      const validator = new MaxFileSizeValidator({
        maxSize: 10,
        errorMessage: ctx => `size=${ctx.file?.size};max=${ctx.config.maxSize}`,
      });
      expect(validator.buildErrorMessage({ size: 11, mimetype: 'x' })).toBe(
        'size=11;max=10',
      );
    });

    it('uses a deprecated string message', () => {
      const validator = new MaxFileSizeValidator({
        maxSize: 10,
        message: 'legacy',
      });
      expect(validator.buildErrorMessage()).toBe('legacy');
    });

    it('uses a deprecated message factory', () => {
      const validator = new MaxFileSizeValidator({
        maxSize: 10,
        message: max => `max=${max}`,
      });
      expect(validator.buildErrorMessage()).toBe('max=10');
    });

    it('describes the actual size when present', () => {
      const validator = new MaxFileSizeValidator({ maxSize: 10 });
      expect(validator.buildErrorMessage({ size: 11, mimetype: 'x' })).toBe(
        'Validation failed (current file size is 11, expected size is less than 10)',
      );
    });

    it('describes the expected size when no file is present', () => {
      const validator = new MaxFileSizeValidator({ maxSize: 10 });
      expect(validator.buildErrorMessage()).toBe(
        'Validation failed (expected size is less than 10)',
      );
    });
  });
});
