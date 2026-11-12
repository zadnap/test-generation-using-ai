import { Readable } from 'stream';
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
