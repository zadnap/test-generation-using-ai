import { describe, expect, it } from 'vitest';
import { InvalidExceptionFilterException } from '../../../../../packages/core/errors/exceptions/invalid-exception-filter.exception.js';

describe('InvalidExceptionFilterException', () => {
  it('uses the invalid exception filter message', () => {
    expect(new InvalidExceptionFilterException().message).toContain(
      'Invalid exception filters',
    );
  });
});
