import {
  HttpStatus,
  InternalServerErrorException,
  RequestMethod,
  VERSION_NEUTRAL,
  VersioningType,
} from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { NodeAdapter } from '../../../../packages/platform-node/adapters/node-adapter.js';
import { NodeRequest, NodeResponse } from '../../../../packages/platform-node/adapters/node-request.js';
import { NodeRouter } from '../../../../packages/platform-node/router/node-router.js';

function makeRes(init: any = {}) {
  const headers = new Map<string, any>();
  const res: any = Object.create(NodeResponse.prototype);
  Object.assign(res, {
    statusCode: 200,
    locals: { a: 1 },
    destroyed: false,
    req: { method: 'GET' },
    getHeader: vi.fn((name: string) => headers.get(name.toLowerCase())),
    setHeader: vi.fn((name: string, value: any) =>
      headers.set(name.toLowerCase(), value),
    ),
    hasHeader: vi.fn((name: string) => headers.has(name.toLowerCase())),
    removeHeader: vi.fn((name: string) => headers.delete(name.toLowerCase())),
    writeHead: vi.fn(),
    end: vi.fn(),
    destroy: vi.fn(),
    redirect: vi.fn(),
    appendHeader: vi.fn(),
    on: vi.fn(),
    ...init,
  });
  Object.defineProperty(res, 'headersSent', {
    configurable: true,
    get: () => false,
  });
  return res;
}

const makeRequest = (init: any = {}) =>
  Object.assign(Object.create(NodeRequest.prototype), {
    headers: {},
    url: '/',
    method: 'GET',
    socket: { remoteAddress: '127.0.0.1' },
    ...init,
  }) as NodeRequest;

