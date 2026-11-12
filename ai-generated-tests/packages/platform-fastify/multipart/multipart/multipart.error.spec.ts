import { describe, expect, it } from 'vitest';
import { multerExceptions } from '../../../../../packages/platform-fastify/multipart/multipart/multipart.constants.js';
import { MultipartError } from '../../../../../packages/platform-fastify/multipart/multipart/multipart.error.js';

// MultipartError: 0 decision node, 1 independent path.
describe('MultipartError', () => {
  it.each(Object.keys(multerExceptions) as Array<keyof typeof multerExceptions>)(
    'should build a named error with the multer message for %s',
    code => {
      const error = new MultipartError(code);
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('MultipartError');
      expect(error.code).toBe(code);
      expect(error.message).toBe(multerExceptions[code]);
      expect(error.field).toBeUndefined();
    },
  );

  it('should keep the offending field name', () => {
    const error = new MultipartError('LIMIT_UNEXPECTED_FILE', 'avatar');
    expect(error.field).toBe('avatar');
    expect(error.message).toBe('Unexpected file field');
  });

  it('should be throwable and catchable as an Error', () => {
    expect(() => {
      throw new MultipartError('LIMIT_FILE_COUNT');
    }).toThrow('Too many files');
  });
});
