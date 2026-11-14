import { describe, expect, it } from 'vitest';
import { DefaultValuePipe } from '../../../../packages/common/pipes/default-value.pipe.js';

const metadata = { type: 'query' } as any;

describe('DefaultValuePipe', () => {
  describe('transform', () => {
    it.each([
      ['undefined', undefined],
      ['null', null],
      ['NaN', Number.NaN],
    ])('returns the default for %s', (_label, value) => {
      expect(new DefaultValuePipe('fallback').transform(value, metadata)).toBe(
        'fallback',
      );
    });

    it.each([
      ['zero', 0],
      ['empty string', ''],
      ['false', false],
      ['finite number', 5],
    ])('returns the original value for %s', (_label, value) => {
      expect(new DefaultValuePipe('fallback').transform(value, metadata)).toBe(
        value,
      );
    });

    it('copies arrays so mutations do not leak between calls', () => {
      const pipe = new DefaultValuePipe([1, [2]]);
      const first = pipe.transform(undefined) as any[];
      first.push(3);
      (first[1] as number[]).push(4);
      expect(pipe.transform(undefined)).toEqual([1, [2]]);
    });

    it('copies plain objects including nested values', () => {
      const pipe = new DefaultValuePipe({ a: { b: 1 } });
      const value = pipe.transform(null) as any;
      value.a.b = 2;
      expect((pipe.transform(null) as any).a.b).toBe(1);
    });

    it('preserves shared and circular references while copying', () => {
      const shared = { value: 1 };
      const source: any = { left: shared, right: shared };
      source.self = source;
      const pipe = new DefaultValuePipe(source);
      const copy = pipe.transform(undefined) as any;
      expect(copy.left).toBe(copy.right);
      expect(copy.self).toBe(copy);
      expect(copy.left).not.toBe(shared);
    });

    it('returns non-plain objects as is', () => {
      const map = new Map([['a', 1]]);
      const instance = new (class A {})();
      expect(new DefaultValuePipe(map).transform(undefined)).toBe(map);
      expect(new DefaultValuePipe(instance).transform(undefined)).toBe(instance);
    });

    it('returns arrays with a non-standard prototype as is', () => {
      class MyArray extends Array {}
      const array = MyArray.from([1]);
      expect(new DefaultValuePipe(array).transform(undefined)).toBe(array);
    });
  });
});
