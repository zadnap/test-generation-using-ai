import { describe, expect, it } from 'vitest';
import { stripProtoKeys } from '../../../../packages/common/utils/strip-proto-keys.util.js';

describe('stripProtoKeys (C3)', () => {
  it.each([
    ['undefined', undefined],
    ['null', null],
    ['number', 1],
    ['string', 'x'],
    ['boolean', false],
    ['symbol', Symbol('x')],
    ['function', () => undefined],
  ])('ignores %s', (_label, value) => {
    expect(() => stripProtoKeys(value)).not.toThrow();
  });

  it('removes dangerous keys recursively from objects and arrays', () => {
    const value = JSON.parse(
      '{"__proto__":{"polluted":true},"prototype":"p","constructor":"c","safe":1,"nested":{"__proto__":{"x":1},"prototype":2,"constructor":3,"keep":4},"arr":[{"__proto__":{"y":1},"constructor":2,"keep":true}]}',
    );

    stripProtoKeys(value);

    expect(value).toEqual({
      safe: 1,
      nested: { keep: 4 },
      arr: [{ keep: true }],
    });
  });

  it('skips holes in a sparse array', () => {
    const value: any[] = [];
    value[100000] = { constructor: 'c', prototype: 'p', keep: true };

    stripProtoKeys(value);

    expect(value[100000]).toEqual({ keep: true });
  });

  it('preserves shared references and handles cycles', () => {
    const shared = { constructor: 'c', keep: 1 };
    const value: any = { first: shared, second: shared };
    value.self = value;

    stripProtoKeys(value);

    expect(value.self).toBe(value);
    expect(value.first).toBe(value.second);
    expect(value.first).toEqual({ keep: 1 });
  });

  it('walks inherited enumerable properties', () => {
    const nested = { constructor: 'c', prototype: 'p', keep: 1 };
    const proto = { nested };
    const value: any = Object.create(proto);
    value.safe = 1;

    stripProtoKeys(value);

    expect(nested).toEqual({ keep: 1 });
    expect(value.safe).toBe(1);
  });

  it('keeps the own constructor when it is a built-in type', () => {
    const value: any = { constructor: Date, prototype: 'p', safe: 1 };
    stripProtoKeys(value);

    expect(value).toEqual({ constructor: Date, safe: 1 });
  });

  it('removes a falsy constructor', () => {
    const value: any = { constructor: null, safe: 1 };
    stripProtoKeys(value);

    expect(value).toEqual({ safe: 1 });
  });

  it.each([
    ['Date', new Date()],
    ['RegExp', /x/],
    ['Error', new Error('x')],
    ['Map', new Map()],
    ['Set', new Set()],
    ['WeakMap', new WeakMap()],
    ['WeakSet', new WeakSet()],
  ])('skips a built-in %s instance', (_label, value: any) => {
    value.prototype = 'keep';
    stripProtoKeys(value);
    expect(value.prototype).toBe('keep');
  });

  it('skips typed arrays and buffers', () => {
    const typed: any = new Uint8Array([1, 2]);
    typed.prototype = 'keep';
    typed.constructor = 'keep';
    const buffer: any = Buffer.from([1, 2]);
    buffer.prototype = 'keep';

    stripProtoKeys(typed);
    stripProtoKeys(buffer);

    expect(typed.prototype).toBe('keep');
    expect(typed.constructor).toBe('keep');
    expect(buffer.prototype).toBe('keep');
  });

  it('handles empty objects and arrays', () => {
    const object = {};
    const array: unknown[] = [];
    stripProtoKeys(object);
    stripProtoKeys(array);
    expect(object).toEqual({});
    expect(array).toEqual([]);
  });
});
