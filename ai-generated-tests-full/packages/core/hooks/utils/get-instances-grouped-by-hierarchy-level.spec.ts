import { describe, expect, it, vi } from 'vitest';
import { getInstancesGroupedByHierarchyLevel } from '../../../../../packages/core/hooks/utils/get-instances-grouped-by-hierarchy-level.js';

function wrapper(options: {
  static?: boolean;
  level?: number;
  transient?: boolean;
  instance?: unknown;
  transientInstances?: Array<{ instance: unknown } | null>;
}) {
  return {
    isDependencyTreeStatic: () => options.static ?? true,
    hierarchyLevel: options.level ?? 0,
    isTransient: options.transient ?? false,
    getStaticTransientInstances: () => options.transientInstances ?? [],
    instance: options.instance,
  } as any;
}

describe('getInstancesGroupedByHierarchyLevel', () => {
  it('groups static instances by hierarchy level', () => {
    const grouped = getInstancesGroupedByHierarchyLevel([
      ['a', wrapper({ level: 1, instance: { name: 'a' } })],
      ['b', wrapper({ level: 2, instance: { name: 'b' } })],
      ['c', wrapper({ level: 1, instance: { name: 'c' } })],
    ]);

    expect(grouped.get(1)).toEqual([{ name: 'a' }, { name: 'c' }]);
    expect(grouped.get(2)).toEqual([{ name: 'b' }]);
  });

  it('skips wrappers with non-static dependency trees', () => {
    const grouped = getInstancesGroupedByHierarchyLevel([
      ['a', wrapper({ static: false, instance: {} })],
    ]);

    expect(grouped.size).toBe(0);
  });

  it('xc1(T): expands static transient instances and filters empty entries', () => {
    const grouped = getInstancesGroupedByHierarchyLevel([
      [
        'a',
        wrapper({
          transient: true,
          level: 3,
          instance: { ignored: true },
          transientInstances: [{ instance: { id: 1 } }, null, { instance: { id: 2 } }],
        }),
      ],
    ]);

    expect(grouped.get(3)).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it('xc1(F), xc2(T): pushes the wrapper instance when present', () => {
    const grouped = getInstancesGroupedByHierarchyLevel([
      ['a', wrapper({ level: 0, instance: { id: 1 } })],
    ]);

    expect(grouped.get(0)).toEqual([{ id: 1 }]);
  });

  it('xc2(F): ignores wrappers without an instance', () => {
    const grouped = getInstancesGroupedByHierarchyLevel([
      ['a', wrapper({ level: 0, instance: undefined })],
    ]);

    expect(grouped.get(0)).toEqual([]);
  });

  it('accepts maps and arrays in the same call', () => {
    const map = new Map([
      ['a', wrapper({ level: 0, instance: { id: 'map' } })],
    ]);
    const grouped = getInstancesGroupedByHierarchyLevel(map, [
      ['b', wrapper({ level: 0, instance: { id: 'array' } })],
    ]);

    expect(grouped.get(0)).toEqual([{ id: 'map' }, { id: 'array' }]);
  });
});
