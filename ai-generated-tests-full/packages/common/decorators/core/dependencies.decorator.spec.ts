import { describe, expect, it } from 'vitest';
import { PARAMTYPES_METADATA } from '../../../../../packages/common/constants.js';
import {
  Dependencies,
  flatten,
} from '../../../../../packages/common/decorators/core/dependencies.decorator.js';

describe('flatten', () => {
  it('xc1(F): returns a shallow array unchanged when it contains no nested arrays', () => {
    expect(flatten([1, 2, 3])).toEqual([1, 2, 3]);
  });

  it('xc1(T): recursively flattens nested arrays', () => {
    expect(flatten([1, [2, [3, 4]], 5])).toEqual([1, 2, 3, 4, 5]);
  });

  it('returns an empty array for an empty input', () => {
    expect(flatten([])).toEqual([]);
  });
});

describe('Dependencies', () => {
  it('stores the flattened dependency list as parameter types', () => {
    class Target {}
    class A {}
    class B {}

    Dependencies(A, [B, [A]])(Target);

    expect(Reflect.getMetadata(PARAMTYPES_METADATA, Target)).toEqual([
      A,
      B,
      A,
    ]);
  });
});
