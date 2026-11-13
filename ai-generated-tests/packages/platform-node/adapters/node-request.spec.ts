import { createServer, get } from 'node:http';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  endWithoutBody,
  NodeRequest,
  NodeResponse,
  ROUTE_ERROR_HANDLER,
  SHUTTING_DOWN,
  toBytes,
} from '../../../../packages/platform-node/adapters/node-request.js';


const tempDirs: string[] = [];
function tempFile(
  name: string,
  content = 'hello',
): { dir: string; file: string } {
  const dir = mkdtempSync(join(tmpdir(), 'node-request-'));
  tempDirs.push(dir);
  const file = join(dir, name);
  writeFileSync(file, content);
  return { dir, file };
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

async function sendFileViaServer(
  file: string,
  options?: any,
  configure?: (req: any, res: any) => void,
  withCallback = true,
) {
  const result: { err?: any; handled?: any } = {};
  const server = createServer((req, res) => {
    Object.setPrototypeOf(res, NodeResponse.prototype);
    (res as any).req = req;
    configure?.(req, res);
    const done = (err?: Error) => {
      result.err = err;
      if (!res.writableEnded) {
        res.statusCode = err ? 500 : 200;
        res.end('done');
      }
    };
    if (!withCallback) {
      (res as any).sendFile(file, options ?? undefined);
    } else if (options === undefined) {
      (res as any).sendFile(file, done);
    } else {
      (res as any).sendFile(file, options, done);
    }
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as any;
  const response = await fetch(`http://127.0.0.1:${port}/`);
  const body = await response.text();
  await new Promise(resolve => setTimeout(resolve, 20));
  await new Promise<void>(resolve => server.close(() => resolve()));
  return { response, body, result };
}

const makeReq = (init: any = {}) =>
  Object.assign(Object.create(NodeRequest.prototype), {
    headers: {},
    url: '/',
    method: 'GET',
    socket: { remoteAddress: '127.0.0.1', encrypted: false },
    ...init,
  }) as NodeRequest;

function makeRes(init: any = {}) {
  const headers = new Map<string, any>();
  const res: any = Object.create(NodeResponse.prototype);
  Object.assign(res, {
    statusCode: 200,
    headers,
    setHeader: vi.fn((name: string, value: any) => headers.set(name.toLowerCase(), value)),
    getHeader: vi.fn((name: string) => headers.get(name.toLowerCase())),
    hasHeader: vi.fn((name: string) => headers.has(name.toLowerCase())),
    removeHeader: vi.fn((name: string) => headers.delete(name.toLowerCase())),
    end: vi.fn(),
    writeHead: vi.fn(),
    destroy: vi.fn(),
    req: makeReq(),
    ...init,
  });
  Object.defineProperty(res, 'headersSent', {
    configurable: true,
    get: () => false,
  });
  return res as NodeResponse & any;
}

// CFG (C3) summary for NodeRequest:
//   query: cache hit T/F; '?' present T/F
//   path: getRoutingPath success/throw
//   protocol: encrypted T/F
//   get: referer/referrer T/F
//   is: type-is result
// NodeResponse:
//   writeHead: SHUTTING_DOWN T/F
//   set: string vs object; content-type array; lookupContentType truthy/falsy
//   append: previous present T/F; previous array T/F; value array T/F
//   cookie: signed without secret T/F; object T/F; signed T/F; maxAge != null T/F;
//           NaN T/F; path == null T/F
//   json: endWithoutBody T/F; content-type present T/F; send wrapped T/F;
//         text undefined T/F
//   send: endWithoutBody; null/undefined; string; ArrayBuffer view; object/number/boolean; other
//   sendFile: !path; non-string; options function; root missing; callback branches
//   redirect: status given T/F; Accept text/html/null; HEAD T/F; Transfer-Encoding T/F
describe('NodeRequest', () => {
  describe('query', () => {
    it('should parse the query string on first access and cache it', () => {
      const req = makeReq({ url: '/users?a=1&b=2' });
      expect(req.query).toEqual({ a: '1', b: '2' });
      expect(req.query).toBe(req.query);
    });

    it('should return an empty object without a query string', () => {
      expect(makeReq({ url: '/users' }).query).toEqual({});
    });

    it('should allow the query to be replaced', () => {
      const req = makeReq({ url: '/users?a=1' });
      req.query = { replaced: 'yes' };
      expect(req.query).toEqual({ replaced: 'yes' });
    });
  });

  describe('path', () => {
    it('should return the routing path without the query', () => {
      expect(makeReq({ url: '/users/1?x=1' }).path).toBe('/users/1');
      expect(makeReq({ url: '/%61dmin' }).path).toBe('/admin');
    });

    it('should fall back to a plain slice for a malformed URL', () => {
      expect(makeReq({ url: '/%?x=1' }).path).toBe('/%');
      expect(makeReq({ url: '/%' }).path).toBe('/%');
    });
  });

  describe('simple getters', () => {
    it('should read the hostname from the Host header', () => {
      expect(makeReq({ headers: { host: 'example.com:3000' } }).hostname).toBe(
        'example.com',
      );
      expect(makeReq().hostname).toBeUndefined();
    });

    it('should read ip, ips, protocol and secure', () => {
      expect(makeReq().ip).toBe('127.0.0.1');
      expect(makeReq({ socket: undefined }).ip).toBeUndefined();
      expect(makeReq().ips).toEqual([]);
      expect(makeReq().protocol).toBe('http');
      expect(makeReq().secure).toBe(false);
      expect(
        makeReq({ socket: { remoteAddress: '::1', encrypted: true } }),
      ).toMatchObject({ protocol: 'https', secure: true });
    });

    it('should expose a frozen Express-like app', () => {
      const app = makeReq().app;
      expect(app.get('trust proxy')).toBe(false);
      expect(app.get('anything')).toBeUndefined();
      expect(makeReq().app).toBe(app);
    });
  });

  describe('get and header', () => {
    it('should read headers case-insensitively', () => {
      const req = makeReq({ headers: { 'x-test': 'v' } });
      expect(req.get('X-Test')).toBe('v');
      expect(req.header('X-Test')).toBe('v');
      expect(req.get('missing')).toBeUndefined();
    });

    it.each([
      [{ referrer: 'r1', referer: 'r2' }, 'r1'],
      [{ referer: 'r2' }, 'r2'],
      [{ referrer: 'r1' }, 'r1'],
      [{}, undefined],
    ])('should resolve referer/referrer headers (%j)', (headers, expected) => {
      expect(makeReq({ headers }).get('REFERER')).toBe(expected);
      expect(makeReq({ headers }).get('referrer')).toBe(expected);
    });
  });

  describe('is', () => {
    it('should match the request content type', () => {
      const req = makeReq({
        headers: { 'content-type': 'application/json', 'transfer-encoding': 'chunked' },
      });
      expect(req.is('json')).toBe('json');
      expect(req.is('html')).toBe(false);
      expect(req.is('application/json')).toBe('application/json');
    });

    it('should return null when the request has no body', () => {
      const req = makeReq({ headers: { 'content-type': 'text/plain' } });
      expect(req.is('text/plain')).toBeNull();
    });

    it('should return the media type without arguments', () => {
      const req = makeReq({
        headers: { 'content-type': 'text/html', 'content-length': '1' },
      });
      expect(req.is()).toBe('text/html');
    });
  });
});

describe('NodeResponse', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should create locals lazily and allow replacement', () => {
    const res = makeRes();
    expect(res.locals).toEqual({});
    expect(res.locals).toBe(res.locals);
    res.locals = { a: 1 };
    expect(res.locals).toEqual({ a: 1 });
  });

  it('should set the status code and chain', () => {
    const res = makeRes();
    expect(res.status(201)).toBe(res);
    expect(res.statusCode).toBe(201);
  });

  describe('set/header', () => {
    it('should stringify a single header', () => {
      const res = makeRes();
      res.set('X-Number', 1);
      expect(res.setHeader).toHaveBeenCalledWith('X-Number', '1');
    });

    it('should stringify every element of an array value', () => {
      const res = makeRes();
      res.set('X-List', [1, 2]);
      expect(res.setHeader).toHaveBeenCalledWith('X-List', ['1', '2']);
    });

    it('should throw for an Array content type', () => {
      const res = makeRes();
      expect(() => res.set('Content-Type', ['a', 'b'])).toThrow(TypeError);
    });

    it('should add the charset to a content type', () => {
      const res = makeRes();
      res.set('Content-Type', 'text/plain');
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'text/plain; charset=utf-8',
      );
    });

    it('should keep an unknown content type when the lookup fails', () => {
      const res = makeRes();
      res.set('Content-Type', 'x-unknown');
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'x-unknown');
    });

    it('should set every header of an object', () => {
      const res = makeRes();
      res.set({ A: '1', B: '2' });
      expect(res.setHeader).toHaveBeenCalledWith('A', '1');
      expect(res.setHeader).toHaveBeenCalledWith('B', '2');
    });

    it('should alias header to set', () => {
      const res = makeRes();
      res.header('X-Test', 'v');
      expect(res.setHeader).toHaveBeenCalledWith('X-Test', 'v');
    });
  });

  describe('append', () => {
    it('should set a header when it does not exist', () => {
      const res = makeRes();
      res.append('X-Test', 'a');
      expect(res.setHeader).toHaveBeenCalledWith('X-Test', 'a');
    });

    it('should combine with a previous scalar', () => {
      const res = makeRes();
      res.getHeader.mockReturnValue('a');
      res.append('X-Test', 'b');
      expect(res.setHeader).toHaveBeenCalledWith('X-Test', ['a', 'b']);
    });

    it('should combine with a previous array', () => {
      const res = makeRes();
      res.getHeader.mockReturnValue(['a']);
      res.append('X-Test', 'b');
      expect(res.setHeader).toHaveBeenCalledWith('X-Test', ['a', 'b']);
    });

    it('should spread an array value after a previous scalar', () => {
      const res = makeRes();
      res.getHeader.mockReturnValue('a');
      res.append('X-Test', ['b', 'c']);
      expect(res.setHeader).toHaveBeenCalledWith('X-Test', ['a', 'b', 'c']);
    });
  });

  describe('cookie', () => {
    it('should serialize a scalar cookie with the default path', () => {
      const res = makeRes();
      res.cookie('name', 'value');
      expect(res.getHeader('Set-Cookie')).toContain('name=value; Path=/');
    });

    it('should serialize an object as j:JSON', () => {
      const res = makeRes();
      res.cookie('name', { a: 1 });
      expect(res.getHeader('Set-Cookie')).toContain(
        `name=${encodeURIComponent('j:{"a":1}')}`,
      );
    });

    it('should throw for a signed cookie without a secret', () => {
      const res = makeRes();
      expect(() => res.cookie('name', 'v', { signed: true })).toThrow(
        'cookieParser("secret") required',
      );
    });

    it('should sign a cookie when the request has a secret', () => {
      const res = makeRes({ req: makeReq({ secret: 'keyboard cat' }) });
      res.cookie('name', 'v', { signed: true });
      expect(res.getHeader('Set-Cookie')).toContain('name=s%3A');
    });

    it('should convert maxAge from milliseconds to seconds', () => {
      const res = makeRes();
      res.cookie('name', 'v', { maxAge: 5000 });
      expect(res.getHeader('Set-Cookie')).toContain('Max-Age=5');
    });

    it('should reject a non-numeric maxAge', () => {
      const res = makeRes();
      expect(() => res.cookie('name', 'v', { maxAge: 'abc' as any })).toThrow(
        'maxAge is invalid',
      );
    });

    it('should keep an explicit path', () => {
      const res = makeRes();
      res.cookie('name', 'v', { path: '/api' });
      expect(res.getHeader('Set-Cookie')).toContain('Path=/api');
    });

    it('should clear a cookie', () => {
      const res = makeRes();
      res.clearCookie('name', { domain: 'example.com' });
      const cookie = res.getHeader('Set-Cookie');
      expect(cookie).toContain('name=;');
      expect(cookie).toContain('Expires=Thu, 01 Jan 1970');
    });
  });

  it('should return a header with get', () => {
    const res = makeRes();
    res.setHeader('X-Test', 'v');
    expect(res.get('x-test')).toBe('v');
  });

  describe('type', () => {
    it('should set a MIME type directly', () => {
      const res = makeRes();
      res.type('text/html');
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/html; charset=utf-8');
    });

    it('should resolve an extension', () => {
      const res = makeRes();
      res.type('json');
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'application/json; charset=utf-8',
      );
    });

    it('should fall back to octet-stream for an unknown extension', () => {
      const res = makeRes();
      res.type('nope');
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'application/octet-stream',
      );
    });
  });

  describe('json', () => {
    it('should serialize an object', () => {
      const res = makeRes();
      res.json({ a: 1 });
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'application/json; charset=utf-8',
      );
      expect(res.end).toHaveBeenCalledWith('{"a":1}');
    });

    it('should not override an existing content type', () => {
      const res = makeRes();
      res.setHeader('Content-Type', 'application/vnd.api+json');
      res.json({ a: 1 });
      expect(res.getHeader('Content-Type')).toBe('application/vnd.api+json');
    });

    it('should end without a body for status 204', () => {
      const res = makeRes({ statusCode: 204 });
      res.json({ a: 1 });
      expect(res.end).toHaveBeenCalledWith();
    });

    it('should end when JSON.stringify returns undefined', () => {
      const res = makeRes();
      res.json(undefined);
      expect(res.end).toHaveBeenCalledWith();
    });

    it('should go through a wrapped send', () => {
      const res = makeRes();
      res.send = vi.fn();
      res.json({ a: 1 });
      expect(res.send).toHaveBeenCalledWith('{"a":1}');
    });
  });

  describe('send', () => {
    it.each([[undefined], [null]])('should end for %s', body => {
      const res = makeRes();
      res.send(body);
      expect(res.end).toHaveBeenCalledWith();
    });

    it('should send a string with text/plain', () => {
      const res = makeRes();
      res.send('hello');
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'text/plain; charset=utf-8',
      );
      expect(res.end).toHaveBeenCalledWith('hello');
    });

    it('should keep an existing content type for a string', () => {
      const res = makeRes();
      res.setHeader('Content-Type', 'text/html');
      res.send('<p>x</p>');
      expect(res.getHeader('Content-Type')).toBe('text/html');
    });

    it('should send a typed array as binary', () => {
      const res = makeRes();
      const body = new Uint8Array([1, 2, 3]);
      res.send(body);
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'application/octet-stream',
      );
      expect(res.end).toHaveBeenCalledWith(body);
    });

    it('should keep an existing content type for bytes', () => {
      const res = makeRes();
      res.setHeader('Content-Type', 'image/png');
      res.send(new Uint8Array([1]));
      expect(res.getHeader('Content-Type')).toBe('image/png');
    });

    it('should not set Content-Length when Transfer-Encoding is present', () => {
      const res = makeRes();
      res.setHeader('Transfer-Encoding', 'chunked');
      res.send('hello');
      expect(res.setHeader).not.toHaveBeenCalledWith(
        'Content-Length',
        expect.anything(),
      );
    });

    it('should send a DataView as binary bytes', () => {
      const res = makeRes();
      const buffer = new ArrayBuffer(4);
      new Uint8Array(buffer).set([1, 2, 3, 4]);
      const view = new DataView(buffer, 1, 2);
      res.send(view);
      expect(res.end.mock.calls[0][0]).toBeInstanceOf(Uint8Array);
      expect(Array.from(res.end.mock.calls[0][0])).toEqual([2, 3]);
    });

    it.each([[{ a: 1 }], [42], [true]])(
      'should delegate JSON-like body %j to json()',
      body => {
        const res = makeRes();
        const json = vi.spyOn(res, 'json');
        res.send(body);
        expect(json).toHaveBeenCalledWith(body);
      },
    );

    it('should stringify any other value', () => {
      const res = makeRes();
      const send = vi.spyOn(res, 'send');
      res.send(Symbol('x'));
      expect(send).toHaveBeenCalledWith('Symbol(x)');
    });

    it('should end 205 without a body', () => {
      const res = makeRes({ statusCode: 205 });
      res.send('ignored');
      expect(res.setHeader).toHaveBeenCalledWith('Content-Length', '0');
      expect(res.end).toHaveBeenCalledWith();
    });
  });

  it('should send a status with its reason phrase', () => {
    const res = makeRes();
    res.sendStatus(404);
    expect(res.statusCode).toBe(404);
    expect(res.end).toHaveBeenCalledWith('Not Found');
  });

  it('should fall back to the numeric status string', () => {
    const res = makeRes();
    res.sendStatus(799);
    expect(res.end).toHaveBeenCalledWith('799');
  });

  describe('sendFile', () => {
    it('should require a path', () => {
      const res = makeRes();
      expect(() => res.sendFile('')).toThrow('path argument is required');
    });

    it('should require a string path', () => {
      const res = makeRes();
      expect(() => res.sendFile({} as any)).toThrow('path must be a string');
    });

    it('should require an absolute path without a root', () => {
      const res = makeRes();
      expect(() => res.sendFile('relative.txt')).toThrow(
        'path must be absolute or specify root',
      );
    });
  });

  describe('redirect', () => {
    it('should send a plain-text body by default', () => {
      const res = makeRes();
      res.redirect('/next');
      expect(res.statusCode).toBe(302);
      expect(res.setHeader).toHaveBeenCalledWith('Location', '/next');
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'text/plain; charset=utf-8',
      );
      expect(res.end).toHaveBeenCalledWith(
        'Found. Redirecting to /next',
      );
    });

    it('should use an explicit status code', () => {
      const res = makeRes();
      res.redirect(301, '/next');
      expect(res.statusCode).toBe(301);
      expect(res.end.mock.calls[0][0]).toContain('Moved Permanently');
    });

    it('should send an HTML body when preferred', () => {
      const res = makeRes({
        req: makeReq({ headers: { accept: 'text/html' } }),
      });
      res.redirect('/next?a=1&b=2');
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'text/html; charset=utf-8',
      );
      expect(res.end.mock.calls[0][0]).toContain('&amp;');
    });

    it('should send an empty body when neither is acceptable', () => {
      const res = makeRes({
        req: makeReq({ headers: { accept: 'application/json' } }),
      });
      res.redirect('/next');
      expect(res.end).toHaveBeenCalledWith('');
    });

    it('should send no body for HEAD', () => {
      const res = makeRes({ req: makeReq({ method: 'HEAD' }) });
      res.redirect('/next');
      expect(res.end).toHaveBeenCalledWith(undefined);
    });

    it('should not set Content-Length when Transfer-Encoding is present', () => {
      const res = makeRes();
      res.setHeader('Transfer-Encoding', 'chunked');
      res.redirect('/next');
      expect(res.setHeader).not.toHaveBeenCalledWith(
        'Content-Length',
        expect.anything(),
      );
    });

    it('should append Accept to an existing Vary header', () => {
      const res = makeRes();
      res.setHeader('Vary', 'Origin');
      res.redirect('/next');
      expect(res.setHeader).toHaveBeenCalledWith('Vary', 'Origin, Accept');
    });

    it('should not duplicate Accept in Vary', () => {
      const res = makeRes();
      res.setHeader('Vary', 'accept');
      res.redirect('/next');
      expect(res.getHeader('Vary')).toBe('accept');
    });

    it('should set Vary when it is empty', () => {
      const res = makeRes();
      res.setHeader('Vary', '');
      res.redirect('/next');
      expect(res.getHeader('Vary')).toBe('Accept');
    });

    it('should send the numeric status when it has no reason phrase', () => {
      const res = makeRes();
      res.redirect(799, '/next');
      expect(res.end.mock.calls[0][0]).toContain('799');
    });

    it('should keep a wildcard Vary untouched', () => {
      const res = makeRes();
      res.setHeader('Vary', '*');
      res.redirect('/next');
      expect(res.getHeader('Vary')).toBe('*');
    });

    it('should handle an array Vary header', () => {
      const res = makeRes();
      res.setHeader('Vary', ['Origin', 'Host']);
      res.redirect('/next');
      expect(res.setHeader).toHaveBeenCalledWith(
        'Vary',
        'Origin, Host, Accept',
      );
    });

    it.each([
      ['text/plain;q=0.5, text/html;q=0.9', 'text/html'],
      ['text/html;q=0, text/plain', 'text'],
      ['*/*', 'text'],
      ['text/*', 'text'],
      ['text/html, text/plain', 'text/html'],
      ['text/html;q=abc', null],
    ])('should pick the redirect body for Accept %s', (accept, expected) => {
      const res = makeRes({ req: makeReq({ headers: { accept } }) });
      res.redirect('/next');
      if (expected === 'text/html') {
        expect(res.setHeader).toHaveBeenCalledWith(
          'Content-Type',
          'text/html; charset=utf-8',
        );
      } else if (expected === 'text') {
        expect(res.setHeader).toHaveBeenCalledWith(
          'Content-Type',
          'text/plain; charset=utf-8',
        );
      } else {
        expect(res.setHeader).not.toHaveBeenCalledWith(
          'Content-Type',
          expect.anything(),
        );
      }
    });
  });

  describe('sendFile transfers', () => {
    it('should serve an absolute file with a callback', async () => {
      const { file } = tempFile('file.txt');
      const { response, body, result } = await sendFileViaServer(file);
      expect(body).toBe('hello');
      expect(response.headers.get('content-type')).toContain('text/plain');
      expect(result.err).toBeUndefined();
    });

    it('should serve an absolute file without a callback', async () => {
      const { file } = tempFile('file.txt');
      const { body } = await sendFileViaServer(
        file,
        undefined,
        undefined,
        false,
      );
      expect(body).toBe('hello');
    });

    it('should serve a file relative to root', async () => {
      const { dir } = tempFile('file.txt');
      const { body, result } = await sendFileViaServer('file.txt', {
        root: dir,
      });
      expect(body).toBe('hello');
      expect(result.err).toBeUndefined();
    });

    it('should pass options headers to the file stream', async () => {
      const { file } = tempFile('file.txt');
      const { response } = await sendFileViaServer(file, {
        headers: { 'X-Test': 'yes' },
      });
      expect(response.headers.get('x-test')).toBe('yes');
    });

    it('should report a directory as EISDIR', async () => {
      const { dir } = tempFile('file.txt');
      const { result } = await sendFileViaServer(dir);
      expect(result.err.code).toBe('EISDIR');
    });

    it('should report a missing file with its status', async () => {
      const { dir } = tempFile('file.txt');
      const { result } = await sendFileViaServer(join(dir, 'missing.txt'));
      expect(result.err.status).toBe(404);
    });

    it('should answer a missing file without a callback', async () => {
      const { dir } = tempFile('file.txt');
      const { response, body } = await sendFileViaServer(
        join(dir, 'missing.txt'),
        undefined,
        undefined,
        false,
      );
      expect(response.status).toBe(404);
      expect(response.headers.get('x-content-type-options')).toBe('nosniff');
      expect(body).toBe('Not Found');
    });

    it('should answer a directory without a callback', async () => {
      const { dir } = tempFile('file.txt');
      const { response } = await sendFileViaServer(
        dir,
        undefined,
        undefined,
        false,
      );
      expect(response.status).toBe(404);
    });

    it('should hand a file error to the route error handler', async () => {
      const { dir } = tempFile('file.txt');
      const handled: any[] = [];
      const { response, body } = await sendFileViaServer(
        join(dir, 'missing.txt'),
        undefined,
        (req, res) => {
          (req.socket as any).server[ROUTE_ERROR_HANDLER] = (
            err: any,
            _req: any,
            out: any,
          ) => {
            handled.push(err);
            out.statusCode = err.status;
            out.end('handled');
          };
        },
        false,
      );
      expect(handled).toHaveLength(1);
      expect(handled[0].status).toBe(404);
      expect(body).toBe('handled');
    });

    it('should report a transfer aborted by the client', async () => {
      const { file } = tempFile('big.txt', 'x'.repeat(4 * 1024 * 1024));
      const result: { err?: any } = {};
      const server = createServer((req, res) => {
        Object.setPrototypeOf(res, NodeResponse.prototype);
        (res as any).req = req;
        (res as any).sendFile(file, (err?: Error) => {
          result.err = err;
        });
      });
      await new Promise<void>(resolve =>
        server.listen(0, '127.0.0.1', resolve),
      );
      const { port } = server.address() as any;
      await new Promise<void>(resolve => {
        const request = get(
          { host: '127.0.0.1', port, path: '/' },
          response => {
            response.once('data', () => {
              request.destroy();
              resolve();
            });
          },
        );
        request.on('error', () => resolve());
      });
      await new Promise(resolve => setTimeout(resolve, 100));
      await new Promise<void>(resolve => server.close(() => resolve()));
      expect(['ECONNABORTED', 'EPIPE']).toContain(result.err.code);
    });

    it('should accept null options with a callback', async () => {
      const { file } = tempFile('file.txt');
      const { body, result } = await sendFileViaServer(file, null);
      expect(body).toBe('hello');
      expect(result.err).toBeUndefined();
    });
  });
});

