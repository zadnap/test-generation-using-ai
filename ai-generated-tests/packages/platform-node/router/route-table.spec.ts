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
