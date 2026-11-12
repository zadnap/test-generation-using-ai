import { describe, expect, it, vi } from 'vitest';
import {
  InvalidDecoratorItemException,
  validateEach,
} from '../../../../packages/common/utils/validate-each.util.js';

describe('validateEach (C3)', () => {
  const predicate = (value: unknown) => typeof value === 'string';

  it.each([null, undefined, {}, { name: '' }])(
    'returns true for an invalid context %j',
    context => {
      const spy = vi.fn(predicate);
      expect(
        validateEach(context as any, ['x'], spy, 'Decorator', 'item'),
      ).toBe(true);
      expect(spy).not.toHaveBeenCalled();
    },
  );

  it('returns true for an empty array', () => {
    expect(
      validateEach({ name: 'C' }, [], predicate, 'Decorator', 'item'),
    ).toBe(true);
  });

  it('returns true when every item satisfies the predicate', () => {
    expect(
      validateEach({ name: 'C' }, ['a', 'b'], predicate, 'Decorator', 'item'),
    ).toBe(true);
  });

  it('throws when an item does not satisfy the predicate', () => {
    const context = { name: 'C' };
    expect(() =>
      validateEach(context, ['a', 1], predicate, 'Decorator', 'item'),
    ).toThrowError(InvalidDecoratorItemException);
  });

  it('short-circuits at the first invalid item', () => {
    const spy = vi.fn(predicate);
    expect(() =>
      validateEach({ name: 'C' }, ['a', 1, 2], spy, 'Decorator', 'item'),
    ).toThrowError();
    expect(spy).toHaveBeenCalledTimes(2);
  });

  describe('InvalidDecoratorItemException', () => {
    it('exposes the formatted message', () => {
      const error = new InvalidDecoratorItemException(
        'Decorator',
        'item',
        'Context',
      );

      expect(error.message).toBe(
        'Invalid item passed to Decorator() decorator (Context).',
      );
      expect(error.what()).toBe(error.message);
    });
  });
});
