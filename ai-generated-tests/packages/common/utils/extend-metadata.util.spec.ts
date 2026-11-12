import { describe, expect, it } from 'vitest';
import {
  extendArrayMetadata,
  getParamArgsMetadata,
} from '../../../../packages/common/utils/extend-metadata.util.js';

describe('extend-metadata.util (C3)', () => {
  describe('extendArrayMetadata', () => {
    it('creates an array when no metadata exists', () => {
      const target = () => undefined;
      extendArrayMetadata('test:new', ['a'], target);

      expect(Reflect.getMetadata('test:new', target)).toEqual(['a']);
    });

    it('appends to the existing metadata', () => {
      const target = () => undefined;
      Reflect.defineMetadata('test:existing', ['a'], target);
      extendArrayMetadata('test:existing', ['b', 'c'], target);

      expect(Reflect.getMetadata('test:existing', target)).toEqual([
        'a',
        'b',
        'c',
      ]);
    });

    it('accepts an empty metadata array', () => {
      const target = () => undefined;
      extendArrayMetadata('test:empty', [], target);

      expect(Reflect.getMetadata('test:empty', target)).toEqual([]);
    });
  });

  describe('getParamArgsMetadata', () => {
    it('returns an empty object when no metadata exists', () => {
      class Target {
        method() {}
      }
      const target = new Target();

      expect(
        getParamArgsMetadata('test:none', target, 'method', 0),
      ).toEqual({});
    });

    it('keeps an own entry when the parent has no metadata', () => {
      const key = 'test:own';
      class Target {
        method() {}
      }
      const entry = { index: 0 };
      Reflect.defineMetadata(key, { a: entry }, Target, 'method');

      expect(
        getParamArgsMetadata(key, new Target(), 'method', 0),
      ).toEqual({ a: entry });
    });

    it('filters the inherited entry at the same index', () => {
      const key = 'test:inherited';
      class Parent {
        method() {}
      }
      class Target extends Parent {
        method() {}
      }
      const inherited = { a: { index: 0 }, b: { index: 1 } };
      Reflect.defineMetadata(key, inherited, Parent, 'method');

      expect(
        getParamArgsMetadata(key, new Target(), 'method', 0),
      ).toEqual({ b: inherited.b });
    });

    it('keeps an overriding entry at the same index when it is a new object', () => {
      const key = 'test:override';
      class Parent {
        method() {}
      }
      class Target extends Parent {
        method() {}
      }
      const inherited = { a: { index: 0 }, b: { index: 1 } };
      Reflect.defineMetadata(key, inherited, Parent, 'method');
      const overriding = { a: inherited.a, b: { index: 1 }, c: { index: 2 } };
      Reflect.defineMetadata(key, overriding, Target, 'method');

      expect(
        getParamArgsMetadata(key, new Target(), 'method', 0),
      ).toEqual({ b: overriding.b, c: overriding.c });
      expect(
        getParamArgsMetadata(key, new Target(), 'method', 1),
      ).toEqual(overriding);
    });

    it('supports a symbol method key', () => {
      const key = 'test:symbol';
      const method = Symbol('method');
      class Target {}
      const entry = { index: 0 };
      Reflect.defineMetadata(key, { a: entry }, Target, method);

      expect(getParamArgsMetadata(key, new Target(), method, 0)).toEqual({
        a: entry,
      });
    });
  });
});
