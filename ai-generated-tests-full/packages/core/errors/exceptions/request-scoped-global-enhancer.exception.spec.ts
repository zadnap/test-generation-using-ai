import { describe, expect, it } from 'vitest';
import { RequestScopedGlobalEnhancerException } from '../../../../../packages/core/errors/exceptions/request-scoped-global-enhancer.exception.js';

describe('RequestScopedGlobalEnhancerException', () => {
  it('xc1(T): explains useClass enhancers', () => {
    const exception = new RequestScopedGlobalEnhancerException(
      'APP_GUARD',
      'Foo',
      'useClass',
    );

    expect(exception.message).toContain('dependencies undefined');
  });

  it('xc1(F), xc2(T): explains useExisting enhancers', () => {
    const exception = new RequestScopedGlobalEnhancerException(
      'APP_GUARD',
      'Foo',
      'useExisting',
    );

    expect(exception.message).toContain('never run');
  });

  it('xc2(F): explains useFactory enhancers', () => {
    const exception = new RequestScopedGlobalEnhancerException(
      'APP_GUARD',
      'Foo',
      'useFactory',
    );

    expect(exception.message).toContain('factory provider');
  });
});
