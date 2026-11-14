import { describe, expect, it } from 'vitest';
import { UndefinedModuleException } from '../../../../../packages/core/errors/exceptions/undefined-module.exception.js';

class Foo {}

describe('UndefinedModuleException', () => {
  it('formats the undefined module message', () => {
    const exception = new UndefinedModuleException(class Parent {}, 1, [Foo]);

    expect(exception.message).toContain('index [1]');
    expect(exception.message).toContain('Scope [Foo]');
  });
});
