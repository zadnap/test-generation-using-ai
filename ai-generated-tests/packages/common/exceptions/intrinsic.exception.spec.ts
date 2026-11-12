import { expect, it } from 'vitest';
import { IntrinsicException } from '../../../../packages/common/exceptions/intrinsic.exception.js';

it('creates an intrinsic error that extends Error', () => {
  const error = new IntrinsicException('intrinsic');

  expect(error).toBeInstanceOf(Error);
  expect(error.message).toBe('intrinsic');
});
