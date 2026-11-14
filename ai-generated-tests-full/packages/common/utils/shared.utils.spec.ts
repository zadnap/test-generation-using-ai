import { describe, expect, it } from 'vitest';
import {
  addLeadingSlash,
  isEmpty,
  isEmptyArray,
  isConstructor,
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

describe('shared.utils', () => {
  describe('isUndefined', () => {
    it.each([
      ['undefined', undefined, true],
      ['null', null, false],
      ['number', 0, false],
      ['string', '', false],
    ])('returns expected for %s', (_label, value, expected) => {
      expect(isUndefined(value)).toBe(expected);
    });
  });

  describe('isNil', () => {
    it.each([
      ['undefined', undefined, true],
      ['null', null, true],
      ['number', 0, false],
      ['string', '', false],
    ])('returns expected for %s', (_label, value, expected) => {
      expect(isNil(value)).toBe(expected);
    });
  });

  describe('isObject', () => {
    it.each([
      ['undefined', undefined, false],
      ['null', null, false],
      ['string', 'x', false],
      ['number', 1, false],
      ['object literal', {}, true],
      ['array', [], true],
      ['function', () => undefined, false],
    ])('returns expected for %s', (_label, value, expected) => {
      expect(isObject(value)).toBe(expected);
    });
  });

  describe('isPlainObject', () => {
    it.each([
      ['undefined', undefined, false],
      ['null', null, false],
      ['string', 'x', false],
      ['plain object literal', { a: 1 }, true],
      ['object with null prototype', Object.create(null), true],
      ['array', [], false],
      ['date', new Date(), false],
      ['class instance', new (class A {})(), false],
      ['prototype without own constructor', Object.create(Object.create(null)), false],
      ['prototype with non-function constructor', Object.create({ constructor: 1 }), false],
      ['object with shadowing constructor property', { constructor: 1 }, true],
    ])('returns expected for %s', (_label, value, expected) => {
      expect(isPlainObject(value)).toBe(expected);
    });
  });

  describe('addLeadingSlash', () => {
    it.each([
      ['undefined', undefined, ''],
      ['empty string', '', ''],
      ['number cast to any', 42 as any, ''],
      ['already prefixed', '/x', '/x'],
      ['without prefix', 'x', '/x'],
      ['brace path', '{/x}', '{/x}'],
    ])('returns expected for %s', (_label, value, expected) => {
      expect(addLeadingSlash(value)).toBe(expected);
    });
  });

  describe('normalizePath', () => {
    it.each([
      ['undefined', undefined, '/'],
      ['empty string', '', '/'],
      ['root', '/', '/'],
      ['without leading slash', 'a/b', '/a/b'],
      ['trailing slashes', 'a/b///', '/a/b'],
      ['duplicate slashes', '/a//b', '/a/b'],
    ])('returns expected for %s', (_label, value, expected) => {
      expect(normalizePath(value)).toBe(expected);
    });
  });

  describe('stripEndSlash', () => {
    it.each([
      ['no trailing slash', 'a', 'a'],
      ['trailing slash', 'a/', 'a'],
      ['root', '/', ''],
    ])('returns expected for %s', (_label, value, expected) => {
      expect(stripEndSlash(value)).toBe(expected);
    });
  });

  describe('predicates', () => {
    it.each([
      ['function', () => undefined, true],
      ['string', 'x', false],
    ])('isFunction for %s', (_label, value, expected) => {
      expect(isFunction(value)).toBe(expected);
    });

    it.each([
      ['string', 'x', true],
      ['number', 1, false],
    ])('isString for %s', (_label, value, expected) => {
      expect(isString(value)).toBe(expected);
    });

    it.each([
      ['number', 1, true],
      ['string', '1', false],
    ])('isNumber for %s', (_label, value, expected) => {
      expect(isNumber(value)).toBe(expected);
    });

    it.each([
      ['constructor keyword', 'constructor', true],
      ['other string', 'other', false],
    ])('isConstructor for %s', (_label, value, expected) => {
      expect(isConstructor(value)).toBe(expected);
    });

    it.each([
      ['symbol', Symbol('x'), true],
      ['string', 'x', false],
    ])('isSymbol for %s', (_label, value, expected) => {
      expect(isSymbol(value)).toBe(expected);
    });
  });

  describe('isEmpty', () => {
    it.each([
      ['undefined', undefined, true],
      ['null', null, true],
      ['empty array', [], true],
      ['non-empty array', [1], false],
      ['non-array object', {}, false],
      ['string', '', false],
    ])('returns expected for %s', (_label, value, expected) => {
      expect(isEmpty(value)).toBe(expected);
    });
  });

  describe('isEmptyArray', () => {
    it.each([
      ['non-array', {}, false],
      ['empty array', [], true],
      ['non-empty array', [1], false],
    ])('returns expected for %s', (_label, value, expected) => {
      expect(isEmptyArray(value)).toBe(expected);
    });
  });
});
