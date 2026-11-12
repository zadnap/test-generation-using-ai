import { ExecutionContextHost } from '../../../../packages/core/internal.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WsException } from '../../../../packages/websockets/errors/ws-exception.js';
import { WsExceptionsHandler } from '../../../../packages/websockets/exceptions/ws-exceptions-handler.js';

const hostFor = (client: any, data: any = { foo: 'bar' }, pattern = 'test') =>
  new ExecutionContextHost([client, data, pattern]);

describe('WsExceptionsHandler', () => {
  let handler: WsExceptionsHandler;
  let emit: ReturnType<typeof vi.fn>;
  let client: any;

  beforeEach(() => {
    vi.spyOn((WsExceptionsHandler as any).logger, 'error').mockImplementation(
      () => undefined,
    );
    handler = new WsExceptionsHandler();
    emit = vi.fn();
    client = { emit };
  });

  describe('handle', () => {
    it('should delegate an unhandled WsException to the base filter', () => {
      handler.handle(new WsException('nope'), hostFor(client));

      expect(emit).toHaveBeenCalledWith('exception', {
        status: 'error',
        message: 'nope',
        cause: { pattern: 'test', data: { foo: 'bar' } },
      });
    });

    it('should do nothing when there is no client', () => {
      handler.handle(new WsException('nope'), hostFor(undefined));

      expect(emit).not.toHaveBeenCalled();
    });

    it('should use the first matching custom filter', () => {
      const filter = vi.fn();
      handler.setCustomFilters([
        { func: filter, exceptionMetatypes: [] } as any,
      ]);

      handler.handle(new WsException('nope'), hostFor(client));

      expect(filter).toHaveBeenCalledOnce();
      expect(emit).not.toHaveBeenCalled();
    });

    it('should fall back to the base filter when no custom filter matches', () => {
      const filter = vi.fn();
      handler.setCustomFilters([]);

      handler.handle(new WsException('nope'), hostFor(client));

      expect(filter).not.toHaveBeenCalled();
      expect(emit).toHaveBeenCalledOnce();
    });
  });

  describe('setCustomFilters', () => {
    it('should store an array of filters', () => {
      const filters = [{ func: vi.fn() } as any];
      handler.setCustomFilters(filters);

      expect((handler as any).filters).toBe(filters);
    });

    it('should reject a non-array value', () => {
      expect(() => handler.setCustomFilters('nope' as any)).toThrow();
    });
  });

  describe('invokeCustomFilters', () => {
    it('should return false without filters', () => {
      expect(
        handler.invokeCustomFilters(new Error('x'), hostFor(client)),
      ).toBe(false);
    });

    it('should return true when a filter throws or returns', () => {
      const filter = vi.fn();
      handler.setCustomFilters([
        { func: filter, exceptionMetatypes: [] } as any,
      ]);

      expect(
        handler.invokeCustomFilters(new Error('x'), hostFor(client)),
      ).toBe(true);
      expect(filter).toHaveBeenCalledOnce();
    });
  });
});
