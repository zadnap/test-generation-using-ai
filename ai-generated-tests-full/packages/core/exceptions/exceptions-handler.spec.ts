import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { BaseExceptionFilter } from '../../../../packages/core/exceptions/base-exception-filter.js';
import { ExceptionsHandler } from '../../../../packages/core/exceptions/exceptions-handler.js';
import { InvalidExceptionFilterException } from '../../../../packages/core/errors/exceptions/invalid-exception-filter.exception.js';

function hostMock(response: any = {}) {
  return { getArgByIndex: vi.fn(() => response) } as any;
}

describe('ExceptionsHandler', () => {
  it('xc1(T): returns early when a custom filter handles the exception', () => {
    const handler = new ExceptionsHandler();
    vi.spyOn(handler, 'invokeCustomFilters').mockReturnValue(true);
    const catchSpy = vi.spyOn(BaseExceptionFilter.prototype, 'catch');

    handler.next(new Error('failure'), hostMock());

    expect(catchSpy).not.toHaveBeenCalled();
  });

  it('xc1(F): delegates to the base filter when no custom filter handles it', () => {
    const handler = new ExceptionsHandler();
    vi.spyOn(handler, 'invokeCustomFilters').mockReturnValue(false);
    const catchSpy = vi
      .spyOn(BaseExceptionFilter.prototype, 'catch')
      .mockImplementation(() => undefined);

    handler.next(new Error('failure'), hostMock());

    expect(catchSpy).toHaveBeenCalled();
  });

  it('xc2(T): rejects non-array filters', () => {
    const handler = new ExceptionsHandler();

    expect(() => handler.setCustomFilters('filters' as any)).toThrow(
      InvalidExceptionFilterException,
    );
  });

  it('xc2(F): stores an array of filters', () => {
    const handler = new ExceptionsHandler();
    const filters = [] as any[];

    handler.setCustomFilters(filters);

    expect((handler as any).filters).toBe(filters);
  });

  it('xc3(T): returns false without filters', () => {
    const handler = new ExceptionsHandler();

    expect(handler.invokeCustomFilters(new Error('failure'), hostMock())).toBe(
      false,
    );
  });

  it('xc3(F), xc4(T): invokes a matching filter and returns true', () => {
    const handler = new ExceptionsHandler();
    const func = vi.fn(() => 'result');
    handler.setCustomFilters([{ func, exceptionMetatypes: [] } as any]);

    expect(handler.invokeCustomFilters(new Error('failure'), hostMock())).toBe(
      true,
    );
    expect(func).toHaveBeenCalled();
  });

  it('xc4(F): returns false when no filter matches', () => {
    const handler = new ExceptionsHandler();
    handler.setCustomFilters([
      { func: vi.fn(), exceptionMetatypes: [TypeError] } as any,
    ]);

    expect(handler.invokeCustomFilters(new Error('failure'), hostMock())).toBe(
      false,
    );
  });

  it('xc5(T): treats an observable result as handled only when headers were sent', () => {
    const applicationRef = { isHeadersSent: vi.fn(() => true) } as any;
    const handler = new ExceptionsHandler(applicationRef);
    handler.setCustomFilters([
      { func: () => of('value'), exceptionMetatypes: [] } as any,
    ]);

    expect(handler.invokeCustomFilters(new Error('failure'), hostMock())).toBe(
      true,
    );
  });

  it('xc5(F): returns false for an observable result without sent headers', () => {
    const applicationRef = { isHeadersSent: vi.fn(() => false) } as any;
    const handler = new ExceptionsHandler(applicationRef);
    handler.setCustomFilters([
      { func: () => of('value'), exceptionMetatypes: [] } as any,
    ]);

    expect(handler.invokeCustomFilters(new Error('failure'), hostMock())).toBe(
      false,
    );
  });
});
