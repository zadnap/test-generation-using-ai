import { lastValueFrom } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { NoFilesInterceptor } from '../../../../../packages/platform-fastify/multipart/interceptors/no-files.interceptor.js';
import {
  createUploadContext,
  createUploadRequest,
  uploadFieldPart,
  uploadFilePart,
  uploadNext,
} from '../upload-test.helper.js';

// NoFilesInterceptor: 0 decision node, 1 independent path.
describe('NoFilesInterceptor', () => {
  it('should accept text fields only', async () => {
    const req = createUploadRequest([
      uploadFieldPart('a', '1'),
      uploadFieldPart('b', '2'),
    ]);
    const interceptor = new (NoFilesInterceptor())();
    await lastValueFrom(
      await interceptor.intercept(createUploadContext(req), uploadNext() as any),
    );
    expect({ ...req.body }).toEqual({ a: '1', b: '2' });
    expect(req.file).toBeUndefined();
    expect(req.files).toBeUndefined();
  });

  it('should reject any file', async () => {
    const req = createUploadRequest([uploadFilePart('file')]);
    const interceptor = new (NoFilesInterceptor())();
    await expect(
      interceptor.intercept(createUploadContext(req), uploadNext() as any),
    ).rejects.toThrow('Unexpected file field');
  });
});
