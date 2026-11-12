import { describe, expect, it } from 'vitest';
import {
  HttpErrorByCode,
  type ErrorHttpStatusCode,
} from '../../../../packages/common/utils/http-error-by-code.util.js';
import { HttpStatus } from '../../../../packages/common/enums/http-status.enum.js';
import { HttpException } from '../../../../packages/common/exceptions/http.exception.js';

describe('HttpErrorByCode (C3)', () => {
  const entries = Object.entries(HttpErrorByCode) as [
    string,
    new (...args: any[]) => HttpException,
  ][];

  it('maps every supported status code', () => {
    expect(entries).toHaveLength(21);
  });

  it.each(entries)(
    'maps %s to an exception with that status',
    (code, Exception) => {
      const exception = new Exception('message');
      expect(exception).toBeInstanceOf(HttpException);
      expect(exception.getStatus()).toBe(Number(code));
    },
  );

  it('covers the expected representative codes', () => {
    expect(HttpErrorByCode[HttpStatus.BAD_REQUEST]).toBeDefined();
    expect(HttpErrorByCode[HttpStatus.UNAUTHORIZED]).toBeDefined();
    expect(HttpErrorByCode[HttpStatus.NOT_FOUND]).toBeDefined();
    expect(
      HttpErrorByCode[HttpStatus.INTERNAL_SERVER_ERROR as ErrorHttpStatusCode],
    ).toBeDefined();
  });
});