// CFG (C3) of NodeAdapter:
//   reply: statusCode nil T/F; body nil T/F; send wrapped T/F; endWithoutBody T/F;
//          StreamableFile T/F (errored, HEAD, normal); Error 4xx/5xx T/F;
//          content type mismatch T/F; json/send wrapped T/F; view T/F;
//          object T/F; text T/F
//   applyVersionFilter: neutral / URI / CUSTOM / MEDIA_TYPE / HEADER / other
//   normalizePath: conversion ok T/F; TypeError T/F
describe('NodeAdapter', () => {
  it('should create a default router', () => {
    const adapter = new NodeAdapter();
    expect(adapter.getType()).toBe('node');
    expect(adapter.getInstance()).toBeInstanceOf(NodeRouter);
  });

  it('should use a provided router', () => {
    const router = new NodeRouter(vi.fn());
    const adapter = new NodeAdapter(router);
    expect(adapter.getInstance()).toBe(router);
  });

  it('should reject an invalid maxParamLength', () => {
    expect(() => new NodeAdapter({ maxParamLength: 0 })).toThrow(TypeError);
  });

  describe('reply', () => {
    it('should set the status code', () => {
      const adapter = new NodeAdapter();
      const res = makeRes();
      adapter.reply(res, 'hello', 201);
      expect(res.statusCode).toBe(201);
      expect(res.end).toHaveBeenCalledWith('hello');
    });

    it('should end an empty reply', () => {
      const adapter = new NodeAdapter();
      const res = makeRes();
      adapter.reply(res, undefined);
      expect(res.end).toHaveBeenCalledWith();
    });

    it('should leave a 204 without a body', () => {
      const adapter = new NodeAdapter();
      const res = makeRes({ statusCode: 204 });
      adapter.reply(res, null);
      expect(res.end).toHaveBeenCalledWith();
      expect(res.removeHeader).toHaveBeenCalledWith('Content-Type');
    });

    it('should go through a wrapped send for an empty reply', () => {
      const adapter = new NodeAdapter();
      const res = makeRes({ send: vi.fn() });
      adapter.reply(res, null);
      expect(res.send).toHaveBeenCalledWith();
      expect(res.end).not.toHaveBeenCalled();
    });

    it('should serialize an object as JSON', () => {
      const adapter = new NodeAdapter();
      const res = makeRes();
      adapter.reply(res, { a: 1 });
      expect(res.writeHead).toHaveBeenCalledWith(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': 7,
      });
      expect(res.end).toHaveBeenCalledWith('{"a":1}');
    });

    it('should send text as plain text', () => {
      const adapter = new NodeAdapter();
      const res = makeRes();
      adapter.reply(res, 'hi');
      expect(res.writeHead).toHaveBeenCalledWith(200, {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Length': 2,
      });
    });

    it('should send numbers as text', () => {
      const adapter = new NodeAdapter();
      const res = makeRes();
      adapter.reply(res, 42);
      expect(res.end).toHaveBeenCalledWith('42');
    });

    it('should send a Buffer as binary', () => {
      const adapter = new NodeAdapter();
      const res = makeRes();
      adapter.reply(res, Buffer.from([1, 2]));
      expect(res.end.mock.calls[0][0]).toBeInstanceOf(Uint8Array);
      expect(res.writeHead).toHaveBeenCalledWith(200, {
        'Content-Type': 'application/octet-stream',
        'Content-Length': 2,
      });
    });

    it('should send a typed array as binary', () => {
      const adapter = new NodeAdapter();
      const res = makeRes();
      adapter.reply(res, new Uint16Array([1]));
      expect(res.end.mock.calls[0][0].byteLength).toBe(2);
    });

    it('should not set Content-Length with Transfer-Encoding', () => {
      const adapter = new NodeAdapter();
      const res = makeRes();
      res.hasHeader.mockReturnValue(true);
      adapter.reply(res, 'hi');
      expect(res.writeHead).toHaveBeenCalledWith(200, {
        'Content-Type': 'text/plain; charset=utf-8',
      });
    });

    it('should map an error body for a 4xx status', () => {
      const adapter = new NodeAdapter();
      const res = makeRes({ statusCode: HttpStatus.NOT_FOUND });
      adapter.reply(res, new Error('internal details'), 404);
      expect(res.end).toHaveBeenCalledWith(
        '{"statusCode":404,"message":"Not Found"}',
      );
    });

    it('should keep an error body for a 2xx status', () => {
      const adapter = new NodeAdapter();
      const res = makeRes();
      adapter.reply(res, new Error('x'));
      expect(res.end).toHaveBeenCalledWith('{}');
    });

    it('should warn and override a mismatched content type', () => {
      const adapter = new NodeAdapter();
      const res = makeRes({
        statusCode: HttpStatus.NOT_FOUND,
        getHeader: vi.fn(() => 'text/html'),
      });
      adapter.reply(res, { statusCode: 404 });
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'application/json; charset=utf-8',
      );
    });

    it('should keep a matching JSON content type', () => {
      const adapter = new NodeAdapter();
      const res = makeRes({
        statusCode: HttpStatus.NOT_FOUND,
        getHeader: vi.fn(() => 'application/json'),
      });
      adapter.reply(res, { statusCode: 404 });
      expect(res.setHeader).not.toHaveBeenCalled();
    });

    it('should go through a wrapped res.json()', () => {
      const adapter = new NodeAdapter();
      const res = makeRes({ json: vi.fn() });
      adapter.reply(res, { a: 1 });
      expect(res.json).toHaveBeenCalledWith({ a: 1 });
    });

    it('should go through a wrapped res.send() for a string', () => {
      const adapter = new NodeAdapter();
      const res = makeRes({ send: vi.fn() });
      adapter.reply(res, 'hello');
      expect(res.send).toHaveBeenCalledWith('hello');
    });

    it('should use the response content type it already has', () => {
      const adapter = new NodeAdapter();
      const res = makeRes({ getHeader: vi.fn(() => 'text/csv') });
      adapter.reply(res, 'a,b');
      expect(res.writeHead).toHaveBeenCalledWith(200, {
        'Content-Length': 3,
      } as any);
    });
  });

  it('should set a status', () => {
    const adapter = new NodeAdapter();
    const res = makeRes();
    expect(adapter.status(res, 418)).toBe(res);
    expect(res.statusCode).toBe(418);
  });

  it('should end a response', () => {
    const adapter = new NodeAdapter();
    const res = makeRes();
    adapter.end(res, 'done');
    expect(res.end).toHaveBeenCalledWith('done');
  });

  it('should read and write headers', () => {
    const adapter = new NodeAdapter();
    const res = makeRes();
    expect(adapter.isHeadersSent(res)).toBe(false);
    adapter.setHeader(res, 'X-Test', 'v');
    expect(res.setHeader).toHaveBeenCalledWith('X-Test', 'v');
    adapter.appendHeader(res, 'X-Test', 'w');
    expect(res.appendHeader).toHaveBeenCalledWith('X-Test', 'w');
    expect(adapter.getHeader(res, 'X-Test')).toBe('v');
  });

  it('should delegate redirect', () => {
    const adapter = new NodeAdapter();
    const res = makeRes();
    adapter.redirect(res, 301, '/next');
    expect(res.redirect).toHaveBeenCalledWith(301, '/next');
  });

  describe('render', () => {
    it('should fail without a view engine', async () => {
      const adapter = new NodeAdapter();
      await expect(
        adapter.render(makeRes(), 'index', {}),
      ).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('should configure the view renderer fluently', () => {
      const adapter = new NodeAdapter();
      expect(adapter.setViewEngine('ejs')).toBe(adapter);
      expect(adapter.setBaseViewsDir('views')).toBe(adapter);
      expect(adapter.setLocal('appLocal', 1)).toBe(adapter);
    });
  });

  it('should normalize a route path', () => {
    const adapter = new NodeAdapter();
    expect(adapter.normalizePath('/users/:id')).toBe('/users/:id');
  });

  it('should throw for an invalid route path', () => {
    const adapter = new NodeAdapter();
    expect(() => adapter.normalizePath('/a(b')).toThrow();
  });

  it('should expose request accessors', () => {
    const adapter = new NodeAdapter();
    const req = makeRequest({
      headers: { host: 'example.com:3000' },
      method: 'POST',
      url: '/a',
      originalUrl: '/b',
    });
    expect(adapter.getRequestHostname(req)).toBe('example.com');
    expect(adapter.getRequestMethod(req)).toBe('POST');
    expect(adapter.getRequestUrl(req)).toBe('/b');
    expect(adapter.getRequestUrl(makeRequest({ url: '/a' }))).toBe('/a');
  });

  it('should report route matching options', () => {
    const adapter = new NodeAdapter();
    expect(adapter.isRouteOrderSensitive()).toBe(false);
    expect(adapter.getRouteMatchingOptions()).toEqual({
      caseSensitive: true,
      ignoreTrailingSlash: true,
    });
  });

  it('should create a middleware factory', () => {
    const adapter = new NodeAdapter();
    expect(adapter.createMiddlewareFactory(RequestMethod.GET)).toBeTypeOf(
      'function',
    );
  });

  describe('applyVersionFilter', () => {
    const run = (
      filter: any,
      req: any,
      handler = vi.fn(),
      next = vi.fn(),
    ) => {
      filter(req, {}, next);
      return { handler, next };
    };

    it('should run the handler for a neutral version', () => {
      const adapter = new NodeAdapter();
      const handler = vi.fn();
      adapter.applyVersionFilter(handler, VERSION_NEUTRAL, {
        type: VersioningType.URI,
      })({}, {}, vi.fn());
      expect(handler).toHaveBeenCalled();
    });

    it('should run the handler for URI versioning', () => {
      const adapter = new NodeAdapter();
      const handler = vi.fn();
      adapter.applyVersionFilter(handler, '1', {
        type: VersioningType.URI,
      })({}, {}, vi.fn());
      expect(handler).toHaveBeenCalled();
    });

    it('should throw without next when the version does not match', () => {
      const adapter = new NodeAdapter();
      const filter = adapter.applyVersionFilter(vi.fn(), '2', {
        type: VersioningType.CUSTOM,
        extractor: () => '1',
      } as any);
      expect(() => filter({}, {}, undefined)).toThrow(
        InternalServerErrorException,
      );
    });

    it('should support custom version extraction for a string', () => {
      const adapter = new NodeAdapter();
      const handler = vi.fn();
      const filter = adapter.applyVersionFilter(handler, '1', {
        type: VersioningType.CUSTOM,
        extractor: () => '1',
      } as any);
      filter({}, {}, vi.fn());
      expect(handler).toHaveBeenCalled();
    });

    it('should support custom version extraction for an array', () => {
      const adapter = new NodeAdapter();
      const handler = vi.fn();
      const filter = adapter.applyVersionFilter(handler, ['1', '2'], {
        type: VersioningType.CUSTOM,
        extractor: () => ['2'],
      } as any);
      filter({}, {}, vi.fn());
      expect(handler).toHaveBeenCalled();
    });

    it('should pass to next when the custom version does not match', () => {
      const adapter = new NodeAdapter();
      const next = vi.fn();
      const filter = adapter.applyVersionFilter(vi.fn(), ['1'], {
        type: VersioningType.CUSTOM,
        extractor: () => ['3'],
      } as any);
      filter({}, {}, next);
      expect(next).toHaveBeenCalled();
    });

    it('should match a media type version', () => {
      const adapter = new NodeAdapter();
      const handler = vi.fn();
      const filter = adapter.applyVersionFilter(handler, '2', {
        type: VersioningType.MEDIA_TYPE,
        key: 'v=',
      } as any);
      filter({ headers: { accept: 'application/json;v=2' } }, {}, vi.fn());
      expect(handler).toHaveBeenCalled();
    });

    it('should pass to next for a missing media type version', () => {
      const adapter = new NodeAdapter();
      const next = vi.fn();
      const filter = adapter.applyVersionFilter(vi.fn(), '2', {
        type: VersioningType.MEDIA_TYPE,
        key: 'v=',
      } as any);
      filter({ headers: {} }, {}, next);
      expect(next).toHaveBeenCalled();
    });

    it('should allow a neutral media type version', () => {
      const adapter = new NodeAdapter();
      const handler = vi.fn();
      const filter = adapter.applyVersionFilter(
        handler,
        [VERSION_NEUTRAL],
        { type: VersioningType.MEDIA_TYPE, key: 'v=' } as any,
      );
      filter({ headers: {} }, {}, vi.fn());
      expect(handler).toHaveBeenCalled();
    });

    it('should match a header version', () => {
      const adapter = new NodeAdapter();
      const handler = vi.fn();
      const filter = adapter.applyVersionFilter(handler, '2', {
        type: VersioningType.HEADER,
        header: 'X-Version',
      } as any);
      filter({ headers: { 'x-version': '2' } }, {}, vi.fn());
      expect(handler).toHaveBeenCalled();
    });

    it('should pass to next for a missing header version', () => {
      const adapter = new NodeAdapter();
      const next = vi.fn();
      const filter = adapter.applyVersionFilter(vi.fn(), '2', {
        type: VersioningType.HEADER,
        header: 'X-Version',
      } as any);
      filter({ headers: {} }, {}, next);
      expect(next).toHaveBeenCalled();
    });

    it('should allow a neutral header version', () => {
      const adapter = new NodeAdapter();
      const handler = vi.fn();
      const filter = adapter.applyVersionFilter(
        handler,
        [VERSION_NEUTRAL],
        { type: VersioningType.HEADER, header: 'X-Version' } as any,
      );
      filter({ headers: {} }, {}, vi.fn());
      expect(handler).toHaveBeenCalled();
    });

    it('should reject an unsupported versioning type', () => {
      const adapter = new NodeAdapter();
      expect(() =>
        adapter.applyVersionFilter(vi.fn(), '1', {
          type: 'nope',
        } as any),
      ).toThrow('Unsupported versioning options');
    });
  });

  describe('mapException', () => {
    it('should keep an HttpException', () => {
      const adapter = new NodeAdapter();
      const error = new InternalServerErrorException('x');
      expect(adapter.mapException(error)).toBe(error);
    });

    it('should map a SyntaxError to a BadRequestException', () => {
      const adapter = new NodeAdapter();
      const error = new SyntaxError('bad json');
      const mapped: any = adapter.mapException(error);
      expect(mapped.getStatus()).toBe(400);
      expect(mapped.message).toBe('bad json');
    });

    it('should map a URIError to a BadRequestException', () => {
      const adapter = new NodeAdapter();
      const mapped: any = adapter.mapException(new URIError('bad uri'));
      expect(mapped.getStatus()).toBe(400);
    });

    it('should map an exposed http error to an HttpException', () => {
      const adapter = new NodeAdapter();
      const mapped: any = adapter.mapException(
        Object.assign(new Error('too large'), {
          status: 413,
          statusCode: 413,
          expose: true,
        }),
      );
      expect(mapped.getStatus()).toBe(413);
      expect(mapped.message).toBe('too large');
    });

    it('should hide the message of a non-exposed http error', () => {
      const adapter = new NodeAdapter();
      const mapped: any = adapter.mapException(
        Object.assign(new Error('secret'), {
          status: 403,
          statusCode: 403,
          expose: false,
        }),
      );
      expect(mapped.getStatus()).toBe(403);
      expect(mapped.message).toBe('Forbidden');
    });

    it('should keep a 5xx http error unmapped', () => {
      const adapter = new NodeAdapter();
      const error = Object.assign(new Error('db down'), {
        status: 500,
        statusCode: 500,
        expose: false,
      });
      expect(adapter.mapException(error)).toBe(error);
    });

    it('should keep an unknown error unmapped', () => {
      const adapter = new NodeAdapter();
      const error = new Error('unknown');
      expect(adapter.mapException(error)).toBe(error);
    });
  });
});