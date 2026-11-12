import { lastValueFrom } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { AnyFilesInterceptor } from '../../../../../packages/platform-fastify/multipart/interceptors/any-files.interceptor.js';
import {
  createUploadContext,
  createUploadRequest,
  uploadFilePart,
  uploadNext,
} from '../upload-test.helper.js';

// AnyFilesInterceptor: 0 decision node, 1 independent path.
describe('AnyFilesInterceptor', () => {
  it('should accept files in any field and expose them as an array', async () => {
    const req = createUploadRequest([
      uploadFilePart('a'),
      uploadFilePart('b'),
      uploadFilePart('c'),
    ]);
    const interceptor = new (AnyFilesInterceptor())();
    await lastValueFrom(
      await interceptor.intercept(createUploadContext(req), uploadNext() as any),
    );
    expect(req.files).toHaveLength(3);
    expect(req.files.map((f: any) => f.fieldname)).toEqual(['a', 'b', 'c']);
  });

  it('should accept a request without files', async () => {
    const req = createUploadRequest([]);
    const interceptor = new (AnyFilesInterceptor())();
    await lastValueFrom(
      await interceptor.intercept(createUploadContext(req), uploadNext() as any),
    );
    expect(req.files).toEqual([]);
  });
});
