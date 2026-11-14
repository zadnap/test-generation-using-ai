import { describe, expect, it } from 'vitest';
import { InvalidClassException } from '../../../../../packages/core/errors/exceptions/invalid-class.exception.js';

describe('InvalidClassException', () => {
  it('mentions the non-constructable value', () => {
    const exception = new InvalidClassException('value');

    expect(exception.message).toContain('value is not constructable');
  });
});
