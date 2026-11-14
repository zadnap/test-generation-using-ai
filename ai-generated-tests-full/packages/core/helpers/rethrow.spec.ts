import { describe, expect, it } from 'vitest';
import { rethrow } from '../../../../packages/core/helpers/rethrow.js';

describe('rethrow', () => {
  it('rethrows the same error', () => {
    const error = new Error('failure');

    expect(() => rethrow(error)).toThrow(error);
  });

  it('rethrows non-error values', () => {
    expect(() => rethrow('failure')).toThrow('failure');
  });
});
