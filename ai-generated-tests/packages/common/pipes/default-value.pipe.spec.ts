import { describe, expect, it } from 'vitest';
import { DefaultValuePipe } from '../../../../packages/common/pipes/default-value.pipe.js';

class PlainValue {}
class Values extends Array<string> {}

describe('DefaultValuePipe (C3)', () => {
  describe('transform', () => {
    const defaultValue = { fallback: true };

    it.each([
      ['undefined', undefined],
      ['null', null],
      ['NaN', Number.NaN],
    ])('returns a copy of the default for %s', (_label, value) => {
      const pipe = new DefaultValuePipe(defaultValue);
      const result = pipe.transform(value);
      expect(result).toEqual(defaultValue);
      expect(result).not.toBe(defaultValue);
    });

    it.each([
      ['zero', 0],
      ['empty string', ''],
      ['false', false],
      ['regular number', 42],
      ['plain string', 'value'],
    ])('returns the original %s value', (_label, value) => {
      const pipe = new DefaultValuePipe(defaultValue);
      expect(pipe.transform(value)).toBe(value);
    });

    it('does not copy the default when the provided value is an object', () => {
      const pipe = new DefaultValuePipe(defaultValue);
      const value = { own: true };
      expect(pipe.transform(value)).toBe(value);
    });
  });

  describe('copyDefaultValue', () => {
    it('copies an array and its nested plain objects/arrays', () => {
      const source = [{ nested: { value: 1 } }, ['a', { b: 2 }]];
      const pipe = new DefaultValuePipe(source);
      const first = pipe.transform(undefined) as any;
      const second = pipe.transform(undefined) as any;

      expect(first).toEqual(source);
      expect(first).not.toBe(source);
      expect(first[0]).not.toBe(source[0]);
      expect(first[0].nested).not.toBe(source[0].nested);
      expect(first[1][1]).not.toBe(source[1][1]);
      expect(second).not.toBe(first);
    });

    it('preserves shared and circular references', () => {
      const shared = { id: 1 };
      const source: any = { first: shared, second: shared };
      source.self = source;

      const copy = new DefaultValuePipe(source).transform(undefined) as any;
      expect(copy.self).toBe(copy);
      expect(copy.first).toBe(copy.second);
      expect(copy.first).not.toBe(shared);
    });

    it('keeps symbol keys and a null prototype', () => {
      const key = Symbol('key');
      const source = Object.assign(Object.create(null), {
        [key]: { nested: true },
      });

      const copy = new DefaultValuePipe(source).transform(undefined) as any;
      expect(Object.getPrototypeOf(copy)).toBeNull();
      expect(copy[key]).toEqual({ nested: true });
      expect(copy[key]).not.toBe(source[key]);
    });

    it.each([
      ['class instance', new PlainValue()],
      ['array subclass', new Values()],
      ['date', new Date()],
      ['map', new Map()],
    ])('returns a non-plain %s as is', (_label, value) => {
      const pipe = new DefaultValuePipe(value);
      expect(pipe.transform(undefined)).toBe(value);
    });

    it('returns primitive defaults as is', () => {
      const pipe = new DefaultValuePipe(10);
      expect(pipe.transform(undefined)).toBe(10);
    });
  });
});
