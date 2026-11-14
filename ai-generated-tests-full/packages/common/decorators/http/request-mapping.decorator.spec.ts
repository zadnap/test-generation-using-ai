import { describe, expect, it } from 'vitest';
import {
  METHOD_METADATA,
  PATH_METADATA,
} from '../../../../../packages/common/constants.js';
import {
  All,
  Copy,
  Delete,
  Get,
  Head,
  Lock,
  Mkcol,
  Move,
  Options,
  Patch,
  Post,
  Propfind,
  Proppatch,
  Put,
  QueryMethod,
  RequestMapping,
  Search,
  Unlock,
} from '../../../../../packages/common/decorators/http/request-mapping.decorator.js';
import { RequestMethod } from '../../../../../packages/common/enums/request-method.enum.js';

function metadataOf(decorator: MethodDecorator) {
  const descriptor = { value: () => undefined };
  decorator({}, 'handler', descriptor);
  return {
    path: Reflect.getMetadata(PATH_METADATA, descriptor.value),
    method: Reflect.getMetadata(METHOD_METADATA, descriptor.value),
  };
}

describe('RequestMapping', () => {
  it('xc1(F), xc2(F): uses the default path and GET method', () => {
    expect(metadataOf(RequestMapping())).toEqual({
      path: '/',
      method: RequestMethod.GET,
    });
  });

  it('xc1(T): falls back to "/" for an empty path', () => {
    expect(metadataOf(RequestMapping({ path: '' }))).toEqual({
      path: '/',
      method: RequestMethod.GET,
    });
  });

  it('xc1(T): falls back to "/" for an empty path array', () => {
    expect(metadataOf(RequestMapping({ path: [] }))).toEqual({
      path: '/',
      method: RequestMethod.GET,
    });
  });

  it('xc1(T), xc2(T): keeps a custom path and method', () => {
    expect(
      metadataOf(
        RequestMapping({ path: '/cats', method: RequestMethod.POST }),
      ),
    ).toEqual({ path: '/cats', method: RequestMethod.POST });
  });

  it('keeps a path array', () => {
    expect(metadataOf(RequestMapping({ path: ['a', 'b'] }))).toEqual({
      path: ['a', 'b'],
      method: RequestMethod.GET,
    });
  });

  it('returns the descriptor', () => {
    const descriptor = { value: () => undefined };
    expect(RequestMapping()({}, 'handler', descriptor)).toBe(descriptor);
  });
});

describe('request mapping helpers', () => {
  const helpers: Array<
    [(path?: string | string[]) => MethodDecorator, RequestMethod, string]
  > = [
    [Post, RequestMethod.POST, 'post'],
    [Get, RequestMethod.GET, 'get'],
    [Delete, RequestMethod.DELETE, 'delete'],
    [Put, RequestMethod.PUT, 'put'],
    [Patch, RequestMethod.PATCH, 'patch'],
    [Options, RequestMethod.OPTIONS, 'options'],
    [Head, RequestMethod.HEAD, 'head'],
    [All, RequestMethod.ALL, 'all'],
    [Search, RequestMethod.SEARCH, 'search'],
    [QueryMethod, RequestMethod.QUERY, 'query'],
    [Propfind, RequestMethod.PROPFIND, 'propfind'],
    [Proppatch, RequestMethod.PROPPATCH, 'proppatch'],
    [Mkcol, RequestMethod.MKCOL, 'mkcol'],
    [Copy, RequestMethod.COPY, 'copy'],
    [Move, RequestMethod.MOVE, 'move'],
    [Lock, RequestMethod.LOCK, 'lock'],
    [Unlock, RequestMethod.UNLOCK, 'unlock'],
  ];

  it.each(helpers)(
    'maps the %s helper to its HTTP method',
    (helper, method, path) => {
      expect(metadataOf(helper(path))).toEqual({ path, method });
    },
  );

  it.each(helpers)(
    'falls back to "/" when the %s helper receives no path',
    helper => {
      const metadata = metadataOf(helper());
      expect(metadata.path).toBe('/');
    },
  );
});