describe('writeHead', () => {
  it('should close the connection once the server is shutting down', () => {
    const response = new NodeResponse({
      method: 'GET',
      headers: {},
    } as any);
    (response as any).socket = { server: { [SHUTTING_DOWN]: true } };
    const written: boolean[] = [];
    Object.defineProperty(response, 'shouldKeepAlive', {
      configurable: true,
      get: () => written[written.length - 1] ?? true,
      set: (value: boolean) => written.push(value),
    });
    response.writeHead(200, {});
    expect(written).toContain(false);
  });

  it('should keep the connection alive otherwise', () => {
    const response = new NodeResponse({
      method: 'GET',
      headers: {},
    } as any);
    (response as any).socket = { server: {} };
    response.writeHead(200, {});
    expect(response.shouldKeepAlive).toBe(true);
  });
});

describe('toBytes', () => {
  it('should return a Uint8Array unchanged', () => {
    const bytes = new Uint8Array([1, 2]);
    expect(toBytes(bytes)).toBe(bytes);
  });

  it('should convert another view to bytes', () => {
    const buffer = new ArrayBuffer(4);
    new Uint8Array(buffer).set([1, 2, 3, 4]);
    expect(Array.from(toBytes(new Uint16Array(buffer, 0, 1)))).toEqual([1, 2]);
  });
});

describe('endWithoutBody', () => {
  it.each([[204], [205], [304]])(
    'should end a %s response without a body',
    status => {
      const res = makeRes({ statusCode: status });
      expect(endWithoutBody(res)).toBe(true);
      expect(res.removeHeader).toHaveBeenCalledWith('Content-Type');
      expect(res.removeHeader).toHaveBeenCalledWith('Transfer-Encoding');
      expect(res.end).toHaveBeenCalled();
    },
  );

  it('should set Content-Length 0 for 205', () => {
    const res = makeRes({ statusCode: 205 });
    endWithoutBody(res);
    expect(res.setHeader).toHaveBeenCalledWith('Content-Length', '0');
  });

  it('should remove Content-Length for 204 and 304', () => {
    const res = makeRes({ statusCode: 304 });
    endWithoutBody(res);
    expect(res.removeHeader).toHaveBeenCalledWith('Content-Length');
  });

  it('should return false for another status', () => {
    const res = makeRes({ statusCode: 200 });
    expect(endWithoutBody(res)).toBe(false);
    expect(res.end).not.toHaveBeenCalled();
  });
});
