import { describe, expect, it } from 'vitest';
import { FileTypeValidator } from '../../../../../packages/common/pipes/file/file-type.validator.js';
import type { IFile } from '../../../../../packages/common/pipes/file/interfaces/file.interface.js';

const pngBuffer = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49,
  0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06,
  0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44,
  0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00, 0x05, 0x00, 0x01, 0x0d,
  0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42,
  0x60, 0x82,
]);

const unknownBuffer = Buffer.from([0x01, 0x02, 0x03, 0x04]);

function throwingBuffer(message: unknown): Buffer {
  return new Proxy(new Uint8Array([1, 2, 3, 4]), {
    get(target, property, receiver) {
      if (property === 'length') {
        throw message;
      }
      return Reflect.get(target, property, receiver);
    },
  }) as any;
}

describe('FileTypeValidator (C3)', () => {
  describe('isValid', () => {
    it('returns true without validation options', async () => {
      const validator = new FileTypeValidator(undefined as any);
      expect(await validator.isValid()).toBe(true);
    });

    it('returns false without a file', async () => {
      const validator = new FileTypeValidator({ fileType: 'image/png' });
      expect(await validator.isValid()).toBe(false);
      expect(await validator.isValid({} as IFile)).toBe(false);
    });

    it('detects a matching type from the buffer', async () => {
      const validator = new FileTypeValidator({ fileType: 'image/png' });
      const file = { mimetype: 'image/png', size: 10, buffer: pngBuffer };
      expect(await validator.isValid(file)).toBe(true);
      expect(file.mimetype).toBe('image/png');
    });

    it('does not match a different detected type', async () => {
      const validator = new FileTypeValidator({ fileType: 'image/jpeg' });
      expect(
        await validator.isValid({
          mimetype: 'image/png',
          size: 10,
          buffer: pngBuffer,
        }),
      ).toBe(false);
    });

    it('overrides the mimetype when overrideMimeType is enabled', async () => {
      const validator = new FileTypeValidator({
        fileType: 'image/png',
        overrideMimeType: true,
      });
      const file = { mimetype: 'application/octet-stream', size: 10, buffer: pngBuffer };
      expect(await validator.isValid(file)).toBe(true);
      expect(file.mimetype).toBe('image/png');
    });

    it('keeps the mimetype when overrideMimeType is disabled', async () => {
      const validator = new FileTypeValidator({ fileType: 'image/png' });
      const file = { mimetype: 'application/octet-stream', size: 10, buffer: pngBuffer };
      expect(await validator.isValid(file)).toBe(true);
      expect(file.mimetype).toBe('application/octet-stream');
    });

    it('skips magic numbers and matches the declared mimetype', async () => {
      const validator = new FileTypeValidator({
        fileType: 'image/png',
        skipMagicNumbersValidation: true,
      });
      expect(
        await validator.isValid({ mimetype: 'image/png', size: 10 } as IFile),
      ).toBe(true);
      expect(
        await validator.isValid({ mimetype: 'image/jpeg', size: 10 } as IFile),
      ).toBe(false);
      expect(
        await validator.isValid({ size: 10 } as IFile),
      ).toBe(false);
    });

    it('falls back to the mimetype when there is no buffer', async () => {
      const fallback = new FileTypeValidator({
        fileType: 'image/png',
        fallbackToMimetype: true,
      });
      const noFallback = new FileTypeValidator({ fileType: 'image/png' });

      expect(
        await fallback.isValid({ mimetype: 'image/png', size: 10 } as IFile),
      ).toBe(true);
      expect(
        await fallback.isValid({ mimetype: 'image/jpeg', size: 10 } as IFile),
      ).toBe(false);
      expect(
        await noFallback.isValid({ mimetype: 'image/png', size: 10 } as IFile),
      ).toBe(false);
    });

    it('falls back to the mimetype when detection returns no type', async () => {
      const fallback = new FileTypeValidator({
        fileType: 'image/png',
        fallbackToMimetype: true,
      });
      const noFallback = new FileTypeValidator({ fileType: 'image/png' });

      expect(
        await fallback.isValid({
          mimetype: 'image/png',
          size: 4,
          buffer: unknownBuffer,
        }),
      ).toBe(true);
      expect(
        await fallback.isValid({
          mimetype: 'image/jpeg',
          size: 4,
          buffer: unknownBuffer,
        }),
      ).toBe(false);
      expect(
        await noFallback.isValid({
          mimetype: 'image/png',
          size: 4,
          buffer: unknownBuffer,
        }),
      ).toBe(false);
    });

    it('falls back and warns when the file-type package cannot be used', async () => {
      const fallback = new FileTypeValidator({
        fileType: 'image/png',
        fallbackToMimetype: true,
      });
      const noFallback = new FileTypeValidator({ fileType: 'image/png' });

      expect(
        await fallback.isValid({
          mimetype: 'image/png',
          size: 4,
          buffer: throwingBuffer(new Error('Cannot find module file-type')),
        }),
      ).toBe(true);
      expect(
        await noFallback.isValid({
          mimetype: 'image/png',
          size: 4,
          buffer: throwingBuffer('not a module problem'),
        }),
      ).toBe(false);
    });

    it('handles a non-Error value thrown by the file-type package', async () => {
      const fallback = new FileTypeValidator({
        fileType: 'image/png',
        fallbackToMimetype: true,
      });

      expect(
        await fallback.isValid({
          mimetype: 'image/png',
          size: 4,
          buffer: throwingBuffer('ERR_MODULE_NOT_FOUND'),
        }),
      ).toBe(true);
    });

    it.each([
      ['exact string', 'image/png', 'image/png', true],
      ['string suffix', 'png', 'image/png', true],
      ['string suffix boundary', 'png', 'image/pngx', false],
      ['wav boundary', 'audio/wav', 'audio/wavpack', false],
      ['string ending in punctuation', 'image/', 'image/png', true],
      ['metacharacter string', 'image/svg+', 'image/svg+', true],
      ['regexp', /^image\/(png|jpeg)$/, 'image/png', true],
      ['non matching regexp', /^image\/(png|jpeg)$/, 'text/plain', false],
    ])(
      'matches a %s',
      async (_label, fileType, mimetype, expected) => {
        const validator = new FileTypeValidator({
          fileType,
          skipMagicNumbersValidation: true,
        });
        expect(await validator.isValid({ mimetype, size: 1 } as IFile)).toBe(
          expected,
        );
      },
    );

    it('does not mutate a stateful regexp', async () => {
      const fileType = /^image\/png$/g;
      fileType.lastIndex = 2;
      const validator = new FileTypeValidator({
        fileType,
        skipMagicNumbersValidation: true,
      });

      expect(
        await validator.isValid({ mimetype: 'image/png', size: 1 } as IFile),
      ).toBe(true);
      expect(
        await validator.isValid({ mimetype: 'image/jpeg', size: 1 } as IFile),
      ).toBe(false);
      expect(fileType.lastIndex).toBe(2);
    });
  });

  describe('buildErrorMessage', () => {
    it('uses a static custom error message', () => {
      const validator = new FileTypeValidator({
        fileType: 'image/png',
        errorMessage: 'custom',
      });
      expect(validator.buildErrorMessage()).toBe('custom');
    });

    it('uses a dynamic error message and excludes it from the config', () => {
      const validator = new FileTypeValidator({
        fileType: 'image/png',
        errorMessage: context =>
          `${context.file?.mimetype}-${context.config.fileType}-${
            'errorMessage' in context.config
          }`,
      });
      expect(
        validator.buildErrorMessage({ mimetype: 'image/jpeg' } as IFile),
      ).toBe('image/jpeg-image/png-false');
    });

    it('reports a missing buffer when fallback and skipping are disabled', () => {
      const validator = new FileTypeValidator({ fileType: 'image/png' });
      expect(validator.buildErrorMessage({ mimetype: 'image/png' } as IFile)).toContain(
        'file buffer is not available',
      );
    });

    it.each([
      ['fallback', { fileType: 'image/png', fallbackToMimetype: true }],
      ['skipping', { fileType: 'image/png', skipMagicNumbersValidation: true }],
    ])('does not report a missing buffer when using %s', (_label, options) => {
      const validator = new FileTypeValidator(options as any);
      expect(
        validator.buildErrorMessage({ mimetype: 'image/png' } as IFile),
      ).not.toContain('file buffer is not available');
    });

    it('does not report a missing buffer without a mimetype or with a buffer', () => {
      const validator = new FileTypeValidator({ fileType: 'image/png' });
      expect(validator.buildErrorMessage({ size: 1 } as IFile)).toBe(
        'Validation failed (expected type is image/png)',
      );
      expect(
        validator.buildErrorMessage({
          mimetype: 'image/png',
          buffer: pngBuffer,
        } as IFile),
      ).toContain('current file type is image/png');
    });

    it('reports the detected type after validation', async () => {
      const validator = new FileTypeValidator({ fileType: 'image/jpeg' });
      const file = {
        mimetype: 'image/png',
        size: pngBuffer.length,
        buffer: pngBuffer,
      };
      await validator.isValid(file);

      expect(validator.buildErrorMessage(file)).toContain(
        'current file type is image/png',
      );
    });

    it('reports an undetectable type when detection returned null', async () => {
      const validator = new FileTypeValidator({ fileType: 'image/png' });
      const file = {
        mimetype: 'image/png',
        size: unknownBuffer.length,
        buffer: unknownBuffer,
      };
      await validator.isValid(file);

      expect(validator.buildErrorMessage(file)).toContain(
        'file type could not be detected',
      );
    });

    it('reports a mimetype fallback when detection returned null and fallback is enabled', async () => {
      const validator = new FileTypeValidator({
        fileType: 'image/jpeg',
        fallbackToMimetype: true,
      });
      const file = {
        mimetype: 'image/png',
        size: unknownBuffer.length,
        buffer: unknownBuffer,
      };
      await validator.isValid(file);

      expect(validator.buildErrorMessage(file)).toContain(
        'used mimetype fallback',
      );
    });

    it('does not report a mimetype fallback when magic numbers are skipped', () => {
      const validator = new FileTypeValidator({
        fileType: 'image/png',
        fallbackToMimetype: true,
        skipMagicNumbersValidation: true,
      });
      expect(
        validator.buildErrorMessage({ mimetype: 'image/jpeg' } as IFile),
      ).not.toContain('used mimetype fallback');
    });

    it('reports the declared mimetype without a fallback note', () => {
      const validator = new FileTypeValidator({ fileType: 'image/jpeg' });
      expect(
        validator.buildErrorMessage({
          mimetype: 'image/png',
          buffer: pngBuffer,
        } as IFile),
      ).toBe(
        'Validation failed (current file type is image/png, expected type is image/jpeg)',
      );
    });

    it('reports the expected type without a file', () => {
      const validator = new FileTypeValidator({ fileType: /png/ });
      expect(validator.buildErrorMessage()).toBe(
        'Validation failed (expected type is /png/)',
      );
    });
  });
});
