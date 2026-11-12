import { describe, expect, it } from 'vitest';
import {
  addLeadingSlash,
  isConstructor,
  isEmpty,
  isEmptyArray,
  isFunction,
  isNil,
  isNumber,
  isObject,
  isPlainObject,
  isString,
  isSymbol,
  isUndefined,
  normalizePath,
  stripEndSlash,
} from '../../../../packages/common/utils/shared.utils.js';

class Custom {}
const nullProto = Object.create(null);
const inheritedConstructor = Object.create({ constructor: Object });
const missingConstructor = Object.create({});
const objectWrapper = new Number(1);
const symbol = Symbol('x');

describe('shared.utils (C3)', () => {
  describe('isUndefined', () => {
    it.each([
      [undefined, true],
      [null, false],
      [0, false],
      ['', false],
      [false, false],
    ])('%s -> %s', (value, expected) => {
      expect(isUndefined(value)).toBe(expected);
    });
  });

  describe('isObject', () => {
    it.each([
      [null, false],
      [undefined, false],
      ['x', false],
      [1, false],
      [() => undefined, false],
      [{}, true],
      [[], true],
      [new Date(), true],
      [Object.create(null), true],
    ])('%s -> %s', (value, expected) => {
      expect(isObject(value)).toBe(expected);
    });
  });

  describe('isPlainObject', () => {
    it.each([
      ['object literal', {}, true],
      ['null prototype', nullProto, true],
      ['inherited Object constructor', inheritedConstructor, true],
      ['missing own constructor', missingConstructor, false],
      ['class instance', new Custom(), false],
      ['array', [], false],
      ['date', new Date(), false],
      ['map', new Map(), false],
      ['object wrapper', objectWrapper, false],
      ['null', null, false],
      ['undefined', undefined, false],
      ['number', 1, false],
      ['function', () => undefined, false],
    ])('%s -> %s', (_label, value, expected) => {
      expect(isPlainObject(value)).toBe(expected);
    });
  });

  describe('addLeadingSlash', () => {
    it.each([
      [undefined, ''],
      [null, ''],
      [0, ''],
      ['', ''],
      [{}, ''],
      ['/foo', '/foo'],
      ['{/foo}', '{/foo}'],
      ['foo', '/foo'],
      ['foo/bar', '/foo/bar'],
      ['//foo', '//foo'],
    ])('%s -> %s', (value, expected) => {
      expect(addLeadingSlash(value as any)).toBe(expected);
    });
  });

  describe('normalizePath', () => {
    it.each([
      [undefined, '/'],
      ['', '/'],
      ['/', '/'],
      ['///', '/'],
      ['foo', '/foo'],
      ['/foo/', '/foo'],
      ['//foo///', '/foo'],
      ['a//b//', '/a/b'],
      ['/a/b/c', '/a/b/c'],
    ])('%s -> %s', (value, expected) => {
      expect(normalizePath(value)).toBe(expected);
    });
  });

  describe('stripEndSlash', () => {
    it.each([
      ['/foo/', '/foo'],
      ['/foo', '/foo'],
      ['/', ''],
      ['', ''],
      ['foo//', 'foo/'],
    ])('%s -> %s', (value, expected) => {
      expect(stripEndSlash(value)).toBe(expected);
    });
  });

  describe('type guards', () => {
    it.each([
      [() => undefined, true],
      [function named() {}, true],
      [class ClassValue {}, true],
      [{}, false],
      [null, false],
    ])('isFunction(%s) -> %s', (value, expected) => {
      expect(isFunction(value)).toBe(expected);
    });

    it.each([
      ['x', true],
      ['', true],
      [1, false],
      [null, false],
    ])('isString(%s) -> %s', (value, expected) => {
      expect(isString(value)).toBe(expected);
    });

    it.each([
      [1, true],
      [NaN, true],
      [Infinity, true],
      ['1', false],
      [null, false],
    ])('isNumber(%s) -> %s', (value, expected) => {
      expect(isNumber(value)).toBe(expected);
    });

    it.each([
      ['constructor', true],
      ['Constructor', false],
      ['', false],
      [undefined, false],
    ])('isConstructor(%s) -> %s', (value, expected) => {
      expect(isConstructor(value as any)).toBe(expected);
    });

    it.each([
      [undefined, true],
      [null, true],
      [0, false],
      ['', false],
      [false, false],
      [NaN, false],
    ])('isNil(%s) -> %s', (value, expected) => {
      expect(isNil(value)).toBe(expected);
    });

    it.each([
      [symbol, true],
      ['x', false],
      [1, false],
      [Object(Symbol('x')), false],
    ])('isSymbol(%s) -> %s', (value, expected) => {
      expect(isSymbol(value)).toBe(expected);
    });
  });

  describe('isEmpty', () => {
    it.each([
      [undefined, true],
      [null, true],
      [[], true],
      [[1], false],
      ['', false],
      [0, false],
      [{}, false],
    ])('%s -> %s', (value, expected) => {
      expect(isEmpty(value)).toBe(expected);
    });
  });

  describe('isEmptyArray', () => {
    it.each([
      [[], true],
      [[1], false],
      ['x', false],
      [null, false],
      [{}, false],
    ])('%s -> %s', (value, expected) => {
      expect(isEmptyArray(value)).toBe(expected);
    });
  });
});
