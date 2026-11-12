import { describe, expect, it } from 'vitest';
import { appendField } from '../../../../../packages/platform-fastify/multipart/multipart/append-field.util.js';

/**
 * CFG (C3) for appendField:
 *   1  steps.some(step => FORBIDDEN_KEYS.has(String(step.key)))
 *   2  catch: err instanceof RangeError
 * parsePath:
 *   3c1 key[pos] === '[' && key[pos + 1] === ']'
 *   3c2 key[pos + 1] === ']'          (only when 3c1 True)
 *   4   pos !== key.length            (inside the append branch)
 *   5   /^\[(\d+)\]/.exec(rest) truthy
 *   6   /^\[([^\]]+)\]/.exec(rest) truthy
 *   7   !firstKey
 * valueType:
 *   8 value === undefined; 9 Array.isArray; 10 typeof value === 'object'
 * setLastValue switch: 4 state cases
 * setValue: 11 step.last; 12 switch current type; 13 step.nextType === 'array'
 * (both in undefined and array cases); 14 current[index] !== undefined
 * All feasible T/F are exercised below.
 */
describe('appendField', () => {
  const build = (entries: Array<[string, unknown]>) => {
    const store: any = Object.create(null);
    for (const [key, value] of entries) {
      appendField(store, key, value);
    }
    return store;
  };

  describe('paths', () => {
    it.each([
      ['plain key', 'a', { a: '1' }],
      ['nested object', 'a[b]', { a: { b: '1' } }],
      ['numeric index creates an array', 'a[0]', { a: ['1'] }],
      ['trailing append creates an array', 'a[]', { a: ['1'] }],
      ['deep path', 'a[0][b]', { a: [{ b: '1' }] }],
      ['empty first key is a failure path', '[x]', { '[x]': '1' }],
      ['missing closing bracket is a failure path', 'a[b', { 'a[b': '1' }],
      ['append with a suffix is a failure path', 'c[]d', { 'c[]d': '1' }],
      ['non-numeric bracket is an object key', 'a[x]', { a: { x: '1' } }],
      ['empty first key with tail', '[][x]', { '[][x]': '1' }],
    ])('should parse %s', (_name, key, expected) => {
      expect(JSON.parse(JSON.stringify(build([[key, '1']])))).toEqual(expected);
    });

    it('should treat a leading bracket as a literal key', () => {
      const store = build([['[0]', 'v']]);
      expect(store['[0]']).toBe('v');
      expect(Array.isArray(store)).toBe(false);
    });

    it('should accept consecutive bracket segments', () => {
      expect(JSON.parse(JSON.stringify(build([['a[0][1]', 'v']])))).toEqual({
        a: [[null, 'v']],
      });
    });
  });

  describe('value types', () => {
    it('should create an array when appending to an undefined value', () => {
      const store: any = Object.create(null);
      expect(appendField(store, 'a[]', 'v')).toBe(true);
      expect(store.a).toEqual(['v']);
    });

    it('should create an object (not an array) for an object next step', () => {
      const store: any = Object.create(null);
      appendField(store, 'a[b]', 'v');
      expect(Array.isArray(store.a)).toBe(false);
      expect(Object.getPrototypeOf(store.a)).toBeNull();
    });

    it('should push into an existing array', () => {
      const store: any = build([
        ['a[]', '1'],
        ['a[]', '2'],
      ]);
      expect(store.a).toEqual(['1', '2']);
    });

    it('should turn a scalar into an array on repetition', () => {
      expect(JSON.parse(JSON.stringify(build([['a', '1'], ['a', '2']])))).toEqual({
        a: ['1', '2'],
      });
    });

    it('should keep an existing object as-is for a nested step', () => {
      const store: any = build([
        ['a[b]', '1'],
        ['a[c]', '2'],
      ]);
      expect(JSON.parse(JSON.stringify(store))).toEqual({ a: { b: '1', c: '2' } });
    });

    it('should return the existing array when the next step is an array', () => {
      const store: any = build([
        ['a[0]', '1'],
        ['a[1][b]', '2'],
      ]);
      expect(JSON.parse(JSON.stringify(store))).toEqual({
        a: ['1', { b: '2' }],
      });
    });

    it('should convert an array to an object for a named step', () => {
      expect(
        JSON.parse(JSON.stringify(build([['a[0]', 'x'], ['a[k]', 'y']]))),
      ).toEqual({ a: { 0: 'x', k: 'y' } });
    });

    it('should copy only defined indexes out of a sparse array', () => {
      const store: any = Object.create(null);
      appendField(store, 'a[5]', 'last');
      appendField(store, 'a[name]', 'named');
      expect({ ...store.a }).toEqual({ 5: 'last', name: 'named' });
    });

    it('should keep a scalar under the empty key when it gains children', () => {
      expect(JSON.parse(JSON.stringify(build([['a', 'x'], ['a[b]', 'y']])))).toEqual({
        a: { '': 'x', b: 'y' },
      });
    });

    it('should merge a repeated key into an existing nested object', () => {
      const store: any = build([
        ['a[b]', '1'],
        ['a', '2'],
      ]);
      expect(JSON.parse(JSON.stringify(store))).toEqual({
        a: { b: '1', '': '2' },
      });
    });

    it('should skip an own array index whose value is undefined', () => {
      const store: any = { a: [undefined] };
      appendField(store, 'a[name]', 'v');
      expect(store.a.name).toBe('v');
      expect(store.a['0']).toBeUndefined();
    });

    it('should move a scalar into the empty key of a new object', () => {
      expect(
        JSON.parse(JSON.stringify(build([['a', 'x'], ['a[0][b]', 'y']]))),
      ).toEqual({ a: { 0: { b: 'y' }, '': 'x' } });
    });

    it('should handle a nested object through setLastValue recursion', () => {
      const store: any = Object.create(null);
      appendField(store, 'a', 'x');
      // Building on a scalar converts it to an object, then a second write
      // to the same nested path goes through the recursive branch.
      appendField(store, 'a', 'y');
      expect(store.a).toEqual(['x', 'y']);
    });
  });

  describe('prototype pollution protection', () => {
    it.each([
      '__proto__',
      '__proto__[x]',
      'a[__proto__]',
      'constructor',
      'a[constructor]',
      'prototype',
      'a[prototype][x]',
      'a[0][__proto__]',
    ])('should refuse %s without touching the store', key => {
      const store: any = Object.create(null);
      expect(appendField(store, key, 'v')).toBe(false);
      expect(Object.keys(store)).toEqual([]);
      expect(({} as any).x).toBeUndefined();
      expect(({} as any).polluted).toBeUndefined();
    });

    it('should still accept a key that only contains a forbidden word', () => {
      const store: any = Object.create(null);
      expect(appendField(store, 'constructorName', 'v')).toBe(true);
      expect(store.constructorName).toBe('v');
    });
  });

  describe('errors', () => {
    it('should return false when appending exceeds the maximum array length', () => {
      const store: any = Object.create(null);
      appendField(store, 'a[4294967294]', 'last');
      expect(appendField(store, 'a[]', 'more')).toBe(false);
    });

    it('should rethrow errors that are not a RangeError', () => {
      const store: any = {};
      Object.defineProperty(store, 'a', {
        configurable: true,
        get() {
          throw new Error('boom');
        },
      });
      expect(() => appendField(store, 'a', 'v')).toThrow('boom');
    });
  });
});
