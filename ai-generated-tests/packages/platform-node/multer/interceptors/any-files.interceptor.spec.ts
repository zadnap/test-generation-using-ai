import type { CallHandler } from '@nestjs/common';
import { firstValueFrom, of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { AnyFilesInterceptor } from '../../../../../packages/platform-node/multer/interceptors/any-files.interceptor.js';

const context = (req: any = {}, res: any = {}) =>
  ({ switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }) }) as any;

describe('AnyFilesInterceptor', () => {
  it('should expose an intercept method', () => {
    expect(AnyFilesInterceptor().prototype.intercept).toBeDefined();
  });

  it('should register a catch-all upload', async () => {
    const target = new (AnyFilesInterceptor())();
    const any = vi.fn();
    const callback = vi.fn((_req, _res, next) => next());
    any.mockReturnValue(callback);
    (target as any).multer = { any, storage: {} };
    const handler: CallHandler = { handle: () => of('ok') };

    const result = await target.intercept(context(), handler);
    expect(any).toHaveBeenCalled();
    expect(callback).toHaveBeenCalled();
    expect(await firstValueFrom(result)).toBe('ok');
  });

  it('should reject with the transformed error', async () => {
    const target = new (AnyFilesInterceptor())();
    (target as any).multer = {
      any: () => (_req: any, _res: any, next: any) =>
        next(Object.assign(new Error('Unexpected field'), { code: 'LIMIT_UNEXPECTED_FILE' })),
      storage: {},
    };
    await expect(
      target.intercept(context(), { handle: () => of('ok') }),
    ).rejects.toBeInstanceOf(Error);
  });

  it('should apply default field name limits', () => {
    const target = new (AnyFilesInterceptor({ limits: { fileSize: 1 } }))();
    expect((target as any).multer.limits).toMatchObject({
      fileSize: 1,
      fieldNestingDepth: 32,
      fieldArrayIndexLimit: 1000,
    });
  });
});
