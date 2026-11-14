import { describe, expect, it } from 'vitest';
import {
  InvalidDecoratorItemException,
  validateEach,
} from '../../../../packages/common/utils/validate-each.util.js';

describe('InvalidDecoratorItemException', () => {
  it('exposes a readable message through what()', () => {
    const error = new InvalidDecoratorItemException('Deco', 'item', 'Ctx');
    expect(error.what()).toBe('Invalid item passed to Deco() decorator (Ctx).');
    expect(error.message).toBe(error.what());
  });
});

describe('validateEach', () => {
  it.each([
    ['missing context', undefined],
    ['empty context', {}],
    ['empty name', { name: '' }],
  ])('returns true for %s', (_label, context) => {
    expect(
      validateEach(context as any, [1], () => false, 'Deco', 'item'),
    ).toBe(true);
  });

  it('returns true when every item passes the predicate', () => {
    expect(
      validateEach({ name: 'Ctx' }, [1, 2], value => value > 0, 'Deco', 'item'),
    ).toBe(true);
  });

  it('throws when an item fails the predicate', () => {
    expect(() =>
      validateEach({ name: 'Ctx' }, [1, -2], value => value > 0, 'Deco', 'item'),
    ).toThrow(InvalidDecoratorItemException);
  });
});
