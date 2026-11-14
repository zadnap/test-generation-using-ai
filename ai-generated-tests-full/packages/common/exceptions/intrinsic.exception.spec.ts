import { describe, expect, it } from 'vitest';
import { IntrinsicException } from '../../../../packages/common/exceptions/intrinsic.exception.js';

describe('IntrinsicException', () => {
  it('is an Error with the provided message', () => {
    const exception = new IntrinsicException('intrinsic');

    expect(exception).toBeInstanceOf(Error);
    expect(exception.message).toBe('intrinsic');
    expect(exception.name).toBe('Error');
  });
});
