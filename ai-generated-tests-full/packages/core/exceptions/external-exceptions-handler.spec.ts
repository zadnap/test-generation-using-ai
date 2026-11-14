import { describe, expect, it, vi } from 'vitest';
import { InvalidExceptionFilterException } from '../../../../packages/core/errors/exceptions/invalid-exception-filter.exception.js';
import { ExternalExceptionsHandler } from '../../../../packages/core/exceptions/external-exceptions-handler.js';
import { ExternalExceptionFilter } from '../../../../packages/core/exceptions/external-exception-filter.js';

describe('ExternalExceptionsHandler', () => {
  it('xc1(T): returns the result of a custom filter', async () => {
    const handler = new ExternalExceptionsHandler();
    handler.setCustomFilters([
      { func: vi.fn(async () => 'handled'), exceptionMetatypes: [] } as any,
    ]);

    await expect(handler.next(new Error('failure'), {} as any)).resolves.toBe(
      'handled',
    );
  });

  it('xc1(F): delegates to the base filter when the result is undefined', async () => {
    const handler = new ExternalExceptionsHandler();
    const catchSpy = vi
      .spyOn(ExternalExceptionFilter.prototype, 'catch')
      .mockResolvedValue('base');
    handler.setCustomFilters([
      { func: vi.fn(() => undefined), exceptionMetatypes: [] } as any,
    ]);

    await expect(handler.next(new Error('failure'), {} as any)).resolves.toBe(
      'base',
    );
    expect(catchSpy).toHaveBeenCalled();
  });

  it('xc2(T): rejects non-array filters', () => {
    expect(() =>
      new ExternalExceptionsHandler().setCustomFilters('filters' as any),
    ).toThrow(InvalidExceptionFilterException);
  });

  it('xc2(F): stores an array of filters', () => {
    const handler = new ExternalExceptionsHandler();
    const filters = [] as any[];

    handler.setCustomFilters(filters);

    expect((handler as any).filters).toBe(filters);
  });

  it('xc3(T): returns undefined without filters', () => {
    expect(
      new ExternalExceptionsHandler().invokeCustomFilters(
        new Error('failure'),
        {} as any,
      ),
    ).toBeUndefined();
  });

  it('xc3(F), xc4(T): invokes a matching filter', async () => {
    const handler = new ExternalExceptionsHandler();
    const func = vi.fn(async () => 'result');
    handler.setCustomFilters([{ func, exceptionMetatypes: [] } as any]);

    await expect(
      handler.invokeCustomFilters(new Error('failure'), {} as any),
    ).resolves.toBe('result');
  });

  it('xc4(F): returns undefined when no filter matches', () => {
    const handler = new ExternalExceptionsHandler();
    handler.setCustomFilters([
      { func: vi.fn(), exceptionMetatypes: [TypeError] } as any,
    ]);

    expect(
      handler.invokeCustomFilters(new Error('failure'), {} as any),
    ).toBeUndefined();
  });
});
