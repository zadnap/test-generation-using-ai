import { BadRequestException, type CallHandler } from '@nestjs/common';
import { firstValueFrom, of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { FileInterceptor } from '../../../../../packages/platform-node/multer/interceptors/file.interceptor.js';

const context = (req: any = {}, res: any = {}) =>
  ({ switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }) }) as any;

// CFG (C3) of FileInterceptor:
//   1  callback err                    T/F
//   constructor: merge/apply default limits (see multer.utils)
describe('FileInterceptor', () => {
  it('should expose an intercept method', () => {
    expect(FileInterceptor('file').prototype.intercept).toBeDefined();
  });

  it('should register a single-file upload for the field', async () => {
    const target = new (FileInterceptor('avatar'))();
    const single = vi.fn();
    const callback = vi.fn((_req, _res, next) => next());
    single.mockReturnValue(callback);
    (target as any).multer = { single, storage: {} };
    const handler: CallHandler = { handle: () => of('ok') };

    const result = await target.intercept(context(), handler);
    expect(single).toHaveBeenCalledWith('avatar');
    expect(callback).toHaveBeenCalled();
    expect(await firstValueFrom(result)).toBe('ok');
  });

  it('should reject with the transformed error', async () => {
    const target = new (FileInterceptor('avatar'))();
    const error = Object.assign(new Error('File too large'), {
      code: 'LIMIT_FILE_SIZE',
    });
    (target as any).multer = {
      single: () => (_req: any, _res: any, next: any) => next(error),
      storage: {},
    };
    await expect(
      target.intercept(context(), { handle: () => of('ok') }),
    ).rejects.toMatchObject({ status: 413 });
  });

  it('should merge options with the defaults', () => {
    const target = new (FileInterceptor('file', { limits: { fileSize: 10 } }))({
      limits: { files: 2 },
    });
    expect((target as any).multer.limits).toEqual({
      files: 2,
      fileSize: 10,
      fieldNestingDepth: 32,
      fieldArrayIndexLimit: 1000,
    });
  });
});
