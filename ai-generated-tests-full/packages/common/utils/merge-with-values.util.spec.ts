import { describe, expect, it } from 'vitest';
import { MergeWithValues } from '../../../../packages/common/utils/merge-with-values.util.js';

describe('MergeWithValues', () => {
  class Base {
    constructor(public value: number) {}
    read() {
      return this.value;
    }
  }

  it.each([
    ['plain data', { extra: 'x' }, 'extra'],
    ['numeric data', { count: 3 }, 'count'],
  ])('merges %s onto the prototype', (_label, data, key) => {
    const Type = MergeWithValues(data)(Base);
    const instance = new Type(5);
    expect((instance as any)[key]).toEqual((data as any)[key]);
    expect(instance.read()).toBe(5);
    expect(Type.name).toBe(Base.name + JSON.stringify(data));
  });
});
