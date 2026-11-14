import { describe, expect, it, vi } from 'vitest';
import { applyDecorators } from '../../../../../packages/common/decorators/core/apply-decorators.js';

describe('applyDecorators', () => {
  it('xc1(T): applies class decorators when target is a function and no descriptor is given', () => {
    const first = vi.fn();
    const second = vi.fn();
    class Target {}

    applyDecorators(first as any, second as any)(Target);

    expect(first).toHaveBeenCalledWith(Target);
    expect(second).toHaveBeenCalledWith(Target);
  });

  it('xc1(F): applies method decorators when a descriptor is given', () => {
    const decorator = vi.fn();
    const target = {};
    const descriptor = { value: () => undefined };

    const result = applyDecorators(decorator as any)(
      target,
      'handler',
      descriptor,
    );

    expect(decorator).toHaveBeenCalledWith(target, 'handler', descriptor);
    expect(result).toBeUndefined();
  });

  it('xc1(F): applies property decorators when target is not a function and no descriptor is given', () => {
    const decorator = vi.fn();
    const target = {};

    applyDecorators(decorator as any)(target, 'property');

    expect(decorator).toHaveBeenCalledWith(target, 'property', undefined);
  });

  it('handles an empty decorator list', () => {
    expect(() => applyDecorators()(class {})).not.toThrow();
  });
});
