import {
  HttpStatus,
  InternalServerErrorException,
  NotFoundException,
  RequestMethod,
  StreamableFile,
  VERSION_NEUTRAL,
  VersioningType,
} from '@nestjs/common';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { PassThrough, Readable } from 'stream';
import { describe, expect, it, vi } from 'vitest';
import { NodeAdapter } from '../../../../packages/platform-node/adapters/node-adapter.js';
import {
  NodeRequest,
  NodeResponse,
  ROUTE_ERROR_HANDLER,
  SHUTTING_DOWN,
} from '../../../../packages/platform-node/adapters/node-request.js';
import {
  PARAM_TOO_LONG_KEY,
} from '../../../../packages/platform-node/router/node-router.js';
import { NodeRouter } from '../../../../packages/platform-node/router/node-router.js';

function makeRes(init: any = {}) {
  const { headersSent = false, ...rest } = init;
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
    ...rest,
  });
  Object.defineProperty(res, 'headersSent', {
    configurable: true,
    get: () => headersSent,
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

    it('should hide an exposed http error whose status has no reason phrase', () => {
      const adapter = new NodeAdapter();
      const mapped: any = adapter.mapException(
        Object.assign(new Error('teapot'), {
          status: 499,
          statusCode: 499,
          expose: false,
        }),
      );
      expect(mapped.getStatus()).toBe(499);
      expect(mapped.message).toBe('Internal server error');
    });
  });

  describe('constructor and parser registration', () => {
    it('should create a request class when an option changes requests', () => {
      const adapter = new NodeAdapter({ trustProxy: true });
      const prototype = (adapter.getInstance() as any).requestPrototype;
      expect(prototype).toBeDefined();
      expect(prototype).not.toBe(NodeRequest.prototype);
    });

    it('should register raw-body parsers and store rawBody', async () => {
      const adapter = new NodeAdapter();
      adapter.registerParserMiddleware(undefined, true);
      const stack = (adapter.getInstance() as any).stack;
      const jsonParser = stack.find(
        (layer: any) => layer.handler?.name === 'jsonParser',
      ).handler;
      const req: any = Readable.from([Buffer.from('{"a":1}')]);
      req.headers = {
        'content-type': 'application/json',
        'content-length': '7',
      };
      req.complete = true;
      await new Promise<void>((resolve, reject) => {
        jsonParser(req, {}, (error?: Error) =>
          error ? reject(error) : resolve(),
        );
      });
      expect(req.body).toEqual({ a: 1 });
      expect(Buffer.isBuffer(req.rawBody)).toBe(true);
    });

    it('should register parsers without raw-body verification', () => {
      const adapter = new NodeAdapter();
      adapter.registerParserMiddleware(undefined, false);
      expect((adapter.getInstance() as any).hasMiddleware('jsonParser')).toBe(
        true,
      );
      expect(
        (adapter.getInstance() as any).hasMiddleware('urlencodedParser'),
      ).toBe(true);
    });

    it('should pass parser options through when raw-body is disabled', () => {
      const adapter = new NodeAdapter();
      adapter.useBodyParser('json', false, { limit: 10 });
      expect((adapter.getInstance() as any).hasMiddleware('jsonParser')).toBe(
        true,
      );
    });

    it('should not register the default parsers twice', () => {
      const adapter = new NodeAdapter();
      adapter.registerParserMiddleware(undefined, true);
      adapter.registerParserMiddleware(undefined, false);
      const parsers = (adapter.getInstance() as any).stack.filter(
        (layer: any) =>
          !layer.table &&
          ['jsonParser', 'urlencodedParser'].includes(layer.handler?.name),
      );
      expect(parsers).toHaveLength(2);
    });
  });

  describe('StreamableFile replies', () => {
    function makeWritableRes(init: any = {}) {
      const headers = new Map<string, any>();
      const res: any = new PassThrough();
      Object.assign(res, {
        statusCode: 200,
        locals: {},
        req: { method: 'GET' },
        getHeader: vi.fn((name: string) => headers.get(name.toLowerCase())),
        hasHeader: vi.fn((name: string) => headers.has(name.toLowerCase())),
        setHeader: vi.fn((name: string, value: any) =>
          headers.set(name.toLowerCase(), value),
        ),
        writeHead: vi.fn(),
        ...init,
      });
      return res;
    }

    it('should pipe a StreamableFile to the response', async () => {
      const adapter = new NodeAdapter();
      const stream = Readable.from([Buffer.from('abc')]);
      const file = new StreamableFile(stream, { type: 'text/plain', length: 3 });
      const res = makeWritableRes();
      const finished = new Promise(resolve => res.once('finish', resolve));
      adapter.reply(res, file);
      res.resume();
      await finished;
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/plain');
      expect(res.setHeader).toHaveBeenCalledWith('Content-Length', 3);
    });

    it('should hand an already errored stream to the error handler', () => {
      const adapter = new NodeAdapter();
      const stream = new Readable({ read() {} });
      stream.on('error', () => {});
      stream.destroy(new Error('boom'));
      const file = new StreamableFile(stream);
      const res = makeRes();
      adapter.reply(res, file);
      expect(res.statusCode).toBe(400);
      expect(res.end).toHaveBeenCalledWith('Bad Request');
    });

    it('should end a HEAD response without piping the stream', async () => {
      const adapter = new NodeAdapter();
      const stream = Readable.from([Buffer.from('abc')]);
      const file = new StreamableFile(stream);
      const res = makeWritableRes({ req: { method: 'HEAD' } });
      const finished = new Promise(resolve => res.once('finish', resolve));
      adapter.reply(res, file);
      res.resume();
      await finished;
      expect(stream.readableEnded || stream.destroyed).toBe(true);
    });

    it('should end a HEAD response for a stream that already ended', async () => {
      const adapter = new NodeAdapter();
      const stream = Readable.from([]);
      stream.resume();
      await new Promise(resolve => stream.once('end', resolve));
      const file = new StreamableFile(stream);
      const res = makeWritableRes({ req: { method: 'HEAD' } });
      const finished = new Promise(resolve => res.once('finish', resolve));
      adapter.reply(res, file);
      await finished;
      expect(stream.readableEnded).toBe(true);
    });

    it('should destroy the source when the response finishes early', async () => {
      const adapter = new NodeAdapter();
      const stream = new Readable({ read() {} });
      const file = new StreamableFile(stream);
      const res = makeWritableRes();
      adapter.reply(res, file);
      res.destroy();
      await new Promise(resolve => setTimeout(resolve, 0));
      expect(stream.destroyed).toBe(true);
    });
  });

  describe('reply content-type handling', () => {
    it('should fall back to the literal Error text for an unknown status', () => {
      const adapter = new NodeAdapter();
      const res = makeRes({ statusCode: 599 });
      adapter.reply(res, new Error('x'), 599);
      expect(res.end).toHaveBeenCalledWith(
        '{"statusCode":599,"message":"Error"}',
      );
    });

    it('should override a mismatched content type for an object body', () => {
      const adapter = new NodeAdapter();
      const res = makeRes({
        statusCode: 404,
        getHeader: vi.fn(() => 'text/html'),
      });
      adapter.reply(res, { detail: 'not found' }, 404);
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'application/json; charset=utf-8',
      );
    });

    it('should not warn for an object body with a success status', () => {
      const adapter = new NodeAdapter();
      const res = makeRes({ getHeader: vi.fn(() => 'text/html') });
      adapter.reply(res, { ok: true }, 200);
      expect(res.setHeader).not.toHaveBeenCalledWith(
        'Content-Type',
        'application/json; charset=utf-8',
      );
    });

    it('should warn for an object body with a success status and a 5xx reply', () => {
      const adapter = new NodeAdapter();
      const res = makeRes({
        statusCode: 500,
        getHeader: vi.fn(() => 'text/html'),
      });
      adapter.reply(res, { statusCode: 200 }, 500);
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'application/json; charset=utf-8',
      );
    });

    it('should send a typed array through a wrapped res.send()', () => {
      const adapter = new NodeAdapter();
      const res = makeRes({ send: vi.fn() });
      const body = Buffer.from([1, 2]);
      adapter.reply(res, body);
      expect(res.send).toHaveBeenCalledWith(body);
    });

    it('should serialize an object whose toJSON returns undefined', () => {
      const adapter = new NodeAdapter();
      const res = makeRes();
      adapter.reply(res, { toJSON: () => undefined });
      expect(res.end).toHaveBeenCalledWith('');
    });
  });

  describe('views and static assets', () => {
    const dirs: string[] = [];
    const makeDir = () => {
      const dir = mkdtempSync(join(tmpdir(), 'nest-adapter-'));
      dirs.push(dir);
      return dir;
    };

    it('should render through a configured engine', async () => {
      const dir = makeDir();
      writeFileSync(join(dir, 'page.tpl'), 'x');
      const adapter = new NodeAdapter();
      adapter.setViewEngine({
        engine: { tpl: (_file: string, _data: any, cb: any) => cb(null, '<p>x</p>') },
        root: dir,
      });
      const res = makeRes();
      await adapter.render(res, 'page', {});
      expect(res.writeHead).toHaveBeenCalledWith(
        200,
        expect.objectContaining({ 'Content-Type': 'text/html; charset=utf-8' }),
      );
      expect(res.end).toHaveBeenCalledWith('<p>x</p>');
    });

    it('should render through a wrapped res.send() and add a content type', async () => {
      const dir = makeDir();
      writeFileSync(join(dir, 'page.tpl'), 'x');
      const adapter = new NodeAdapter();
      adapter.setViewEngine({
        engine: { tpl: (_file: string, _data: any, cb: any) => cb(null, 'ok') },
        root: dir,
      });
      const res = makeRes({ send: vi.fn() });
      await adapter.render(res, 'page', {});
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'text/html; charset=utf-8',
      );
      expect(res.send).toHaveBeenCalledWith('ok');
    });

    it('should keep an existing content type when a wrapped send is used', async () => {
      const dir = makeDir();
      writeFileSync(join(dir, 'page.tpl'), 'x');
      const adapter = new NodeAdapter();
      adapter.setViewEngine({
        engine: { tpl: (_file: string, _data: any, cb: any) => cb(null, 'ok') },
        root: dir,
      });
      const res = makeRes({ send: vi.fn() });
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      await adapter.render(res, 'page', {});
      expect(res.send).toHaveBeenCalledWith('ok');
    });

    it('should mount static assets at a prefix and at the root', () => {
      const adapter = new NodeAdapter();
      adapter.useStaticAssets(process.cwd(), { prefix: '/assets' });
      adapter.useStaticAssets(process.cwd());
      expect((adapter.getInstance() as any).stack.length).toBeGreaterThan(0);
    });

    it('should clean up temporary view directories', () => {
      for (const dir of dirs.splice(0)) {
        rmSync(dir, { recursive: true, force: true });
      }
      expect(dirs).toHaveLength(0);
    });
  });

  describe('not found handlers', () => {
    it('should answer a too long parameter with a 414', () => {
      const adapter = new NodeAdapter();
      const handler = vi.fn();
      adapter.setNotFoundHandler(handler);
      const layer = (adapter.getInstance() as any).stack.at(-1);
      const req = makeRequest({ [PARAM_TOO_LONG_KEY]: true });
      const next = vi.fn();
      layer.handler(req, {}, next);
      expect(next.mock.calls[0][0].status).toBe(414);
      expect(handler).not.toHaveBeenCalled();
    });

    it('should call the handler for a normal miss', () => {
      const adapter = new NodeAdapter();
      const handler = vi.fn();
      adapter.setNotFoundHandler(handler);
      const layer = (adapter.getInstance() as any).stack.at(-1);
      layer.handler(makeRequest(), {}, vi.fn());
      expect(handler).toHaveBeenCalled();
    });

    it('should register excluded routes under a prefix', () => {
      const adapter = new NodeAdapter();
      adapter.setNotFoundHandler(vi.fn(), '/api', [
        { path: '/health', method: RequestMethod.GET },
      ] as any);
      const stack = (adapter.getInstance() as any).stack;
      expect(stack).toHaveLength(2);
    });

    it('should skip requests that belong to another registered prefix', () => {
      const adapter = new NodeAdapter();
      const handler = vi.fn();
      adapter.setNotFoundHandler(handler, '/api');
      adapter.setNotFoundHandler(handler);
      const rootLayer = (adapter.getInstance() as any).stack.at(-1);
      const next = vi.fn();
      rootLayer.handler(makeRequest({ url: '/api/users' }), {}, next);
      expect(next).toHaveBeenCalled();
      expect(handler).not.toHaveBeenCalled();
    });

    it('should delegate other requests to the not-found handler', () => {
      const adapter = new NodeAdapter();
      const handler = vi.fn();
      adapter.setNotFoundHandler(handler, '/api');
      adapter.setNotFoundHandler(handler);
      const rootLayer = (adapter.getInstance() as any).stack.at(-1);
      rootLayer.handler(makeRequest({ url: '/other' }), {}, vi.fn());
      expect(handler).toHaveBeenCalled();
    });
  });

  describe('middleware factory paths', () => {
    it('should mount a method-less middleware for an exact path', () => {
      const adapter = new NodeAdapter();
      const factory = adapter.createMiddlewareFactory(-1 as any);
      expect(() => factory('/api$', vi.fn())).not.toThrow();
    });

    it('should mount a method-less middleware for a prefix path', () => {
      const adapter = new NodeAdapter();
      const factory = adapter.createMiddlewareFactory(-1 as any);
      expect(() => factory('/api', vi.fn())).not.toThrow();
    });

    it('should use an exact middleware for a method and exact path', () => {
      const adapter = new NodeAdapter();
      const factory = adapter.createMiddlewareFactory(RequestMethod.GET);
      expect(() => factory('/api$', vi.fn())).not.toThrow();
    });

    it('should report an invalid middleware path', () => {
      const adapter = new NodeAdapter();
      const factory = adapter.createMiddlewareFactory(RequestMethod.GET);
      expect(() => factory('/a(b', vi.fn())).toThrow();
    });
  });

  describe('server lifecycle', () => {
    it('should return undefined when closing without a server', () => {
      const adapter = new NodeAdapter();
      expect(adapter.close()).toBeUndefined();
    });

    it('should close an initialized server', async () => {
      const adapter = new NodeAdapter();
      adapter.initHttpServer({});
      await new Promise<void>(resolve => adapter.listen(0, resolve));
      await expect(adapter.close()).resolves.toBeUndefined();
    });

    it('should create an HTTPS server when httpsOptions is given', async () => {
      const adapter = new NodeAdapter();
      adapter.initHttpServer({ httpsOptions: {} });
      expect((adapter as any).httpServer).toBeDefined();
      await adapter.close();
    });

    it('should map an EISDIR route error to a 404', () => {
      const adapter = new NodeAdapter();
      adapter.initHttpServer({});
      const error = Object.assign(new Error('dir'), { code: 'EISDIR' });
      const spy = vi.spyOn(adapter.getInstance(), 'handleError');
      (adapter as any).httpServer[ROUTE_ERROR_HANDLER](
        error,
        makeRequest({ method: 'GET', url: '/dir' }),
        makeRes(),
      );
      expect(spy.mock.calls[0][0]).toBeInstanceOf(NotFoundException);
    });

    it('should forward other route errors unchanged', () => {
      const adapter = new NodeAdapter();
      adapter.initHttpServer({});
      const error = new Error('boom');
      const spy = vi.spyOn(adapter.getInstance(), 'handleError');
      (adapter as any).httpServer[ROUTE_ERROR_HANDLER](
        error,
        makeRequest(),
        makeRes(),
      );
      expect(spy).toHaveBeenCalledWith(error, expect.anything(), expect.anything());
    });

    it('should answer 503 while shutting down when configured', () => {
      const adapter = new NodeAdapter();
      adapter.initHttpServer({ return503OnClosing: true });
      const layer = (adapter.getInstance() as any).stack[0];
      const passing = { setHeader: vi.fn(), end: vi.fn(), statusCode: 200 };
      const next = vi.fn();
      layer.handler(makeRequest(), passing, next);
      expect(next).toHaveBeenCalled();
      adapter.beforeClose();
      const res = makeRes();
      layer.handler(makeRequest(), res, vi.fn());
      expect(res.statusCode).toBe(503);
      expect(res.end).toHaveBeenCalledWith('Service Unavailable');
    });

    it('should track and destroy open connections when configured', () => {
      const adapter = new NodeAdapter();
      adapter.initHttpServer({ forceCloseConnections: true });
      const socket: any = new PassThrough();
      socket.destroy = vi.fn();
      (adapter as any).httpServer.emit('connection', socket);
      adapter.close();
      expect(socket.destroy).toHaveBeenCalled();
    });

    it('should mark connections as shutting down without 503 responses', () => {
      const adapter = new NodeAdapter();
      adapter.initHttpServer({});
      adapter.beforeClose();
      expect((adapter as any).httpServer[SHUTTING_DOWN]).toBe(true);
    });
  });

  describe('request and response hooks', () => {
    it('should run the router when no request hook is set', () => {
      const adapter = new NodeAdapter();
      const spy = vi.spyOn(adapter.getInstance(), 'handle');
      (adapter as any).handleRequest(makeRequest(), makeRes());
      expect(spy).toHaveBeenCalled();
    });

    it('should continue after a request hook calls done()', () => {
      const adapter = new NodeAdapter();
      adapter.setOnRequestHook((_req, _res, done) => done());
      const spy = vi.spyOn(adapter.getInstance(), 'handle');
      (adapter as any).handleRequest(makeRequest(), makeRes());
      expect(spy).toHaveBeenCalled();
    });

    it('should hand an error to the error handler', () => {
      const adapter = new NodeAdapter();
      const error = new Error('hook');
      adapter.setOnRequestHook((_req, _res, done) => done(error));
      const spy = vi.spyOn(adapter.getInstance(), 'handleError');
      (adapter as any).handleRequest(makeRequest(), makeRes());
      expect(spy).toHaveBeenCalledWith(error, expect.anything(), expect.anything());
    });

    it('should ignore a later completion without an error', () => {
      const adapter = new NodeAdapter();
      adapter.setOnRequestHook((_req, _res, done) => {
        done();
        done();
      });
      const spy = vi.spyOn(adapter.getInstance(), 'handle');
      (adapter as any).handleRequest(makeRequest(), makeRes());
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('should log errors after the first completion', () => {
      const adapter = new NodeAdapter();
      adapter.setOnRequestHook((_req, _res, done) => {
        done();
        done(new Error('late'));
      });
      const logger = (adapter as any).logger;
      const spy = vi.spyOn(logger, 'error');
      (adapter as any).handleRequest(makeRequest(), makeRes());
      expect(spy).toHaveBeenCalled();
    });

    it('should forward a rejected request-hook promise', async () => {
      const adapter = new NodeAdapter();
      adapter.setOnRequestHook(() => Promise.reject(new Error('rejected')));
      const spy = vi.spyOn(adapter.getInstance(), 'handleError');
      (adapter as any).handleRequest(makeRequest(), makeRes());
      await new Promise(resolve => setImmediate(resolve));
      expect(spy).toHaveBeenCalled();
    });

    it('should wrap a rejection without a reason', async () => {
      const adapter = new NodeAdapter();
      adapter.setOnRequestHook(() => Promise.reject());
      const spy = vi.spyOn(adapter.getInstance(), 'handleError');
      (adapter as any).handleRequest(makeRequest(), makeRes());
      await new Promise(resolve => setImmediate(resolve));
      expect(spy.mock.calls[0][0].message).toBe('Request hook failed');
    });

    it('should catch a thrown request-hook error', () => {
      const adapter = new NodeAdapter();
      adapter.setOnRequestHook(() => {
        throw new Error('thrown');
      });
      const spy = vi.spyOn(adapter.getInstance(), 'handleError');
      (adapter as any).handleRequest(makeRequest(), makeRes());
      expect(spy).toHaveBeenCalled();
    });

    it('should wrap a thrown falsy value', () => {
      const adapter = new NodeAdapter();
      adapter.setOnRequestHook(() => {
        throw '';
      });
      const spy = vi.spyOn(adapter.getInstance(), 'handleError');
      (adapter as any).handleRequest(makeRequest(), makeRes());
      expect(spy.mock.calls[0][0].message).toBe('Request hook failed');
    });

    it('should run a response hook on finish', () => {
      const adapter = new NodeAdapter();
      let finish!: () => void;
      const res = makeRes({
        on: vi.fn((_event: string, callback: () => void) => {
          finish = callback;
        }),
      });
      const hook = vi.fn();
      adapter.setOnResponseHook(hook);
      (adapter as any).handleRequest(makeRequest(), res);
      finish();
      expect(hook).toHaveBeenCalled();
    });

    it('should log a response hook error', () => {
      const adapter = new NodeAdapter();
      let finish!: () => void;
      const res = makeRes({
        on: vi.fn((_event: string, callback: () => void) => {
          finish = callback;
        }),
      });
      adapter.setOnResponseHook(() => {
        throw new Error('response hook');
      });
      const spy = vi.spyOn((adapter as any).logger, 'error');
      (adapter as any).handleRequest(makeRequest(), res);
      finish();
      expect(spy).toHaveBeenCalled();
    });

    it('should log a rejected response hook promise', async () => {
      const adapter = new NodeAdapter();
      let finish!: () => void;
      const res = makeRes({
        on: vi.fn((_event: string, callback: () => void) => {
          finish = callback;
        }),
      });
      adapter.setOnResponseHook(() => Promise.reject(new Error('async')));
      const spy = vi.spyOn((adapter as any).logger, 'error');
      (adapter as any).handleRequest(makeRequest(), res);
      finish();
      await new Promise(resolve => setImmediate(resolve));
      expect(spy).toHaveBeenCalled();
    });
  });

  describe('private helpers', () => {
    it('should cache injected prototypes', () => {
      const adapter = new NodeAdapter();
      const own = {};
      const first = Object.create(own);
      const second = Object.create(own);
      (adapter as any).setInjectedPrototype(first, {});
      (adapter as any).setInjectedPrototype(second, {});
      expect(Object.getPrototypeOf(first)).toBe(Object.getPrototypeOf(second));
    });

    it('should destroy the socket when headers were sent', () => {
      const adapter = new NodeAdapter();
      const socket = { destroy: vi.fn() };
      const req = makeRequest({ socket });
      const res = makeRes({ headersSent: true });
      (adapter as any).finalHandler(new Error('x'), req, res);
      expect(socket.destroy).toHaveBeenCalled();
    });

    it('should answer a final error with its status and reason', () => {
      const adapter = new NodeAdapter();
      const res = makeRes({ getHeader: vi.fn(() => undefined) });
      (adapter as any).finalHandler(
        Object.assign(new Error('nope'), { status: 404 }),
        makeRequest(),
        res,
      );
      expect(res.statusCode).toBe(404);
      expect(res.end).toHaveBeenCalledWith('Not Found');
    });

    it('should answer a final error without a status as 500', () => {
      const adapter = new NodeAdapter();
      const res = makeRes();
      (adapter as any).finalHandler(
        { message: 'bad' },
        makeRequest(),
        res,
      );
      expect(res.statusCode).toBe(500);
    });

    it('should answer an unmatched request with its path', () => {
      const adapter = new NodeAdapter();
      const res = makeRes();
      (adapter as any).finalHandler(
        undefined,
        makeRequest({ method: 'POST', originalUrl: '/a/b?x=1', url: '/a/b?x=1' }),
        res,
      );
      expect(res.statusCode).toBe(404);
      expect(res.end).toHaveBeenCalledWith('Cannot POST /a/b');
    });

    it('should fall back to req.url when originalUrl is missing', () => {
      const adapter = new NodeAdapter();
      const res = makeRes();
      (adapter as any).finalHandler(
        undefined,
        makeRequest({ method: 'GET', url: '/only' }),
        res,
      );
      expect(res.end).toHaveBeenCalledWith('Cannot GET /only');
    });

    it('should use the error object when it has no stack', () => {
      const adapter = new NodeAdapter();
      const res = makeRes();
      const logger = vi.spyOn((adapter as any).logger, 'error');
      const error = { statusCode: 500, message: 'no stack' };
      (adapter as any).finalHandler(error, makeRequest(), res);
      expect(logger).toHaveBeenCalledWith(error);
    });

    it('should skip writing a body when endWithoutBody matches', () => {
      const adapter = new NodeAdapter();
      const res = makeRes({ statusCode: 204 });
      (adapter as any).writeBody(res, 'x', undefined, 'text/plain');
      expect(res.writeHead).not.toHaveBeenCalled();
    });

    it('should set only headers that are absent', () => {
      const adapter = new NodeAdapter();
      const res = makeRes({ getHeader: vi.fn(() => 'existing') });
      (adapter as any).setHeaderIfNotExists(res, 'X-Test', 'value');
      expect(res.setHeader).not.toHaveBeenCalled();
      (adapter as any).setHeaderIfNotExists(res, 'X-Test', undefined);
      expect(res.setHeader).not.toHaveBeenCalled();
    });

    it('should join array header values', () => {
      const adapter = new NodeAdapter();
      const res = makeRes({ getHeader: vi.fn(() => undefined) });
      (adapter as any).setHeaderIfNotExists(res, 'X-Test', ['a', 'b']);
      expect(res.setHeader).toHaveBeenCalledWith('X-Test', 'a,b');
    });

    it('should keep an existing Transfer-Encoding out of stream headers', () => {
      const adapter = new NodeAdapter();
      const res = makeRes({ hasHeader: vi.fn(() => true) });
      const streamable = {
        getHeaders: () => ({ type: 'text/plain', disposition: 'inline', length: 3 }),
      };
      (adapter as any).applyStreamHeaders(res, streamable);
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/plain');
      expect(res.setHeader).not.toHaveBeenCalledWith('Content-Length', 3);
    });

    it('should set stream headers when no Transfer-Encoding exists', () => {
      const adapter = new NodeAdapter();
      const res = makeRes({ getHeader: vi.fn(() => undefined) });
      const streamable = {
        getHeaders: () => ({ type: 'text/plain', disposition: 'inline', length: 3 }),
      };
      (adapter as any).applyStreamHeaders(res, streamable);
      expect(res.setHeader).toHaveBeenCalledWith('Content-Length', 3);
    });
  });

  describe('additional version filters', () => {
    it('should match an array version against a string extraction', () => {
      const adapter = new NodeAdapter();
      const handler = vi.fn();
      const filter = adapter.applyVersionFilter(handler, ['1', '2'], {
        type: VersioningType.CUSTOM,
        extractor: () => '2',
      } as any);
      filter({}, {}, vi.fn());
      expect(handler).toHaveBeenCalled();
    });

    it('should pass on for an array version and string extraction mismatch', () => {
      const adapter = new NodeAdapter();
      const next = vi.fn();
      const filter = adapter.applyVersionFilter(vi.fn(), ['1'], {
        type: VersioningType.CUSTOM,
        extractor: () => '3',
      } as any);
      filter({}, {}, next);
      expect(next).toHaveBeenCalled();
    });

    it('should pass on for a version that is neither a string nor an array', () => {
      const adapter = new NodeAdapter();
      const next = vi.fn();
      const filter = adapter.applyVersionFilter(vi.fn(), 1 as any, {
        type: VersioningType.CUSTOM,
        extractor: () => '1',
      } as any);
      filter({}, {}, next);
      expect(next).toHaveBeenCalled();
    });

    it('should match a string version against array extraction', () => {
      const adapter = new NodeAdapter();
      const handler = vi.fn();
      const filter = adapter.applyVersionFilter(handler, '1', {
        type: VersioningType.CUSTOM,
        extractor: () => ['1'],
      } as any);
      filter({}, {}, vi.fn());
      expect(handler).toHaveBeenCalled();
    });

    it('should pass on for a string version and array extraction mismatch', () => {
      const adapter = new NodeAdapter();
      const next = vi.fn();
      const filter = adapter.applyVersionFilter(vi.fn(), '1', {
        type: VersioningType.CUSTOM,
        extractor: () => ['2'],
      } as any);
      filter({}, {}, next);
      expect(next).toHaveBeenCalled();
    });

    it('should match an array media type version', () => {
      const adapter = new NodeAdapter();
      const handler = vi.fn();
      const filter = adapter.applyVersionFilter(handler, ['2', '3'], {
        type: VersioningType.MEDIA_TYPE,
        key: 'v=',
      } as any);
      filter({ headers: { accept: 'application/json;v=2' } }, {}, vi.fn());
      expect(handler).toHaveBeenCalled();
    });

    it('should pass on for an array media type version mismatch', () => {
      const adapter = new NodeAdapter();
      const next = vi.fn();
      const filter = adapter.applyVersionFilter(vi.fn(), ['2'], {
        type: VersioningType.MEDIA_TYPE,
        key: 'v=',
      } as any);
      filter({ headers: { accept: 'application/json;v=3' } }, {}, next);
      expect(next).toHaveBeenCalled();
    });

    it('should pass on for a string media type version mismatch', () => {
      const adapter = new NodeAdapter();
      const next = vi.fn();
      const filter = adapter.applyVersionFilter(vi.fn(), '2', {
        type: VersioningType.MEDIA_TYPE,
        key: 'v=',
      } as any);
      filter({ headers: { accept: 'application/json;v=3' } }, {}, next);
      expect(next).toHaveBeenCalled();
    });

    it('should match an array header version', () => {
      const adapter = new NodeAdapter();
      const handler = vi.fn();
      const filter = adapter.applyVersionFilter(handler, ['2'], {
        type: VersioningType.HEADER,
        header: 'X-Version',
      } as any);
      filter({ headers: { 'x-version': '2' } }, {}, vi.fn());
      expect(handler).toHaveBeenCalled();
    });

    it('should pass on for an array header version mismatch', () => {
      const adapter = new NodeAdapter();
      const next = vi.fn();
      const filter = adapter.applyVersionFilter(vi.fn(), ['2'], {
        type: VersioningType.HEADER,
        header: 'X-Version',
      } as any);
      filter({ headers: { 'x-version': '3' } }, {}, next);
      expect(next).toHaveBeenCalled();
    });

    it('should pass on for a string header version mismatch', () => {
      const adapter = new NodeAdapter();
      const next = vi.fn();
      const filter = adapter.applyVersionFilter(vi.fn(), '2', {
        type: VersioningType.HEADER,
        header: 'X-Version',
      } as any);
      filter({ headers: { 'x-version': '3' } }, {}, next);
      expect(next).toHaveBeenCalled();
    });
  });
});