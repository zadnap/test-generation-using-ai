import { Readable } from 'stream';
import {
  brotliCompressSync,
  deflateSync,
  gzipSync,
} from 'zlib';
import { describe, expect, it, vi } from 'vitest';
import {
  json,
  raw,
  text,
  urlencoded,
} from '../../../../packages/platform-node/body-parser/body-parser.js';

interface RunOptions {
  body?: string | Buffer;
  contentType?: string;
  headers?: Record<string, string>;
  complete?: boolean;
  bodyAlreadySet?: boolean;
}

async function run(
  parser: any,
  {
    body = '',
    contentType,
    headers = {},
    complete = true,
    bodyAlreadySet = false,
  }: RunOptions = {},
) {
  const buffer = Buffer.isBuffer(body) ? body : Buffer.from(body);
  const req: any = Readable.from(buffer.length ? [buffer] : []);
  req.headers = {
    ...(contentType ? { 'content-type': contentType } : {}),
    'content-length': String(buffer.length),
    ...headers,
  };
  req.complete = complete;
  if (bodyAlreadySet) {
    req.body = { existing: true };
  }
  const res: any = {};
  return new Promise<{ error: any; req: any }>(resolve => {
    parser(req, res, (error: any) => resolve({ error, req }));
  });
}

const JSON_HEADERS = 'application/json';
const FORM_HEADERS = 'application/x-www-form-urlencoded';

