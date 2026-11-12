import type { CallHandler } from '@nestjs/common';
import { firstValueFrom, of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { NoFilesInterceptor } from '../../../../../packages/platform-node/multer/interceptors/no-files.interceptor.js';

const context = (req: any = {}, res: any = {}) =>
  ({ switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }) }) as any;

describe('NoFilesInterceptor', () => {
  it('should expose an intercept method', () => {
    expect(NoFilesInterceptor().prototype.intercept).toBeDefined();
  });

  it('should register a no-file upload and pass the handler through', async () => {
    const target = new (NoFilesInterceptor())();
    const none = vi.fn();
    const callback = vi.fn((_req, _res, next) => next());
    none.mockReturnValue(callback);
    (target as any).multer = { none };
    const handler: CallHandler = { handle: () => of('ok') };

    const result = await target.intercept(context(), handler);
    expect(none).toHaveBeenCalled();
    expect(callback).toHaveBeenCalled();
    expect(result).toBeInstanceOf(Object);
    expect(await firstValueFrom(result)).toBe('ok');
  });

  it('should reject with the transformed error', async () => {
    const target = new (NoFilesInterceptor())();
    (target as any).multer = {
      none: () => (_req: any, _res: any, next: any) =>
        next(Object.assign(new Error('Unexpected field'), { code: 'LIMIT_UNEXPECTED_FILE' })),
    };
    await expect(
      target.intercept(context(), { handle: () => of('ok') }),
    ).rejects.toBeInstanceOf(Error);
  });

  it('should apply default field name limits', () => {
    const target = new (NoFilesInterceptor({ limits: { fileSize: 1 } }))();
    expect((target as any).multer.limits).toMatchObject({
      fileSize: 1,
      fieldNestingDepth: 32,
      fieldArrayIndexLimit: 1000,
    });
  });
});
