import { lastValueFrom } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { FileInterceptor } from '../../../../../packages/platform-fastify/multipart/interceptors/file.interceptor.js';
import {
  createUploadContext,
  createUploadRequest,
  uploadFieldPart,
  uploadFilePart,
  uploadNext,
  uploadReply,
} from '../upload-test.helper.js';

// FileInterceptor: 0 decision node, 1 independent path (factory covered).
describe('FileInterceptor', () => {
  it('should accept one file and expose it as req.file', async () => {
    const req = createUploadRequest([
      uploadFieldPart('name', 'Ada'),
      uploadFilePart('file', 'hello'),
    ]);
    const interceptor = new (FileInterceptor('file'))();

    const result = await lastValueFrom(
      await interceptor.intercept(createUploadContext(req), uploadNext() as any),
    );

    expect(result).toBe('ok');
    expect(req.body.name).toBe('Ada');
    expect(req.file.fieldname).toBe('file');
    expect(req.file.buffer.toString()).toBe('hello');
    expect(req.files).toBeUndefined();
  });

  it('should allow a request without any file', async () => {
    const req = createUploadRequest([uploadFieldPart('a', '1')]);
    const interceptor = new (FileInterceptor('file'))();
    await lastValueFrom(
      await interceptor.intercept(createUploadContext(req), uploadNext() as any),
    );
    expect(req.file).toBeUndefined();
  });

  it('should reject a second file in the same field', async () => {
    const req = createUploadRequest([
      uploadFilePart('file', 'a'),
      uploadFilePart('file', 'b'),
    ]);
    const interceptor = new (FileInterceptor('file'))();
    await expect(
      interceptor.intercept(createUploadContext(req), uploadNext() as any),
    ).rejects.toThrow('Unexpected file field');
  });

  it('should merge local options over the module options', async () => {
    const req = createUploadRequest([uploadFilePart('file')]);
    const interceptor = new (FileInterceptor('file', { preservePath: true }))(
      { limits: { files: 2 } },
      undefined,
    );
    await lastValueFrom(
      await interceptor.intercept(
        createUploadContext(req, uploadReply()),
        uploadNext() as any,
      ),
    );
    expect(req.file).toBeDefined();
  });
});