// CFG (C3) of body-parser:
//   json: empty body T/F; strict && first char invalid T/F; valid JSON T/F;
//         reviver T/F; poisoning actions
//   urlencoded: extended T/F; parameterLimit exceeded T/F; parse error T/F;
//               RangeError T/F; default charset invalid T/F
//   createReader: no body / readableEnded / destroyed / body set / type mismatch
//                 (all skip); invalid charset T/F; content-length > limit T/F;
//                 received > limit T/F; length mismatch T/F; verify throws T/F;
//                 parse throws T/F; gzip/deflate/br/unsupported encoding
describe('body-parser', () => {
  describe('json', () => {
    it('should parse a JSON object', async () => {
      const { error, req } = await run(json(), {
        body: '{"a":1}',
        contentType: JSON_HEADERS,
      });
      expect(error).toBeUndefined();
      expect(req.body).toEqual({ a: 1 });
    });

    it('should return {} for an empty body', async () => {
      const { error, req } = await run(json(), { contentType: JSON_HEADERS });
      expect(error).toBeUndefined();
      expect(req.body).toEqual({});
    });

    it('should reject invalid JSON with a 400 SyntaxError', async () => {
      const { error, req } = await run(json(), {
        body: '{"a":',
        contentType: JSON_HEADERS,
      });
      expect(error).toBeInstanceOf(SyntaxError);
      expect(error).toMatchObject({ status: 400, type: 'entity.parse.failed' });
      expect(req.body).toBeUndefined();
    });

    it('should reject a top-level primitive in strict mode', async () => {
      const { error } = await run(json(), {
        body: '123',
        contentType: JSON_HEADERS,
      });
      expect(error).toMatchObject({ status: 400, type: 'entity.parse.failed' });
    });

    it('should accept a primitive when not strict', async () => {
      const { error, req } = await run(json({ strict: false }), {
        body: '123',
        contentType: JSON_HEADERS,
      });
      expect(error).toBeUndefined();
      expect(req.body).toBe(123);
    });

    it('should report an empty strict body as unexpected end', async () => {
      const { error } = await run(json(), {
        body: '   ',
        contentType: JSON_HEADERS,
      });
      expect(error.message).toContain('Unexpected end of JSON input');
    });

    it('should use the reviver option', async () => {
      const { req } = await run(json({ reviver: (_k, v) => (typeof v === 'number' ? v + 1 : v) }), {
        body: '{"a":1}',
        contentType: JSON_HEADERS,
      });
      expect(req.body).toEqual({ a: 2 });
    });

    it('should skip a request without a body', async () => {
      const { error, req } = await run(json(), {
        contentType: JSON_HEADERS,
        headers: { 'content-length': undefined as any },
      });
      expect(error).toBeUndefined();
      expect(req.body).toBeUndefined();
    });

    it('should skip another content type', async () => {
      const { error, req } = await run(json(), {
        body: 'x',
        contentType: 'text/plain',
      });
      expect(error).toBeUndefined();
      expect(req.body).toBeUndefined();
    });

    it('should skip when the body was already parsed', async () => {
      const { error, req } = await run(json(), {
        body: '{"a":1}',
        contentType: JSON_HEADERS,
        bodyAlreadySet: true,
      });
      expect(error).toBeUndefined();
      expect(req.body).toEqual({ existing: true });
    });

    it('should skip an ended request', async () => {
      const parser = json();
      const req: any = Readable.from([]);
      req.headers = {
        'content-type': JSON_HEADERS,
        'content-length': '0',
      };
      Object.defineProperty(req, 'readableEnded', { value: true });
      const next = vi.fn();
      parser(req, {} as any, next);
      expect(next).toHaveBeenCalledWith();
    });

    it('should reject an unsupported charset', async () => {
      const { error } = await run(json(), {
        body: '{}',
        contentType: `${JSON_HEADERS}; charset=latin1`,
      });
      expect(error).toMatchObject({ status: 415, type: 'charset.unsupported' });
    });

    it('should reject a body over the content-length limit', async () => {
      const { error } = await run(json({ limit: 2 }), {
        body: '{"a":1}',
        contentType: JSON_HEADERS,
      });
      expect(error).toMatchObject({ status: 413, type: 'entity.too.large' });
    });

    it('should reject a streamed body over the limit', async () => {
      const { error } = await run(json({ limit: 2 }), {
        body: '{"a":1}',
        contentType: JSON_HEADERS,
        headers: { 'content-length': undefined as any, 'transfer-encoding': 'chunked' },
      });
      expect(error).toMatchObject({ status: 413, type: 'entity.too.large' });
    });

    it('should report a content-length mismatch', async () => {
      const { error } = await run(json(), {
        body: '{}',
        contentType: JSON_HEADERS,
        headers: { 'content-length': '10' },
      });
      expect(error).toMatchObject({ status: 400, type: 'request.size.invalid' });
    });

    it('should run the verify option and wrap its error', async () => {
      const verifyError = new Error('nope');
      const { error } = await run(
        json({
          verify: () => {
            throw verifyError;
          },
        }),
        { body: '{}', contentType: JSON_HEADERS },
      );
      expect(error).toMatchObject({
        status: 403,
        type: 'entity.verify.failed',
        message: 'nope',
      });
    });

    it('should support the type option as a function', async () => {
      const { req } = await run(json({ type: () => true }), {
        body: '{}',
        contentType: 'text/plain',
      });
      expect(req.body).toEqual({});
    });

    it('should validate the limit option', () => {
      expect(() => json({ limit: -1 })).toThrow(TypeError);
      expect(() => json({ limit: 'nope' })).toThrow(TypeError);
      expect(() => json({ limit: NaN })).toThrow(TypeError);
    });

    it('should accept a limit with a unit', async () => {
      const { error } = await run(json({ limit: '1kb' }), {
        body: '{}',
        contentType: JSON_HEADERS,
      });
      expect(error).toBeUndefined();
    });

    it('should reject an unsupported content encoding without inflate', async () => {
      const { error } = await run(json({ inflate: false }), {
        body: '{}',
        contentType: JSON_HEADERS,
        headers: { 'content-encoding': 'gzip' },
      });
      expect(error).toMatchObject({ status: 415, type: 'encoding.unsupported' });
    });

    it('should reject an unknown content encoding', async () => {
      const { error } = await run(json(), {
        body: '{}',
        contentType: JSON_HEADERS,
        headers: { 'content-encoding': 'zstd' },
      });
      expect(error).toMatchObject({ status: 415, type: 'encoding.unsupported' });
    });
  });

  describe('urlencoded', () => {
    it('should parse a form body', async () => {
      const { req } = await run(urlencoded(), {
        body: 'a=1&b=2',
        contentType: FORM_HEADERS,
      });
      expect(req.body).toEqual({ a: '1', b: '2' });
    });

    it('should parse nested objects when extended', async () => {
      const { req } = await run(urlencoded({ extended: true }), {
        body: 'a[b]=1&a[c]=2',
        contentType: FORM_HEADERS,
      });
      expect(req.body).toEqual({ a: { b: '1', c: '2' } });
    });

    it('should reject too many parameters', async () => {
      const { error } = await run(urlencoded({ parameterLimit: 1 }), {
        body: 'a=1&b=2',
        contentType: FORM_HEADERS,
      });
      expect(error).toMatchObject({ status: 413, type: 'parameters.too.many' });
    });

    it('should reject too much depth', async () => {
      const { error } = await run(urlencoded({ extended: true, depth: 1 }), {
        body: 'a[b][c]=1',
        contentType: FORM_HEADERS,
      });
      expect(error).toMatchObject({ status: 400 });
    });

    it('should reject a forbidden prototype key', async () => {
      const { error } = await run(
        urlencoded({
          extended: true,
          protoPoisoning: 'error',
        }),
        { body: 'a[__proto__][x]=1', contentType: FORM_HEADERS },
      );
      expect(error).toMatchObject({ status: 400 });
    });

    it('should validate its options', () => {
      expect(() => urlencoded({ parameterLimit: 0 })).toThrow(TypeError);
      expect(() => urlencoded({ parameterLimit: NaN })).toThrow(TypeError);
      expect(() => urlencoded({ extended: true, depth: -1 })).toThrow(TypeError);
      expect(() => urlencoded({ extended: true, depth: NaN })).toThrow(TypeError);
      expect(() =>
        urlencoded({ defaultCharset: 'latin1' as any }),
      ).toThrow(TypeError);
    });
  });

  describe('additional JSON and reader branches', () => {
    it('should validate non-string, non-number limit values', () => {
      expect(() => json({ limit: {} as any })).toThrow(TypeError);
      expect(() => json({ limit: '1' })).not.toThrow();
      expect(() => json({ limit: '1mb' })).not.toThrow();
    });

    it('should skip a body whose request has no content type', async () => {
      const { error, req } = await run(json(), {
        body: '{"a":1}',
        headers: { 'content-type': undefined as any },
      });
      expect(error).toBeUndefined();
      expect(req.body).toBeUndefined();
    });

    it('should reuse a cached charset for the same header', async () => {
      const parser = text();
      const contentType = 'text/plain; charset=utf-8';
      await run(parser, { body: 'a', contentType });
      const { req } = await run(parser, { body: 'b', contentType });
      expect(req.body).toBe('b');
    });

    it('should strip a UTF-8 byte order mark', async () => {
      const body = Buffer.concat([
        Buffer.from([0xef, 0xbb, 0xbf]),
        Buffer.from('{"a":1}'),
      ]);
      const { req } = await run(json(), {
        body,
        contentType: JSON_HEADERS,
      });
      expect(req.body).toEqual({ a: 1 });
    });

    it.each([
      ['gzip', gzipSync(Buffer.from('{"a":1}'))],
      ['x-gzip', gzipSync(Buffer.from('{"a":1}'))],
      ['deflate', deflateSync(Buffer.from('{"a":1}'))],
      ['br', brotliCompressSync(Buffer.from('{"a":1}'))],
    ])('should inflate a %s body', async (encoding, body) => {
      const { error, req } = await run(json(), {
        body,
        contentType: JSON_HEADERS,
        headers: { 'content-encoding': encoding },
      });
      expect(error).toBeUndefined();
      expect(req.body).toEqual({ a: 1 });
    });

    it('should report a decompression stream error', async () => {
      const { error } = await run(json(), {
        body: Buffer.from('not-gzip'),
        contentType: JSON_HEADERS,
        headers: { 'content-encoding': 'gzip' },
      });
      expect(error).toMatchObject({ status: 400, type: 'stream.error' });
    });

    it('should wrap a non-Error verify failure', async () => {
      const { error } = await run(
        json({
          verify: () => {
            throw 'nope';
          },
        }),
        { body: '{}', contentType: JSON_HEADERS },
      );
      expect(error).toMatchObject({
        status: 403,
        type: 'entity.verify.failed',
        message: 'nope',
      });
    });

    it('should wrap an undefined verify failure', async () => {
      const { error } = await run(
        json({
          verify: () => {
            throw undefined;
          },
        }),
        { body: '{}', contentType: JSON_HEADERS },
      );
      expect(error).toMatchObject({
        status: 403,
        message: 'verify failed',
      });
    });

    it('should force a 403 for an invalid verify status', async () => {
      const { error } = await run(
        json({
          verify: () => {
            throw Object.assign(new Error('bad'), { status: 200 });
          },
        }),
        { body: '{}', contentType: JSON_HEADERS },
      );
      expect(error).toMatchObject({ status: 403 });
    });

    it('should report an aborted request on stream error', async () => {
      const parser = json();
      const req: any = new Readable({ read() {} });
      req.headers = {
        'content-type': JSON_HEADERS,
        'content-length': '10',
      };
      req.complete = false;
      req.destroyed = false;
      const error = await new Promise<any>(resolve => {
        parser(req, {}, resolve);
        req.destroyed = true;
        req.emit('error', new Error('socket'));
      });
      expect(error).toMatchObject({ status: 400, type: 'request.aborted' });
    });

    it('should report a request aborted on close', async () => {
      const parser = json();
      const req: any = new Readable({ read() {} });
      req.headers = {
        'content-type': JSON_HEADERS,
        'content-length': '10',
      };
      req.complete = false;
      req.destroyed = false;
      const error = await new Promise<any>(resolve => {
        parser(req, {}, resolve);
        req.destroyed = true;
        req.emit('close');
      });
      expect(error).toMatchObject({ status: 400, type: 'request.aborted' });
    });

    it('should ignore a close event after the body completed', async () => {
      const parser = json();
      const req: any = Readable.from([Buffer.from('{}')]);
      req.headers = {
        'content-type': JSON_HEADERS,
        'content-length': '2',
      };
      req.complete = true;
      const next = vi.fn();
      parser(req, {}, next);
      await new Promise(resolve => setImmediate(resolve));
      req.emit('close');
      expect(next).toHaveBeenCalledTimes(1);
    });
  });

  describe('additional decoding branches', () => {
    it.each([
      ['us-ascii', 'abc'],
      ['ascii', 'abc'],
      ['latin1', '\u00e9'],
      ['iso-8859-1', '\u00e9'],
    ])('should decode a %s text body', async (charset, value) => {
      const body = Buffer.from(value, 'latin1');
      const { req } = await run(text(), {
        body,
        contentType: `text/plain; charset=${charset}`,
      });
      expect(req.body).toBe(value);
    });

    it('should decode utf-16le with a byte order mark', async () => {
      const body = Buffer.from([0xff, 0xfe, 0x61, 0x00]);
      const { req } = await run(text(), {
        body,
        contentType: 'text/plain; charset=utf-16',
      });
      expect(req.body).toBe('a');
    });

    it('should decode utf-16be with a byte order mark', async () => {
      const body = Buffer.from([0xfe, 0xff, 0x00, 0x61]);
      const { req } = await run(text(), {
        body,
        contentType: 'text/plain; charset=utf-16',
      });
      expect(req.body).toBe('a');
    });

    it('should detect little-endian utf-16 without a byte order mark', async () => {
      const body = Buffer.from([0x61, 0x00, 0x62, 0x00]);
      const { req } = await run(text(), {
        body,
        contentType: 'text/plain; charset=utf16',
      });
      expect(req.body).toBe('ab');
    });

    it('should detect big-endian utf-16 without a byte order mark', async () => {
      const body = Buffer.from([0x00, 0x61, 0x00, 0x62]);
      const { req } = await run(text(), {
        body,
        contentType: 'text/plain; charset=utf-16',
      });
      expect(req.body).toBe('ab');
    });

    it('should decode a short utf-16 body', async () => {
      const { error } = await run(text(), {
        body: Buffer.from([0x61]),
        contentType: 'text/plain; charset=utf-16',
      });
      expect(error).toBeUndefined();
    });

    it('should decode windows-1252 high characters', async () => {
      const { req } = await run(text(), {
        body: Buffer.from([0x80]),
        contentType: 'text/plain; charset=windows-1252',
      });
      expect(req.body).toBe('\u20ac');
    });

    it('should decode another charset through TextDecoder', async () => {
      const { req } = await run(text(), {
        body: Buffer.from([0x61, 0x00]),
        contentType: 'text/plain; charset=utf-16le',
      });
      expect(req.body).toBe('a');
    });
  });

  describe('additional urlencoded branches', () => {
    it('should skip poisoning scans when both actions ignore', async () => {
      const { error, req } = await run(
        urlencoded({
          extended: true,
          onProtoPoisoning: 'ignore',
          onConstructorPoisoning: 'ignore',
        }),
        {
          body: 'constructor[prototype][x]=1',
          contentType: FORM_HEADERS,
        },
      );
      expect(error).toBeUndefined();
      expect(req.body).toEqual({ constructor: { prototype: { x: '1' } } });
    });

    it('should accept an infinite parameter limit', async () => {
      const { error } = await run(urlencoded({ parameterLimit: Infinity }), {
        body: 'a=1&b=2',
        contentType: FORM_HEADERS,
      });
      expect(error).toBeUndefined();
    });

    it('should accept an infinite depth', async () => {
      const { error } = await run(
        urlencoded({ extended: true, depth: Infinity }),
        { body: 'a[b]=1', contentType: FORM_HEADERS },
      );
      expect(error).toBeUndefined();
    });

    it('should decode encoded keys and values', async () => {
      const { req } = await run(urlencoded(), {
        body: 'a+b=c%20d',
        contentType: FORM_HEADERS,
      });
      expect(req.body).toEqual({ 'a b': 'c d' });
    });

    it('should use iso-8859-1 as the default charset', async () => {
      const { req } = await run(
        urlencoded({ defaultCharset: 'iso-8859-1' }),
        {
          body: Buffer.from('a=%E9', 'latin1'),
          contentType: FORM_HEADERS,
        },
      );
      expect(req.body).toEqual({ a: '\u00e9' });
    });

    it('should reject an unsupported charset', async () => {
      const { error } = await run(urlencoded(), {
        body: 'a=1',
        contentType: `${FORM_HEADERS}; charset=latin1`,
      });
      expect(error).toMatchObject({ status: 415, type: 'charset.unsupported' });
    });

  });

  describe('text and raw', () => {
    it('should parse a text body', async () => {
      const { req } = await run(text(), {
        body: 'hello',
        contentType: 'text/plain',
      });
      expect(req.body).toBe('hello');
    });

    it('should honor the text defaultCharset', async () => {
      const { req } = await run(text({ defaultCharset: 'iso-8859-1' }), {
        body: 'hello',
        contentType: 'text/plain',
      });
      expect(req.body).toBe('hello');
    });

    it('should parse a raw body as a Buffer', async () => {
      const body = Buffer.from([1, 2, 3]);
      const { req } = await run(raw(), {
        body,
        contentType: 'application/octet-stream',
      });
      expect(Buffer.isBuffer(req.body)).toBe(true);
      expect([...req.body]).toEqual([1, 2, 3]);
    });

    it('should match a wildcard type', async () => {
      const { req } = await run(text({ type: 'text/*' }), {
        body: 'hello',
        contentType: 'text/html',
      });
      expect(req.body).toBe('hello');
    });
  });
});
