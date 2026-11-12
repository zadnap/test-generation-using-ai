import { describe, expect, it } from 'vitest';
import { HttpException } from '../../../../packages/common/exceptions/http.exception.js';

interface ExceptionConfig {
  name: string;
  Exception: new (
    objectOrError?: any,
    descriptionOrOptions?: any,
  ) => HttpException;
  status: number;
  defaultMessage: string;
}

export function registerExceptionTests({
  name,
  Exception,
  status,
  defaultMessage,
}: ExceptionConfig) {
  describe(name, () => {
    it('uses the default response, status, and name', () => {
      const error = new Exception();

      expect(error).toBeInstanceOf(HttpException);
      expect(error).toBeInstanceOf(Error);
      expect(error.getStatus()).toBe(status);
      expect(error.getResponse()).toEqual({
        message: defaultMessage,
        statusCode: status,
      });
      expect(error.name).toBe(name);
      expect(error.cause).toBeUndefined();
      expect(error.errorCode).toBeUndefined();
    });

    it('accepts a custom string message', () => {
      const error = new Exception('Custom error');

      expect(error.getResponse()).toEqual({
        message: 'Custom error',
        error: defaultMessage,
        statusCode: status,
      });
    });

    it('accepts a custom object body', () => {
      const body = { foo: 'bar' };
      expect(new Exception(body).getResponse()).toBe(body);
    });

    it('handles a falsy body and keeps the default description', () => {
      expect(new Exception(0).getResponse()).toEqual({
        message: defaultMessage,
        statusCode: status,
      });
    });

    it('accepts a custom description string', () => {
      expect(
        new Exception('Custom error', 'Custom description').getResponse(),
      ).toEqual({
        message: 'Custom error',
        error: 'Custom description',
        statusCode: status,
      });
    });

    it('accepts a custom description in options', () => {
      expect(
        new Exception('Custom error', {
          description: 'Custom description',
        }).getResponse(),
      ).toEqual({
        message: 'Custom error',
        error: 'Custom description',
        statusCode: status,
      });
    });

    it('falls back to the default description for empty options', () => {
      expect(new Exception(undefined, {}).getResponse()).toEqual({
        message: defaultMessage,
        statusCode: status,
      });
    });

    it('adds an error code from options', () => {
      expect(
        new Exception(undefined, { errorCode: 'CUSTOM_CODE' }).getResponse(),
      ).toEqual({
        message: defaultMessage,
        errorCode: 'CUSTOM_CODE',
        statusCode: status,
      });
    });

    it('keeps a cause from options', () => {
      const cause = new Error('root cause');
      expect(new Exception(undefined, { cause }).cause).toBe(cause);
    });

    it('handles falsy causes and nullish options', () => {
      expect(new Exception(undefined, { cause: null }).cause).toBeUndefined();
      expect(new Exception(undefined, null as any).cause).toBeUndefined();
    });

    it('ignores a falsy error code', () => {
      expect(
        new Exception(undefined, { errorCode: '' }).getResponse(),
      ).toEqual({
        message: defaultMessage,
        statusCode: status,
      });
    });
  });
}
