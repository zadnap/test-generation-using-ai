import { describe, expect, it } from 'vitest';
import { InvalidMiddlewareException } from '../../../../../packages/core/errors/exceptions/invalid-middleware.exception.js';

describe('InvalidMiddlewareException', () => {
  it('mentions the middleware name', () => {
    const exception = new InvalidMiddlewareException('LoggerMiddleware');

    expect(exception.message).toContain('LoggerMiddleware');
  });
});
