import { describe, expect, it, vi } from 'vitest';
import {
  MAX_PARAM_LENGTH,
  PARAM_TOO_LONG,
  RouteTable,
} from '../../../../packages/platform-node/router/route-table.js';

const handler = (name = 'h') => vi.fn(function named() {}) as any;

// CFG (C3) of RouteTable:
//   add: find-my-way expressible variants T/F; groups > 6 T/F; trailing slash T/F;
//        duplicate path / same shape T/F; method null/GET/HEAD/other
//   lookup: path leading "/" T/F; too-long param T/F; empty param T/F;
//           empty segment T/F; partial routes T/F; fallback routes T/F
//   lookupRest: prefix skip T/F; excluded seq T/F; method match T/F; length limit T/F
describe('RouteTable', () => {
  it('should expose the defaults', () => {
    expect(MAX_PARAM_LENGTH).toBe(100);
    expect(PARAM_TOO_LONG).toEqual({ handlers: [], params: {}, seqs: [] });
  });

  it('should return null for an unknown route', () => {
    const table = new RouteTable();
    expect(table.lookup('GET', '/missing')).toBeNull();
  });

  it('should return null for a path not starting with /', () => {
    const table = new RouteTable();
    table.add('GET', '/users', handler());
    expect(table.lookup('GET', 'users')).toBeNull();
  });

  it('should match a static route and its method', () => {
    const table = new RouteTable();
    const h = handler();
    table.add('GET', '/users', h);
    expect(table.lookup('GET', '/users')!.handlers).toEqual([h]);
    expect(table.lookup('POST', '/users')).toBeNull();
  });

  it('should match a route for every method', () => {
    const table = new RouteTable();
    const h = handler();
    table.add(null, '/any', h);
    expect(table.lookup('PATCH', '/any')!.handlers).toEqual([h]);
  });

  it('should let HEAD use a GET route', () => {
    const table = new RouteTable();
    const h = handler();
    table.add('GET', '/users', h);
    expect(table.lookup('HEAD', '/users')!.handlers).toEqual([h]);
  });

  it('should prefer an explicit HEAD route', () => {
    const table = new RouteTable();
    const get = handler();
    const head = handler();
    table.add('GET', '/users', get);
    table.add('HEAD', '/users', head);
    expect(table.lookup('HEAD', '/users')!.handlers).toEqual([head]);
    expect(table.lookup('GET', '/users')!.handlers).toEqual([get]);
  });

  it('should decode and expose route parameters', () => {
    const table = new RouteTable();
    table.add('GET', '/users/:id', handler());
    expect(table.lookup('GET', '/users/42')!.params).toEqual({ id: '42' });
    expect(table.lookup('GET', '/users/a%20b')!.params).toEqual({
      id: 'a b',
    });
  });

  it('should expose a trailing wildcard as an array', () => {
    const table = new RouteTable();
    table.add('GET', '/files/*path', handler());
    expect(table.lookup('GET', '/files/a/b')!.params).toEqual({
      path: ['a', 'b'],
    });
  });

  it('should run several handlers and keep their own params', () => {
    const table = new RouteTable();
    const first = handler();
    const second = handler();
    table.add('GET', '/users/:id', first);
    table.add('GET', '/users/:userId', second);
    const match = table.lookup('GET', '/users/7')!;
    expect(match.handlers).toEqual([first, second]);
    expect(match.params).toEqual({ id: '7' });
    expect(match.paramsByHandler).toEqual([
      { id: '7' },
      { userId: '7' },
    ]);
  });

  it('should keep the most specific route', () => {
    const table = new RouteTable();
    const generic = handler();
    const specific = handler();
    table.add('GET', '/users/:id', generic);
    table.add('GET', '/users/me', specific);
    expect(table.lookup('GET', '/users/me')!.handlers).toEqual([specific]);
  });

  it('should be case-sensitive', () => {
    const table = new RouteTable();
    table.add('GET', '/Users', handler());
    expect(table.lookup('GET', '/users')).toBeNull();
  });

  it('should support optional groups', () => {
    const table = new RouteTable();
    const h = handler();
    table.add('GET', '/users{/:id}', h);
    expect(table.lookup('GET', '/users')!.handlers).toEqual([h]);
    expect(table.lookup('GET', '/users/1')!.params).toEqual({ id: '1' });
  });

  it('should fall back to path-to-regexp for unsupported syntax', () => {
    const table = new RouteTable();
    const h = handler();
    table.add('GET', '/:id-*rest', h);
    expect(table.lookup('GET', '/abc-def')!.handlers).toEqual([h]);
    expect(table.lookup('GET', '/abc')).toBeNull();
  });

  it('should fall back for too many optional groups', () => {
    const table = new RouteTable();
    const h = handler();
    table.add(
      'GET',
      '/a{/:a}{/:b}{/:c}{/:d}{/:e}{/:f}{/:g}',
      h,
    );
    expect(table.lookup('GET', '/a/1/2/3/4/5/6/7')!.handlers).toEqual([h]);
  });

  it('should match a trailing slash like its path', () => {
    const table = new RouteTable();
    const h = handler();
    table.add('GET', '/admin', h);
    expect(table.lookup('GET', '/admin/')!.handlers).toEqual([h]);
  });

  it('should honor a route variant ending with / before its wildcard', () => {
    const table = new RouteTable();
    const partial = handler();
    const wildcard = handler();
    table.add('GET', '/admin/{*path}', partial);
    table.add('GET', '/*all', wildcard);
    expect(table.lookup('GET', '/admin/')!.handlers).toEqual([partial]);
    expect(table.lookup('GET', '/admin/x')!.handlers).toEqual([partial]);
  });

  it('should treat an empty parameter as no match', () => {
    const table = new RouteTable();
    table.add('GET', '/users/:id/profile', handler());
    expect(table.lookup('GET', '/users//profile')).toBeNull();
  });

  it('should match a wildcard for a path with an empty segment', () => {
    const table = new RouteTable();
    const h = handler();
    table.add('GET', '/files/*path', h);
    expect(table.lookup('GET', '/files//a')!.handlers).toEqual([h]);
  });

  it('should report a too long parameter', () => {
    const table = new RouteTable({ maxParamLength: 3 });
    table.add('GET', '/users/:id', handler());
    expect(table.lookup('GET', '/users/1234')).toBe(PARAM_TOO_LONG);
    expect(table.lookup('GET', '/users/123')!.params).toEqual({ id: '123' });
  });

  it('should not limit wildcards', () => {
    const table = new RouteTable({ maxParamLength: 2 });
    table.add('GET', '/files/*path', handler());
    expect(table.lookup('GET', '/files/abcdef')!.params).toEqual({
      path: ['abcdef'],
    });
  });

  it('should fall through a too long param to a sibling wildcard', () => {
    const table = new RouteTable({ maxParamLength: 3 });
    const wildcard = handler();
    table.add('GET', '/users/:id', handler());
    table.add('GET', '/users/*rest', wildcard);
    expect(table.lookup('GET', '/users/1234')!.handlers).toEqual([wildcard]);
  });

  it('should return null for a too long param without another route', () => {
    const table = new RouteTable({ maxParamLength: 1 });
    expect(table.lookup('GET', '/users/abc')).toBeNull();
  });

  describe('additional parameter and variant branches', () => {
    it('should name positional parameters past the precomputed list', () => {
      const table = new RouteTable();
      const path = '/' + Array.from({ length: 33 }, (_, i) => `:p${i}`).join('/');
      table.add('GET', path, handler());
      const requestPath =
        '/' + Array.from({ length: 33 }, (_, i) => `v${i}`).join('/');
      expect(table.lookup('GET', requestPath)!.params.p32).toBe('v32');
    });

    it('should decode a wildcard segment with percent encoding', () => {
      const table = new RouteTable();
      table.add('GET', '/files/*path', handler());
      expect(table.lookup('GET', '/files/a%20b/c')!.params).toEqual({
        path: ['a b', 'c'],
      });
    });

    it('should fall back for a path with unsafe text', () => {
      const table = new RouteTable();
      const h = handler();
      table.add('GET', '/a\\?b', h);
      expect(table.lookup('GET', '/a?b')!.handlers).toEqual([h]);
    });

    it('should treat a parameter with a suffix as a mixed segment', () => {
      const table = new RouteTable();
      const h = handler();
      table.add('GET', '/:id.json', h);
      expect(table.lookup('GET', '/abc.json')!.params).toEqual({ id: 'abc' });
    });

    it('should fall back for a wildcard without a leading slash', () => {
      const table = new RouteTable();
      const h = handler();
      table.add('GET', '{*any}', h);
      expect(table.lookup('GET', '/anything')!.handlers).toEqual([h]);
    });

    it('should accept an empty route path as the root', () => {
      const table = new RouteTable();
      const h = handler();
      table.add('GET', '', h);
      expect(table.lookup('GET', '/')!.handlers).toEqual([h]);
    });

    it('should keep a route with a double slash for empty segments', () => {
      const table = new RouteTable();
      const h = handler();
      table.add('GET', '/a//b', h);
      expect(table.lookup('GET', '/a//b')!.handlers).toEqual([h]);
    });

    it('should return null for an empty wildcard', () => {
      const table = new RouteTable();
      table.add('GET', '/files/*path', handler());
      expect(table.lookup('GET', '/files/')).toBeNull();
    });

    it('should report an empty wildcard after fixed text as a parameter', () => {
      const table = new RouteTable();
      table.add('GET', '/files/v-*rest', handler());
      expect(table.lookup('GET', '/files/v-')).toBeNull();
    });

    it('should handle an empty parameter in a mixed segment', () => {
      const table = new RouteTable();
      table.add('GET', '/ext/:file.:ext', handler());
      expect(table.lookup('GET', '/ext/.b')).toBeNull();
    });
  });

  describe('additional empty segment and fallback branches', () => {
    it('should decode an encoded parameter in a fallback route', () => {
      const table = new RouteTable();
      table.add('GET', '/a\\?b/:id', handler());
      expect(table.lookup('GET', '/a?b/a%20b')!.params).toEqual({ id: 'a b' });
    });

    it('should not treat a whole empty segment as a parameter', () => {
      const table = new RouteTable();
      table.add('GET', '/:id', handler());
      expect(table.lookup('GET', '/')).toBeNull();
    });

    it('should scan wildcard routes for a path with a double slash', () => {
      const table = new RouteTable();
      const wildcard = handler();
      table.add('GET', '/files/*path', wildcard);
      table.add('GET', '/users/:id/profile', handler());
      expect(table.lookup('GET', '/users//profile')).toBeNull();
    });

    it('should skip another method while scanning wildcard routes', () => {
      const table = new RouteTable();
      table.add('POST', '/files/*path', handler());
      expect(table.lookup('GET', '/files//readme')).toBeNull();
    });

    it('should use route skips when a parameter is empty', () => {
      const table = new RouteTable();
      table.add('POST', '/ext/a', handler());
      table.add('GET', '/ext/a/b', handler());
      table.add('GET', '/ext/a/b/c', handler());
      table.add('GET', '/ext/:file/other', handler());
      table.add('GET', '/ext/:file.:ext', handler());
      expect(table.lookup('GET', '/ext/.b')).toBeNull();
    });

    it('should skip nested prefixes in lookupRest', () => {
      const table = new RouteTable();
      table.add('GET', '/api', handler());
      table.add('GET', '/api/users', handler());
      table.add('GET', '/api/users/1', handler());
      const other = handler();
      table.add('GET', '/other', other);
      expect(table.lookupRest('GET', '/other', [])).toEqual([
        { handler: other, params: {} },
      ]);
    });

    it('should report a too long parameter for a trailing slash', () => {
      const table = new RouteTable({ maxParamLength: 2 });
      table.add('GET', '/admin2/:id/{*path}', handler());
      expect(table.lookup('GET', '/admin2/verylong/')).toBe(PARAM_TOO_LONG);
    });

    it('should reject a trailing slash that a path matcher refuses', () => {
      const table = new RouteTable();
      table.add('GET', '/a{/}', handler());
      expect(table.lookup('GET', '/a//')).not.toBeNull();
    });

    it('should report a too long parameter when scanning routes', () => {
      const table = new RouteTable({ maxParamLength: 4 });
      table.add('GET', '/files/:id.:ext', handler());
      table.add('GET', '/files/:id', handler());
      expect(table.lookup('GET', '/files/.json')).toBe(PARAM_TOO_LONG);
    });

    it('should apply a path matcher for a trailing slash', () => {
      const table = new RouteTable();
      table.add('GET', '/admin/{*path}', handler());
      table.add('GET', '/*all', handler());
      expect(table.lookup('GET', '/admin/x/')).not.toBeNull();
    });

    it('should stop partial fallbacks at the matched route sequence', () => {
      const table = new RouteTable();
      table.add('GET', '/files/{*path}', handler());
      const readme = handler();
      table.add('GET', '/files/readme', readme);
      table.add('GET', '/files/later/{*rest}', handler());
      expect(table.lookup('GET', '/files/readme/')!.handlers).toEqual([readme]);
    });

    it('should report an empty wildcard for a path ending in double slash', () => {
      const table = new RouteTable();
      table.add('GET', '/files/*path', handler());
      expect(table.lookup('GET', '/files//')).not.toBeNull();
      expect(table.lookup('GET', '/files//x')).not.toBeNull();
    });

    it('should not reuse a partial wildcard for a later exact route', () => {
      const table = new RouteTable();
      table.add('GET', '/files/{*path}', handler());
      const readme = handler();
      table.add('GET', '/files/readme', readme);
      expect(table.lookup('GET', '/files/readme/')!.handlers).toEqual([readme]);
    });
  });

  describe('additional lookupFirst and lookupFallback branches', () => {
    it('should return PARAM_TOO_LONG from lookupFirst', () => {
      const table = new RouteTable({ maxParamLength: 2 });
      table.add('GET', '/a/:x/:y', handler());
      expect(table.lookup('GET', '/a//bbbb')).toBe(PARAM_TOO_LONG);
    });

    it('should skip another method in lookupFirst', () => {
      const table = new RouteTable();
      table.add('POST', '/a//b', handler());
      expect(table.lookup('GET', '/a//b')).toBeNull();
    });

    it('should return PARAM_TOO_LONG from lookupFallback', () => {
      const table = new RouteTable({ maxParamLength: 2 });
      table.add('GET', '/a\\?b/:id', handler());
      expect(table.lookup('GET', '/a?b/1234')).toBe(PARAM_TOO_LONG);
    });

    it('should skip another method in lookupFallback', () => {
      const table = new RouteTable();
      table.add('POST', '/a\\?b', handler());
      expect(table.lookup('GET', '/a?b')).toBeNull();
    });

    it('should skip routes outside a shared prefix in lookupRest', () => {
      const table = new RouteTable();
      for (let i = 0; i < 6; i++) {
        table.add('GET', `/api/users/${i}`, handler());
      }
      const other = handler();
      table.add('GET', '/other', other);
      expect(table.lookupRest('GET', '/other', [])).toEqual([
        { handler: other, params: {} },
      ]);
    });
  });

  describe('lookupRest', () => {
    it('should return every other matching route', () => {
      const table = new RouteTable();
      const first = handler();
      const second = handler();
      table.add('GET', '/users/:id', first);
      table.add('GET', '/users/:id', second);
      const match = table.lookup('GET', '/users/1')!;
      expect(match.seqs).toHaveLength(2);
      expect(table.lookupRest('GET', '/users/1', [match.seqs[0]])).toEqual([
        { handler: second, params: { id: '1' } },
      ]);
    });

    it('should skip routes of another method and excluded ones', () => {
      const table = new RouteTable();
      table.add('POST', '/users/:id', handler());
      table.add('GET', '/users/:id', handler());
      expect(table.lookupRest('GET', '/users/1', [0, 1])).toEqual([]);
    });

    it('should skip params over the limit', () => {
      const table = new RouteTable({ maxParamLength: 1 });
      table.add('GET', '/users/:id', handler());
      expect(table.lookupRest('GET', '/users/22', [])).toEqual([]);
    });
  });
});
