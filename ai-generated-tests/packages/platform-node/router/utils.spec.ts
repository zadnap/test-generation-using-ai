import { describe, expect, it } from 'vitest';
import {
  getCommonPrefix,
  getLiteralPrefix,
  getPrefixSkips,
  getRawPrefixEnd,
  getRoutingPath,
  loosen,
} from '../../../../packages/platform-node/router/utils.js';

// getPathFromAbsoluteUrl (used by getRoutingPath) decision nodes:
//   1  schemeEnd === -1                         T/F
//   2  scheme is http/https                     T/F
//   3  pathStart !== -1                         T/F
//   4  queryStart !== -1 && < authorityEnd      T/F (split into 4c1/4c2)
//   5  fragment present || authority empty      T/F (split into 5c1/5c2)
//   6  !URL.canParse || host empty              T/F (split into 6c1/6c2)
//   7  authorityEnd === url.length              T/F
//   8  authorityEnd === queryStart              T/F

describe('loosen', () => {
  it.each([
    ['/users/', '/users'],
    ['/users//', '/users'],
    ['/users', '/users'],
    ['/', '/'],
    ['', ''],
    ['///', ''],
  ])('should loosen %s to %s', (input, expected) => {
    expect(loosen(input)).toBe(expected);
  });
});

describe('getLiteralPrefix', () => {
  it.each([
    ['/users/:id', '/users/'],
    ['/users/:id/posts', '/users/'],
    ['/files/*path', '/files/'],
    ['/files/v:version', '/files/v'],
    ['/users{/:id}', '/users'],
    ['{/:lang}/users', ''],
    ['/:id', '/'],
    ['/users', '/users'],
    ['/', '/'],
    ['', ''],
    ['/a\\:b/:id', '/a:b/'],
    ['/a(b)c', ''],
  ])('should return the literal prefix of %s', (path, expected) => {
    expect(getLiteralPrefix(path)).toBe(expected);
  });

  it('should return an empty prefix for an invalid pattern', () => {
    expect(getLiteralPrefix('/users/:')).toBe('');
  });
});

describe('getCommonPrefix', () => {
  it.each([
    [[], ''],
    [['/a'], '/a'],
    [['/a', '/ab', '/ac'], '/a'],
    [['/users', '/users/posts'], '/users'],
    [['/a', '/b'], '/'],
    [['', '/a'], ''],
    [['abc', 'abd', 'ab'], 'ab'],
  ])('should compute the common prefix of %j', (prefixes, expected) => {
    expect(getCommonPrefix(prefixes)).toBe(expected);
  });
});

describe('getPrefixSkips', () => {
  it('should skip the entries that start with the same prefix', () => {
    expect(
      getPrefixSkips(['/a', '/a/b', '/a/c', '/b', undefined, '/b/x']),
    ).toEqual([3, 2, 3, 4, 5, 6]);
  });

  it('should never skip an entry without a prefix', () => {
    expect(getPrefixSkips(['/a', undefined, '/a/b'])).toEqual([1, 2, 3]);
    expect(getPrefixSkips([])).toEqual([]);
  });

  it('should follow the chain of skips for nested prefixes', () => {
    expect(getPrefixSkips(['/a', '/a/b', '/a/b/c', '/x'])).toEqual([
      3, 3, 3, 4,
    ]);
  });

  it('should handle a single undefined entry', () => {
    expect(getPrefixSkips([undefined])).toEqual([1]);
  });
});

describe('getRoutingPath', () => {
  it.each([
    ['/users', '/users'],
    ['/users?id=1&sort=asc', '/users'],
    ['/%61dmin', '/admin'],
    ['/files/a%2Fb', '/files/a%2Fb'],
    ['/files/a%3Fb', '/files/a%3Fb'],
    ['http://example.com/users/1?x=1', '/users/1'],
    ['https://example.com:8443/%61dmin', '/admin'],
    ['http://example.com', '/'],
    ['http://example.com?x=1', '/'],
    ['http://example.com/', '/'],
    ['HTTP://EXAMPLE.COM/Users', '/Users'],
    ['ftp://example.com/users', 'ftp://example.com/users'],
    ['/a#fragment', 'THROW'],
    ['http://example.com/users#top', 'THROW'],
    ['/%E0%A4%A', 'THROW'],
    ['/users/%ZZ', 'THROW'],
    ['http:///users', 'THROW'],
    ['http://', 'THROW'],
    ['http://example.com#x', 'THROW'],
    ['http://?x=1', 'THROW'],
  ])('should route %s as %s', (url, expected) => {
    if (expected === 'THROW') {
      expect(() => getRoutingPath(url)).toThrow(URIError);
      return;
    }
    expect(getRoutingPath(url)).toBe(expected);
  });

  it('should reject an absolute-form target whose host is parsed as empty', () => {
    // "http://@/users": URL.canParse() detects the empty host
    expect(() => getRoutingPath('http://@/users')).toThrow(URIError);
  });

  it('should keep a target that only looks like a scheme when it is not http(s)', () => {
    expect(getRoutingPath('mailto://example.com')).toBe(
      'mailto://example.com',
    );
  });
});

describe('getRawPrefixEnd', () => {
  it.each([
    ['/static/app.js', '/static', 7],
    ['/api/v1/users', '/api/v1', 7],
    ['/static?v=1', '/static', 7],
    ['/static#frag', '/static', 7],
    ['/static', '/static', 7],
    ['/static', '', 0],
  ])('should find where %s matches %s', (url, prefix, expected) => {
    expect(getRawPrefixEnd(url, prefix)).toBe(expected);
  });

  it('should count path segments rather than characters', () => {
    const url = '/%73tatic/app.js';
    expect(url.slice(0, getRawPrefixEnd(url, '/static'))).toBe('/%73tatic');
  });

  it('should skip the scheme and host of an absolute-form target', () => {
    const url = 'http://example.com/static/app.js';
    expect(url.slice(getRawPrefixEnd(url, '/static'))).toBe('/app.js');
  });

  it('should end the host of an absolute-form target at its query', () => {
    const url = 'http://example.com?a=/users';
    expect(url.slice(getRawPrefixEnd(url, ''))).toBe('?a=/users');
  });

  it('should handle an absolute-form target without a path', () => {
    const url = 'http://example.com';
    expect(url.slice(getRawPrefixEnd(url, ''))).toBe('');
  });

  it('should handle an absolute-form target with no scheme separator', () => {
    expect(getRawPrefixEnd('not-a-url', '/x')).toBe(9);
  });
});