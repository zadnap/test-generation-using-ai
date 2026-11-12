import type { CallHandler } from '@nestjs/common';
import { firstValueFrom, of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { FilesInterceptor } from '../../../../../packages/platform-node/multer/interceptors/files.interceptor.js';

const context = (req: any = {}, res: any = {}) =>
  ({ switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }) }) as any;

describe('FilesInterceptor', () => {
  it('should expose an intercept method', () => {
    expect(FilesInterceptor('files').prototype.intercept).toBeDefined();
  });

  it('should register an array upload with maxCount', async () => {
    const target = new (FilesInterceptor('files', 3))();
    const array = vi.fn();
    const callback = vi.fn((_req, _res, next) => next());
    array.mockReturnValue(callback);
    (target as any).multer = { array, storage: {} };
    const handler: CallHandler = { handle: () => of('ok') };

    const result = await target.intercept(context(), handler);
    expect(array).toHaveBeenCalledWith('files', 3);
    expect(callback).toHaveBeenCalled();
    expect(await firstValueFrom(result)).toBe('ok');
  });

  it('should register an array upload without maxCount', async () => {
    const target = new (FilesInterceptor('files'))();
    const array = vi.fn(() => (_req: any, _res: any, next: any) => next());
    (target as any).multer = { array, storage: {} };
    await target.intercept(context(), { handle: () => of('ok') });
    expect(array).toHaveBeenCalledWith('files', undefined);
  });

  it('should reject with the transformed error', async () => {
    const target = new (FilesInterceptor('files'))();
    (target as any).multer = {
      array: () => (_req: any, _res: any, next: any) =>
        next(Object.assign(new Error('Too many files'), { code: 'LIMIT_FILE_COUNT' })),
      storage: {},
    };
    await expect(
      target.intercept(context(), { handle: () => of('ok') }),
    ).rejects.toBeInstanceOf(Error);
  });

  it('should merge options with the defaults', () => {
    const target = new (FilesInterceptor('files', 1, { limits: { fileSize: 10 } }))({
      limits: { files: 2 },
    });
    expect((target as any).multer.limits).toMatchObject({
      files: 2,
      fileSize: 10,
    });
  });
});
