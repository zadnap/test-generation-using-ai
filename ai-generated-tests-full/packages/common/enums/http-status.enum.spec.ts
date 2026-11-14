import { describe, expect, it } from 'vitest';
import { HttpStatus } from '../../../../packages/common/enums/http-status.enum.js';

describe('HttpStatus', () => {
  it('exposes the standard HTTP status codes', () => {
    expect(HttpStatus.OK).toBe(200);
    expect(HttpStatus.CREATED).toBe(201);
    expect(HttpStatus.BAD_REQUEST).toBe(400);
    expect(HttpStatus.NOT_FOUND).toBe(404);
    expect(HttpStatus.INTERNAL_SERVER_ERROR).toBe(500);
    expect(HttpStatus.LOOP_DETECTED).toBe(508);
  });
});
