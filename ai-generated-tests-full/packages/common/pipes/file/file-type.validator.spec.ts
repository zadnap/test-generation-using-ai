import { describe, expect, it } from 'vitest';
import { FileTypeValidator } from '../../../../../packages/common/pipes/file/file-type.validator.js';

const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

const file = (overrides: Record<string, any> = {}) => ({
  mimetype: 'image/png',
  size: 1,
  buffer: png,
  ...overrides,
});

describe('FileTypeValidator', () => {
  describe('isValid', () => {
    it('returns true when there are no validation options', async () => {
      expect(
        await new FileTypeValidator(undefined as any).isValid(file()),
      ).toBe(true);
    });

    it('returns false for a missing or malformed file', async () => {
      const validator = new FileTypeValidator({ fileType: 'image/png' });
      expect(await validator.isValid(undefined)).toBe(false);
      expect(await validator.isValid({} as any)).toBe(false);
    });

    it.each([
      ['matching', 'image/png', 'image/png', true],
      ['mismatching', 'image/gif', 'image/png', false],
      ['exact string', 'audio/wav', 'audio/wav', true],
      ['prefix must end at a name boundary', 'audio/wavpack', 'audio/wav', false],
      ['metacharacter string', 'image/svg+xml', 'image/svg+xml', true],
    ])('compares mimetypes with skipMagicNumbers (%s)', async (_label, mimetype, fileType, expected) => {
      const validator = new FileTypeValidator({
        fileType,
        skipMagicNumbersValidation: true,
      });
      expect(await validator.isValid(file({ mimetype }) as any)).toBe(expected);
    });

    it('matches a RegExp file type', async () => {
      const validator = new FileTypeValidator({
        fileType: /^image\/(png|jpeg)$/,
        skipMagicNumbersValidation: true,
      });
      expect(
        await validator.isValid(file({ mimetype: 'image/png' }) as any),
      ).toBe(true);
      expect(
        await validator.isValid(file({ mimetype: 'image/gif' }) as any),
      ).toBe(false);
    });

    it('falls back to the mimetype when the buffer is missing', async () => {
      const validator = new FileTypeValidator({
        fileType: 'image/png',
        fallbackToMimetype: true,
      });
      expect(
        await validator.isValid({ mimetype: 'image/png', size: 1 } as any),
      ).toBe(true);
    });

    it('rejects a missing buffer when fallback is disabled', async () => {
      const validator = new FileTypeValidator({ fileType: 'image/png' });
      expect(
        await validator.isValid({ mimetype: 'image/png', size: 1 } as any),
      ).toBe(false);
    });

    it('falls back to the mimetype when detection fails', async () => {
      const validator = new FileTypeValidator({
        fileType: 'text/plain',
        fallbackToMimetype: true,
      });
      expect(
        await validator.isValid(
          file({ buffer: Buffer.from('hello'), mimetype: 'text/plain' }) as any,
        ),
      ).toBe(true);
    });

    it('rejects when detection fails and fallback is disabled', async () => {
      const validator = new FileTypeValidator({ fileType: 'text/plain' });
      expect(
        await validator.isValid(
          file({ buffer: Buffer.from('hello'), mimetype: 'text/plain' }) as any,
        ),
      ).toBe(false);
    });

    it('detects the type from content and can override the mimetype', async () => {
      const validator = new FileTypeValidator({
        fileType: 'image/png',
        overrideMimeType: true,
      });
      const input = file({ mimetype: 'application/octet-stream' });
      expect(await validator.isValid(input as any)).toBe(true);
      expect(input.mimetype).toBe('image/png');
    });
  });

  describe('buildErrorMessage', () => {
    it('uses a string error message', () => {
      const validator = new FileTypeValidator({
        fileType: 'image/png',
        errorMessage: 'bad type',
      });
      expect(validator.buildErrorMessage(file())).toBe('bad type');
    });

    it('uses an error message factory', () => {
      const validator = new FileTypeValidator({
        fileType: 'image/png',
        errorMessage: ctx => `got=${ctx.file?.mimetype}`,
      });
      expect(validator.buildErrorMessage(file())).toBe('got=image/png');
    });

    it('reports an unavailable buffer', () => {
      const validator = new FileTypeValidator({ fileType: 'image/png' });
      expect(
        validator.buildErrorMessage({ mimetype: 'image/png', size: 1 } as any),
      ).toContain('file buffer is not available');
    });

    it('reports the detected type', async () => {
      const validator = new FileTypeValidator({ fileType: 'image/gif' });
      const input = file();
      await validator.isValid(input as any);
      expect(validator.buildErrorMessage(input as any)).toContain(
        'current file type is image/png',
      );
    });

    it('reports an undetectable type', async () => {
      const validator = new FileTypeValidator({ fileType: 'image/png' });
      const input = file({ buffer: Buffer.from('hello') });
      await validator.isValid(input as any);
      expect(validator.buildErrorMessage(input as any)).toContain(
        'file type could not be detected',
      );
    });

    it('reports the fallback mimetype when detection failed', async () => {
      const validator = new FileTypeValidator({
        fileType: 'image/png',
        fallbackToMimetype: true,
      });
      const input = file({ buffer: Buffer.from('hello') });
      await validator.isValid(input as any);
      expect(validator.buildErrorMessage(input as any)).toContain(
        'magic number detection failed, used mimetype fallback',
      );
    });

    it('reports the plain mimetype without fallback', async () => {
      const validator = new FileTypeValidator({ fileType: 'image/gif' });
      const input = file();
      await validator.isValid(input as any);
      expect(validator.buildErrorMessage(input as any)).toContain(
        'current file type is image/png, expected type is image/gif',
      );
    });

    it('reports the expected type when no file is present', () => {
      const validator = new FileTypeValidator({ fileType: 'image/png' });
      expect(validator.buildErrorMessage()).toContain(
        'expected type is image/png',
      );
    });
  });
});
