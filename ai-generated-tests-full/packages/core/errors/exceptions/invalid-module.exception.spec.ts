import { describe, expect, it } from 'vitest';
import { InvalidModuleException } from '../../../../../packages/core/errors/exceptions/invalid-module.exception.js';

describe('InvalidModuleException', () => {
  it('xc1(T): formats a null imported value', () => {
    const exception = new InvalidModuleException(class Parent {}, 0, [], null);

    expect(exception.message).toContain('`null` is of type "null"');
  });

  it('xc1(F), xc2(T): formats a string imported value', () => {
    const exception = new InvalidModuleException('Parent', 1, [], 'value');

    expect(exception.message).toContain('`"value"` is of type "string"');
  });

  it('xc2(F): formats other imported values', () => {
    const exception = new InvalidModuleException('Parent', 2, [], 42);

    expect(exception.message).toContain('`42` is of type "number"');
  });
});
