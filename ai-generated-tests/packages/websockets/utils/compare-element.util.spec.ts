import { describe, expect, it } from 'vitest';
import { compareElementAt } from '../../../../packages/websockets/utils/compare-element.util.js';

describe('compareElementAt', () => {
  it.each([
    [[1, 2], [1, 3], 0, true],
    [[1, 2], [1, 3], 1, false],
    [null, [1], 0, null],
    [[1], null, 0, null],
    [undefined, undefined, 0, undefined],
  ])(
    'should compare %j and %j at index %i -> %s',
    (prev: any, curr: any, index: number, expected: any) => {
      expect(compareElementAt(prev, curr, index)).toBe(expected);
    },
  );
});
