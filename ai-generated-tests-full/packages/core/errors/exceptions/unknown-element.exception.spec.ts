import { describe, expect, it } from 'vitest';
import { UnknownElementException } from '../../../../../packages/core/errors/exceptions/unknown-element.exception.js';

describe('UnknownElementException', () => {
  it('xc1(T): names the missing element', () => {
    expect(new UnknownElementException('Foo').message).toContain(
      'Nest could not find Foo element',
    );
  });

  it('xc1(F): falls back to "given"', () => {
    expect(new UnknownElementException().message).toContain(
      'Nest could not find given element',
    );
  });

  it('converts a symbol name', () => {
    const token = Symbol('TOKEN');

    expect(new UnknownElementException(token).message).toContain(
      token.toString(),
    );
  });
});
