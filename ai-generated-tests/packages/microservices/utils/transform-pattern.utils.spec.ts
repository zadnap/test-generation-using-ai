import { describe, expect, it } from 'vitest';
import { transformPatternToRoute } from '../../../../packages/microservices/utils/transform-pattern.utils.js';

/**
 * CFG / C3 decisions of transformPatternToRoute:
 * D1: isString(pattern) || isNumber(pattern)     -> 1c1, 1c2
 * D2: !isObject(pattern)                         -> 2
 * D3: depth > maxDepth                           -> 3
 * D4: keys.length > maxKeys                      -> 4
 * D5: keys.some(key => key.length > maxKeyLength)-> 5
 * D6: isString(value) (per mapped key)           -> 6
 * Independent paths (C3) = 6 + 1 = 7.
 */
describe('transformPatternToRoute', () => {
  describe('D1 - string/number early return', () => {
    it('1c1(T) - string pattern short-circuits before number check', () => {
      expect(transformPatternToRoute('user.created')).toBe('user.created');
    });

    it('1c1(F) 1c2(T) - numeric pattern', () => {
      expect(transformPatternToRoute(42)).toBe('42');
    });

    it('1c1(F) 1c2(F) - non string/number primitive goes on to D2', () => {
      expect(transformPatternToRoute(true)).toBe(true);
    });
  });

  describe('D2 - non object pattern is returned as is', () => {
    it('2(T) - symbol', () => {
      const symbol = Symbol('pattern');
      expect(transformPatternToRoute(symbol as any)).toBe(symbol);
    });

    it('2(F) - null is not string/number and not object', () => {
      expect(transformPatternToRoute(null as any)).toBe(null);
    });
  });

  describe('D3 - recursion depth guard', () => {
    it('3(T) - depth above maxDepth', () => {
      expect(transformPatternToRoute({ a: 1 }, 6)).toBe('[MAX_DEPTH_REACHED]');
    });

    it('3(F) - depth equal to maxDepth still serializes', () => {
      expect(transformPatternToRoute({ a: 1 }, 5)).toBe('{"a":1}');
    });

    it('3(F) - nested object increments depth and reaches the guard', () => {
      expect(transformPatternToRoute({ a: { b: { c: 1 } } }, 4)).toBe(
        '{"a":{"b":[MAX_DEPTH_REACHED]}}',
      );
    });
  });

  describe('D4 - key count guard', () => {
    it('4(T) - more keys than maxKeys', () => {
      expect(transformPatternToRoute({ a: 1, b: 2 }, 0, 5, 1)).toBe(
        '[TOO_MANY_KEYS]',
      );
    });

    it('4(F) - exactly maxKeys is accepted', () => {
      expect(transformPatternToRoute({ a: 1, b: 2 }, 0, 5, 2)).toBe(
        '{"a":1,"b":2}',
      );
    });
  });

  describe('D5 - key length guard', () => {
    it('5(T) - a key longer than maxKeyLength', () => {
      expect(transformPatternToRoute({ long: 1 }, 0, 5, 20, 3)).toBe(
        '[KEY_TOO_LONG]',
      );
    });

    it('5(F) - key length equal to maxKeyLength is accepted', () => {
      expect(transformPatternToRoute({ key: 1 }, 0, 5, 20, 3)).toBe(
        '{"key":1}',
      );
    });
  });

  describe('D6 - per-key value handling and sorting/escaping', () => {
    it('6(T) - string value is quoted', () => {
      expect(transformPatternToRoute({ a: 'b' })).toBe('{"a":"b"}');
    });

    it('6(F) - numeric/boolean/null/array values recurse', () => {
      expect(transformPatternToRoute({ a: 1, b: true, c: null })).toBe(
        '{"a":1,"b":true,"c":null}',
      );
      expect(transformPatternToRoute({ list: ['x', 'y'] })).toBe(
        '{"list":{"0":"x","1":"y"}}',
      );
    });

    it('6(T) 6(F) - keys are sorted and quotes/backslashes escaped', () => {
      expect(transformPatternToRoute({ b: 'say "hi"', a: 'back\\slash' })).toBe(
        '{"a":"back\\\\slash","b":"say \\"hi\\""}',
      );
    });

    it('nested string is quoted at recursion level 1 (6(T) with depth > 0)', () => {
      expect(transformPatternToRoute({ outer: 'v' }, 0)).toBe('{"outer":"v"}');
    });
  });
});
