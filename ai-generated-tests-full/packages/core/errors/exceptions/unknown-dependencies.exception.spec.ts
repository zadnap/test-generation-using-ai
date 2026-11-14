import { describe, expect, it } from 'vitest';
import { UnknownDependenciesException } from '../../../../../packages/core/errors/exceptions/unknown-dependencies.exception.js';

describe('UnknownDependenciesException', () => {
  it('xc1(T): stores the module id when a module is given', () => {
    const exception = new UnknownDependenciesException(
      'MyClass',
      { key: 'dependency' },
      { id: 'module-id' } as any,
    );

    expect(exception.moduleRef).toEqual({ id: 'module-id' });
  });

  it('xc1(F): leaves the module ref undefined without a module', () => {
    const exception = new UnknownDependenciesException('MyClass', {
      key: 'dependency',
    });

    expect(exception.moduleRef).toBeUndefined();
  });

  it('exposes the type, context and metadata', () => {
    const context = { key: 'dependency' };
    const metadata = { id: 'meta-id' };
    const exception = new UnknownDependenciesException(
      'MyClass',
      context,
      undefined,
      metadata,
    );

    expect(exception.type).toBe('MyClass');
    expect(exception.context).toBe(context);
    expect(exception.metadata).toBe(metadata);
  });
});
