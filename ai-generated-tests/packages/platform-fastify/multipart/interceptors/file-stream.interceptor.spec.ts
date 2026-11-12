import { StreamableFile } from '@nestjs/common';
import { lastValueFrom } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { FileStreamInterceptor } from '../../../../../packages/platform-fastify/multipart/interceptors/file-stream.interceptor.js';
import {
  createUploadContext,
  createUploadRequest,
  uploadFieldPart,
  uploadFilePart,
  uploadNext,
  uploadReply,
} from '../upload-test.helper.js';

// FileStreamInterceptor: 0 decision node, 1 independent path.
describe('FileStreamInterceptor', () => {
  it('should hand over the stream of the named field', async () => {
    const req = createUploadRequest([
      uploadFieldPart('name', 'Ada'),
      uploadFilePart('file', 'streamed'),
    ]);
    const interceptor = new (FileStreamInterceptor('file'))();
    await lastValueFrom(
      await interceptor.intercept(
        createUploadContext(req, uploadReply()),
        uploadNext() as any,
      ),
    );
    expect(req.body.name).toBe('Ada');
    expect(req.file.stream).toBeDefined();
    expect(req.file.originalname).toBe('file.txt');
  });

  it('should reject a file in a different field', async () => {
    const req = createUploadRequest([uploadFilePart('other')]);
    const interceptor = new (FileStreamInterceptor('file'))();
    await expect(
      interceptor.intercept(
        createUploadContext(req, uploadReply()),
        uploadNext() as any,
      ),
    ).rejects.toThrow('Unexpected file field');
  });

  it('should keep a StreamableFile result', async () => {
    const req = createUploadRequest([uploadFilePart('file')]);
    const streamable = new StreamableFile(Buffer.from('x'));
    const interceptor = new (FileStreamInterceptor('file'))();
    const result = await lastValueFrom(
      await interceptor.intercept(
        createUploadContext(req, uploadReply()),
        uploadNext(streamable) as any,
      ),
    );
    expect(result).toBe(streamable);
  });

  it('should accept local options without dest or storage', async () => {
    const req = createUploadRequest([uploadFilePart('file')]);
    const interceptor = new (
      FileStreamInterceptor('file', { limits: { fileSize: 10 } })
    )();
    await lastValueFrom(
      await interceptor.intercept(
        createUploadContext(req, uploadReply()),
        uploadNext() as any,
      ),
    );
    expect(req.file).toBeDefined();
  });
});
