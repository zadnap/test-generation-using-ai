import { describe, expect, it } from 'vitest';
import { UnknownRequestMappingException } from '../../../../../packages/core/errors/exceptions/unknown-request-mapping.exception.js';

class Foo {}

describe('UnknownRequestMappingException', () => {
  it('xc1(T): names the invalid controller', () => {
    expect(new UnknownRequestMappingException(Foo).message).toContain('"Foo"');
  });

  it('xc1(F): handles an anonymous controller', () => {
    const Anonymous = class {};
    Object.defineProperty(Anonymous, 'name', { value: '' });

    expect(new UnknownRequestMappingException(Anonymous).message).toContain(
      'one of your controllers is missing',
    );
  });
});
