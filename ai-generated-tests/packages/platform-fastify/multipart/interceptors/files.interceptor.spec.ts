import { lastValueFrom } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { FilesInterceptor } from '../../../../../packages/platform-fastify/multipart/interceptors/files.interceptor.js';
import {
  createUploadContext,
  createUploadRequest,
  uploadFilePart,
  uploadNext,
  uploadReply,
} from '../upload-test.helper.js';

// FilesInterceptor: 0 decision node, 1 independent path.
describe('FilesInterceptor', () => {
  it('should accept up to maxCount files', async () => {
    const req = createUploadRequest([
      uploadFilePart('files', 'a'),
      uploadFilePart('files', 'b'),
    ]);
    const interceptor = new (FilesInterceptor('files', 2))();
    await lastValueFrom(
      await interceptor.intercept(
        createUploadContext(req, uploadReply()),
        uploadNext() as any,
      ),
    );
    expect(req.files).toHaveLength(2);
  });

  it('should reject a file beyond maxCount', async () => {
    const req = createUploadRequest([
      uploadFilePart('files'),
      uploadFilePart('files'),
      uploadFilePart('files'),
    ]);
    const interceptor = new (FilesInterceptor('files', 2))();
    await expect(
      interceptor.intercept(createUploadContext(req), uploadNext() as any),
    ).rejects.toThrow('Unexpected file field');
  });

  it('should accept an unlimited number of files without maxCount', async () => {
    const req = createUploadRequest([
      uploadFilePart('files'),
      uploadFilePart('files'),
      uploadFilePart('files'),
    ]);
    const interceptor = new (FilesInterceptor('files'))();
    await lastValueFrom(
      await interceptor.intercept(createUploadContext(req), uploadNext() as any),
    );
    expect(req.files).toHaveLength(3);
  });

  it('should reject a file in another field', async () => {
    const req = createUploadRequest([uploadFilePart('other')]);
    const interceptor = new (FilesInterceptor('files', 1))();
    await expect(
      interceptor.intercept(createUploadContext(req), uploadNext() as any),
    ).rejects.toThrow('Unexpected file field');
  });
});
