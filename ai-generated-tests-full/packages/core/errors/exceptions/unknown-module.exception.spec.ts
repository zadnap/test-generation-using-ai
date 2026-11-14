import { describe, expect, it } from 'vitest';
import { UnknownModuleException } from '../../../../../packages/core/errors/exceptions/unknown-module.exception.js';

describe('UnknownModuleException', () => {
  it('xc1(T): names the missing module', () => {
    expect(new UnknownModuleException('CatsModule').message).toContain(
      '"CatsModule"',
    );
  });

  it('xc1(F): uses the generic fallback', () => {
    expect(new UnknownModuleException().message).toContain(
      'it does not exist in current context',
    );
  });
});
