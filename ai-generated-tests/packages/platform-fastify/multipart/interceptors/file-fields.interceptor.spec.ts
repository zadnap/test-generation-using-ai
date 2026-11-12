import { lastValueFrom } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { FileFieldsInterceptor } from '../../../../../packages/platform-fastify/multipart/interceptors/file-fields.interceptor.js';
import {
  createUploadContext,
  createUploadRequest,
  uploadFilePart,
  uploadNext,
} from '../upload-test.helper.js';

// FileFieldsInterceptor: 0 decision node, 1 independent path.
describe('FileFieldsInterceptor', () => {
  it('should group files by field name', async () => {
    const req = createUploadRequest([
      uploadFilePart('avatar'),
      uploadFilePart('docs'),
      uploadFilePart('avatar'),
    ]);
    const interceptor = new (
      FileFieldsInterceptor([
        { name: 'avatar', maxCount: 2 },
        { name: 'docs', maxCount: 1 },
      ])
    )();
    await lastValueFrom(
      await interceptor.intercept(createUploadContext(req), uploadNext() as any),
    );
    expect(req.files.avatar).toHaveLength(2);
    expect(req.files.docs).toHaveLength(1);
  });

  it('should enforce maxCount per field', async () => {
    const req = createUploadRequest([
      uploadFilePart('avatar'),
      uploadFilePart('avatar'),
    ]);
    const interceptor = new (
      FileFieldsInterceptor([{ name: 'avatar', maxCount: 1 }])
    )();
    await expect(
      interceptor.intercept(createUploadContext(req), uploadNext() as any),
    ).rejects.toThrow('Unexpected file field');
  });

  it('should reject an undeclared field', async () => {
    const req = createUploadRequest([uploadFilePart('other')]);
    const interceptor = new (
      FileFieldsInterceptor([{ name: 'avatar', maxCount: 1 }])
    )();
    await expect(
      interceptor.intercept(createUploadContext(req), uploadNext() as any),
    ).rejects.toThrow('Unexpected file field');
  });
});
