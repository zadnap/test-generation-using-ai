import { describe, expect, it } from 'vitest';
import { InvalidMiddlewareConfigurationException } from '../../../../../packages/core/errors/exceptions/invalid-middleware-configuration.exception.js';

describe('InvalidMiddlewareConfigurationException', () => {
  it('uses the invalid middleware configuration message', () => {
    expect(new InvalidMiddlewareConfigurationException().message).toContain(
      "configure()",
    );
  });
});
