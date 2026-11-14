import { describe, expect, it } from 'vitest';
import { HttpStatus } from '../../../../packages/common/enums/http-status.enum.js';
import { HttpErrorByCode } from '../../../../packages/common/utils/http-error-by-code.util.js';

describe('HttpErrorByCode', () => {
  it.each([
    [HttpStatus.BAD_GATEWAY],
    [HttpStatus.BAD_REQUEST],
    [HttpStatus.CONFLICT],
    [HttpStatus.FORBIDDEN],
    [HttpStatus.GATEWAY_TIMEOUT],
    [HttpStatus.GONE],
    [HttpStatus.HTTP_VERSION_NOT_SUPPORTED],
    [HttpStatus.I_AM_A_TEAPOT],
    [HttpStatus.INTERNAL_SERVER_ERROR],
    [HttpStatus.METHOD_NOT_ALLOWED],
    [HttpStatus.MISDIRECTED],
    [HttpStatus.NOT_ACCEPTABLE],
    [HttpStatus.NOT_FOUND],
    [HttpStatus.NOT_IMPLEMENTED],
    [HttpStatus.PAYLOAD_TOO_LARGE],
    [HttpStatus.PRECONDITION_FAILED],
    [HttpStatus.REQUEST_TIMEOUT],
    [HttpStatus.SERVICE_UNAVAILABLE],
    [HttpStatus.UNAUTHORIZED],
    [HttpStatus.UNPROCESSABLE_ENTITY],
    [HttpStatus.UNSUPPORTED_MEDIA_TYPE],
  ])('maps status %s to an exception class', status => {
    const Exception = HttpErrorByCode[status];
    expect(typeof Exception).toBe('function');
    const instance = new (Exception as any)();
    expect(instance.getStatus()).toBe(status);
  });
});
