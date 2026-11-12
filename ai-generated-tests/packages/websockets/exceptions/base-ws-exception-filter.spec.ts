import { ExecutionContextHost, MESSAGES } from '../../../../packages/core/internal.js';
import { IntrinsicException } from '../../../../packages/common/index.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WsException } from '../../../../packages/websockets/errors/ws-exception.js';
import { BaseWsExceptionFilter } from '../../../../packages/websockets/exceptions/base-ws-exception-filter.js';

const logger = (BaseWsExceptionFilter as any).logger;
const hostFor = (client: any, data: any = { foo: 'bar' }, pattern = 'test') =>
  new ExecutionContextHost([client, data, pattern]);

describe('BaseWsExceptionFilter', () => {
  beforeEach(() => {
    vi.spyOn(logger, 'error').mockImplementation(() => undefined);
  });

  describe('constructor', () => {
    it('should default includeCause and the cause factory', () => {
      const filter = new BaseWsExceptionFilter();
      const cause = (filter as any).options.causeFactory('p', { a: 1 });

      expect((filter as any).options.includeCause).toBe(true);
      expect(cause).toEqual({ pattern: 'p', data: { a: 1 } });
    });

    it('should keep explicit options', () => {
      const causeFactory = vi.fn(() => ({ custom: true }));
      const filter = new BaseWsExceptionFilter({
        includeCause: false,
        causeFactory,
      });

      expect((filter as any).options.includeCause).toBe(false);
      expect((filter as any).options.causeFactory).toBe(causeFactory);
    });
  });

  describe('catch', () => {
    it('should send a WsException payload with the cause', () => {
      const emit = vi.fn();
      const filter = new BaseWsExceptionFilter();

      filter.catch(new WsException('forbidden'), hostFor({ emit }));

      expect(emit).toHaveBeenCalledWith('exception', {
        status: 'error',
        message: 'forbidden',
        cause: { pattern: 'test', data: { foo: 'bar' } },
      });
    });
  });

  describe('handleError', () => {
    it('should omit the cause when includeCause is false', () => {
      const emit = vi.fn();
      const filter = new BaseWsExceptionFilter({ includeCause: false });

      filter.handleError({ emit }, new WsException('nope'), {
        pattern: 'test',
        data: {},
      });

      expect(emit).toHaveBeenCalledWith('exception', {
        status: 'error',
        message: 'nope',
      });
    });

    it('should use a custom cause factory', () => {
      const emit = vi.fn();
      const filter = new BaseWsExceptionFilter({
        causeFactory: (pattern, data) => ({ pattern, payload: data }),
      });

      filter.handleError({ emit }, new WsException('nope'), {
        pattern: 'test',
        data: { id: 1 },
      });

      expect(emit).toHaveBeenCalledWith('exception', {
        status: 'error',
        message: 'nope',
        cause: { pattern: 'test', payload: { id: 1 } },
      });
    });

    it('should emit the error object of a WsException directly', () => {
      const emit = vi.fn();
      const error = { code: 'E', message: 'object error' };
      const filter = new BaseWsExceptionFilter();

      filter.handleError({ emit }, new WsException(error), undefined);

      expect(emit).toHaveBeenCalledWith('exception', error);
    });

    it('should treat a WsException holding an Error as unknown', () => {
      const emit = vi.fn();
      const filter = new BaseWsExceptionFilter();

      filter.handleError({ emit }, new WsException(new Error('hidden')), {
        pattern: 'test',
        data: {},
      });

      expect(emit).toHaveBeenCalledWith('exception', {
        status: 'error',
        message: MESSAGES.UNKNOWN_EXCEPTION_MESSAGE,
        cause: { pattern: 'test', data: {} },
      });
    });

    it('should handle a non-WsException as an unknown error', () => {
      const emit = vi.fn();
      const filter = new BaseWsExceptionFilter();

      filter.handleError({ emit }, new Error('boom'), undefined);

      expect(emit).toHaveBeenCalledWith('exception', {
        status: 'error',
        message: MESSAGES.UNKNOWN_EXCEPTION_MESSAGE,
      });
    });
  });

  describe('handleUnknownError', () => {
    it('should log the error and include the cause', () => {
      const emit = vi.fn();
      const filter = new BaseWsExceptionFilter();
      const error = new Error('boom');

      filter.handleUnknownError(error, { emit }, {
        pattern: 'test',
        data: {},
      });

      expect(logger.error).toHaveBeenCalledWith(error);
      expect(emit).toHaveBeenCalledWith('exception', {
        status: 'error',
        message: MESSAGES.UNKNOWN_EXCEPTION_MESSAGE,
        cause: { pattern: 'test', data: {} },
      });
    });

    it('should not log an IntrinsicException', () => {
      const emit = vi.fn();
      const filter = new BaseWsExceptionFilter();

      filter.handleUnknownError(new IntrinsicException('internal'), { emit }, undefined);

      expect(logger.error).not.toHaveBeenCalled();
      expect(emit).toHaveBeenCalledOnce();
    });

    it('should omit the cause when there is none', () => {
      const emit = vi.fn();
      const filter = new BaseWsExceptionFilter();

      filter.handleUnknownError(new Error('boom'), { emit }, undefined);

      expect(emit).toHaveBeenCalledWith('exception', {
        status: 'error',
        message: MESSAGES.UNKNOWN_EXCEPTION_MESSAGE,
      });
    });
  });

  describe('emitMessage', () => {
    it('should send JSON to a native WebSocket client', () => {
      const send = vi.fn();
      const emit = vi.fn();
      const filter = new BaseWsExceptionFilter();

      (filter as any).emitMessage(
        { readyState: 1, send, emit },
        'exception',
        { status: 'error' },
      );

      expect(send).toHaveBeenCalledWith(
        JSON.stringify({ event: 'exception', data: { status: 'error' } }),
      );
      expect(emit).not.toHaveBeenCalled();
    });

    it('should emit to a Socket.IO client', () => {
      const emit = vi.fn();
      const filter = new BaseWsExceptionFilter();

      (filter as any).emitMessage({ emit, readyState: 'open' }, 'exception', {
        status: 'error',
      });

      expect(emit).toHaveBeenCalledWith('exception', { status: 'error' });
    });

    it('should do nothing for a client with only a non-function emit', () => {
      const filter = new BaseWsExceptionFilter();

      expect(() =>
        (filter as any).emitMessage({ emit: 'nope' }, 'exception', {}),
      ).not.toThrow();
    });
  });

  describe('emitErrorPayload', () => {
    it('should retry without the cause when sending the payload fails', () => {
      const client = {
        emit: vi
          .fn()
          .mockImplementationOnce(() => {
            throw new Error('cannot encode');
          })
          .mockImplementation(() => undefined),
      };
      const filter = new BaseWsExceptionFilter();

      (filter as any).emitErrorPayload(client, {
        status: 'error',
        message: 'boom',
        cause: { pattern: 'test', data: {} },
      });

      expect(client.emit).toHaveBeenCalledTimes(2);
      expect(client.emit).toHaveBeenLastCalledWith('exception', {
        status: 'error',
        message: 'boom',
      });
    });

    it('should rethrow when the payload has no cause', () => {
      const client = {
        emit: vi.fn(() => {
          throw new Error('cannot encode');
        }),
      };
      const filter = new BaseWsExceptionFilter();

      expect(() =>
        (filter as any).emitErrorPayload(client, {
          status: 'error',
          message: 'boom',
        }),
      ).toThrow('cannot encode');
    });
  });

  describe('isExceptionObject', () => {
    it('should accept an object with a message', () => {
      expect(new BaseWsExceptionFilter().isExceptionObject({ message: 'x' })).toBe(
        true,
      );
    });

    it.each([[null], [undefined], ['text'], [{}], [{ message: '' }]])(
      'should reject %j',
      value => {
        expect(new BaseWsExceptionFilter().isExceptionObject(value)).toBe(
          false,
        );
      },
    );
  });
});
