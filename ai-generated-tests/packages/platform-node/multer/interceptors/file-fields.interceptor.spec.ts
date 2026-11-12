import type { CallHandler } from '@nestjs/common';
import { firstValueFrom, of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { FileFieldsInterceptor } from '../../../../../packages/platform-node/multer/interceptors/file-fields.interceptor.js';

const context = (req: any = {}, res: any = {}) =>
  ({ switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }) }) as any;

describe('FileFieldsInterceptor', () => {
  it('should expose an intercept method', () => {
    expect(FileFieldsInterceptor([]).prototype.intercept).toBeDefined();
  });

  it('should register a fields upload', async () => {
    const fields = [{ name: 'avatar', maxCount: 1 }, { name: 'docs' }];
    const target = new (FileFieldsInterceptor(fields))();
    const fieldsFn = vi.fn();
    const callback = vi.fn((_req, _res, next) => next());
    fieldsFn.mockReturnValue(callback);
    (target as any).multer = { fields: fieldsFn, storage: {} };
    const handler: CallHandler = { handle: () => of('ok') };

    const result = await target.intercept(context(), handler);
    expect(fieldsFn).toHaveBeenCalledWith(fields);
    expect(callback).toHaveBeenCalled();
    expect(await firstValueFrom(result)).toBe('ok');
  });

  it('should reject with the transformed error', async () => {
    const target = new (FileFieldsInterceptor([]))();
    (target as any).multer = {
      fields: () => (_req: any, _res: any, next: any) =>
        next(Object.assign(new Error('Unexpected field'), { code: 'LIMIT_UNEXPECTED_FILE', field: 'x' })),
      storage: {},
    };
    await expect(
      target.intercept(context(), { handle: () => of('ok') }),
    ).rejects.toBeInstanceOf(Error);
  });

  it('should merge options with the defaults', () => {
    const target = new (FileFieldsInterceptor([], { limits: { fileSize: 2 } }))({
      limits: { files: 1 },
    });
    expect((target as any).multer.limits).toMatchObject({ files: 1, fileSize: 2 });
  });
});
