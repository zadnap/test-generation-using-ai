import { describe, expect, it } from 'vitest';
import { stripProtoKeys } from '../../../../packages/common/utils/strip-proto-keys.util.js';

describe('stripProtoKeys', () => {
  it.each([
    ['null', null],
    ['undefined', undefined],
    ['string', 'value'],
    ['number', 1],
  ])('ignores %s values', (_label, value) => {
    expect(() => stripProtoKeys(value)).not.toThrow();
  });

  it('removes dangerous keys from an object', () => {
    const value = JSON.parse(
      '{"__proto__":{"polluted":true},"prototype":"x","constructor":"y","safe":1}',
    );
    stripProtoKeys(value);
    expect(Object.hasOwn(value, '__proto__')).toBe(false);
    expect(Object.hasOwn(value, 'prototype')).toBe(false);
    expect(Object.hasOwn(value, 'constructor')).toBe(false);
    expect(value.safe).toBe(1);
  });

  it('walks arrays and skips holes', () => {
    const sparse: any[] = [];
    sparse[3] = { prototype: 'x', constructor: 'y' };
    stripProtoKeys(sparse);
    expect(Object.hasOwn(sparse[3], 'prototype')).toBe(false);
  });

  it('handles cycles without looping forever', () => {
    const value: any = { child: {} };
    value.child.parent = value;
    expect(() => stripProtoKeys(value)).not.toThrow();
  });

  it.each([
    ['Date', new Date()],
    ['RegExp', /x/],
    ['Error', new Error('x')],
    ['Map', new Map()],
    ['Set', new Set()],
    ['WeakMap', new WeakMap()],
    ['WeakSet', new WeakSet()],
    ['typed array', new Uint8Array([1, 2])],
  ])('skips built-in %s instances', (_label, value) => {
    expect(() => stripProtoKeys(value)).not.toThrow();
  });

  it('keeps a constructor that is a built-in type', () => {
    const value: any = Object.create(null);
    Object.defineProperty(value, 'constructor', {
      value: Date,
      enumerable: true,
      configurable: true,
    });
    stripProtoKeys(value);
    expect(Object.hasOwn(value, 'constructor')).toBe(true);
  });

  it('removes a falsy own constructor', () => {
    const value: any = { constructor: null };
    stripProtoKeys(value);
    expect(Object.hasOwn(value, 'constructor')).toBe(false);
  });

  it('walks nested objects', () => {
    const nested: any = { prototype: 1 };
    stripProtoKeys({ nested });
    expect(Object.hasOwn(nested, 'prototype')).toBe(false);
  });
});
