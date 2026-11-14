import { describe, expect, it } from 'vitest';
import { InvalidClassScopeException } from '../../../../../packages/core/errors/exceptions/invalid-class-scope.exception.js';

class Foo {}

describe('InvalidClassScopeException', () => {
  it('xc1(T), xc2(T): names a function dependency', () => {
    const exception = new InvalidClassScopeException(Foo);

    expect(exception.message).toContain('Foo is marked');
  });

  it('xc1(F): names a string token', () => {
    const exception = new InvalidClassScopeException('TOKEN');

    expect(exception.message).toContain('TOKEN is marked');
  });

  it('xc1(F): names a symbol token', () => {
    const token = Symbol('TOKEN');
    const exception = new InvalidClassScopeException(token);

    expect(exception.message).toContain(token.toString());
  });

  it('xc2(F): falls back to "This class" for an empty token', () => {
    const exception = new InvalidClassScopeException('');

    expect(exception.message).toContain('This class is marked');
  });
});
