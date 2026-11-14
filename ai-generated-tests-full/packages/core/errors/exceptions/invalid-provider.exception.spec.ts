import { describe, expect, it } from 'vitest';
import { InvalidProviderException } from '../../../../../packages/core/errors/exceptions/invalid-provider.exception.js';

describe('InvalidProviderException', () => {
  it('mentions the provider token and module', () => {
    const exception = new InvalidProviderException('TOKEN', 'CatsModule');

    expect(exception.message).toContain('"TOKEN"');
    expect(exception.message).toContain('CatsModule');
  });
});
