import { describe, expect, it } from 'vitest';
import { getSortedHierarchyLevels } from '../../../../../packages/core/hooks/utils/get-sorted-hierarchy-levels.js';

describe('getSortedHierarchyLevels', () => {
  it('xc1(T): sorts ascending by default', () => {
    const groups = new Map<number, unknown[]>([
      [3, []],
      [1, []],
      [2, []],
    ]);

    expect(getSortedHierarchyLevels(groups)).toEqual([1, 2, 3]);
  });

  it('xc1(F): sorts descending when requested', () => {
    const groups = new Map<number, unknown[]>([
      [3, []],
      [1, []],
      [2, []],
    ]);

    expect(getSortedHierarchyLevels(groups, 'DESC')).toEqual([3, 2, 1]);
  });

  it('returns an empty list for empty groups', () => {
    expect(getSortedHierarchyLevels(new Map())).toEqual([]);
  });
});
