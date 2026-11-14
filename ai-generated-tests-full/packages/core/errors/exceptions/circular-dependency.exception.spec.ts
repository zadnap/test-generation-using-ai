import { describe, expect, it } from 'vitest';
import { CircularDependencyException } from '../../../../../packages/core/errors/exceptions/circular-dependency.exception.js';

describe('CircularDependencyException', () => {
  it('xc1(T): mentions the context', () => {
    const exception = new CircularDependencyException('CatsModule');

    expect(exception.message).toContain('inside CatsModule');
    expect(exception.message).toContain('forwardRef()');
  });

  it('xc1(F): omits the context when not provided', () => {
    const exception = new CircularDependencyException();

    expect(exception.message).not.toContain('inside');
  });
});
