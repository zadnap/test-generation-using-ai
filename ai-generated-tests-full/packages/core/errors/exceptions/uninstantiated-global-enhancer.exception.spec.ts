import { describe, expect, it } from 'vitest';
import { UninstantiatedGlobalEnhancerException } from '../../../../../packages/core/errors/exceptions/uninstantiated-global-enhancer.exception.js';

describe('UninstantiatedGlobalEnhancerException', () => {
  it('mentions the enhancer and provider', () => {
    const exception = new UninstantiatedGlobalEnhancerException(
      'APP_GUARD',
      'Foo',
    );

    expect(exception.message).toContain('APP_GUARD');
    expect(exception.message).toContain('Foo');
    expect(exception.message).toContain('was not instantiated');
  });
});
