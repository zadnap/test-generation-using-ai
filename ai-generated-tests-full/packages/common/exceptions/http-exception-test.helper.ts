import { describe, expect, it } from 'vitest';
import { HttpException } from '../../../../packages/common/exceptions/http.exception.js';

type ExceptionConstructor = new (
  objectOrError?: any,
  descriptionOrOptions?: any,
) => HttpException;

function messageFromClassName(name: string): string {
  return name.match(/[A-Z][a-z]+|[0-9]+/g)?.join(' ') ?? 'Error';
}

export function describeHttpException(
  name: string,
  Exception: ExceptionConstructor,
  status: number,
  defaultMessage: string,
): void {
  describe(name, () => {
    it('xc1(T), xc2(T): uses the default description and status', () => {
      const exception = new Exception();

      expect(exception.getStatus()).toBe(status);
      expect(exception.getResponse()).toEqual({
        message: defaultMessage,
        statusCode: status,
      });
      expect(exception.name).toBe(name);
    });

    it('xc2(F): builds a body from a custom string message', () => {
      const exception = new Exception('custom');

      expect(exception.getResponse()).toEqual({
        message: 'custom',
        error: defaultMessage,
        statusCode: status,
      });
    });

    it('xc3(T), xc4(T): uses options description, cause and error code', () => {
      const cause = new Error('cause');
      const exception = new Exception(undefined, {
        description: 'described',
        cause,
        errorCode: 'E_CODE',
      });

      expect(exception.getResponse()).toEqual({
        message: 'described',
        statusCode: status,
        errorCode: 'E_CODE',
      });
      expect(exception.cause).toBe(cause);
      expect(exception.errorCode).toBe('E_CODE');
    });

    it('xc3(F), xc4(F): falls back to the default description without options', () => {
      const exception = new Exception(undefined, {});

      expect(exception.getResponse()).toEqual({
        message: defaultMessage,
        statusCode: status,
      });
      expect(exception.errorCode).toBeUndefined();
    });

    it('keeps a custom object body untouched', () => {
      const body = { custom: true };
      const exception = new Exception(body);

      expect(exception.getResponse()).toBe(body);
      expect(exception.message).toBe(messageFromClassName(name));
    });
  });
}
