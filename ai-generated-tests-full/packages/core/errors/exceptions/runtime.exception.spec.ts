import { describe, expect, it } from 'vitest';
import { RuntimeException } from '../../../../../packages/core/errors/exceptions/runtime.exception.js';

describe('RuntimeException', () => {
  it('xc1(T): uses an empty default message', () => {
    const exception = new RuntimeException();

    expect(exception.message).toBe('');
    expect(exception.what()).toBe('');
  });

  it('xc1(F): stores the provided message', () => {
    const exception = new RuntimeException('failure');

    expect(exception).toBeInstanceOf(Error);
    expect(exception.what()).toBe('failure');
  });
});
