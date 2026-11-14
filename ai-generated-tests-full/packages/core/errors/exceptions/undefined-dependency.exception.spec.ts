import { describe, expect, it } from 'vitest';
import { UndefinedDependencyException } from '../../../../../packages/core/errors/exceptions/undefined-dependency.exception.js';

describe('UndefinedDependencyException', () => {
  it('builds the unknown dependencies message', () => {
    const exception = new UndefinedDependencyException('MyClass', {
      key: 'dependency',
    });

    expect(exception.message).toContain('MyClass');
    expect(exception.message).toContain('"dependency" property');
  });
});
