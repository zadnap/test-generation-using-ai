import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import { PassThrough, Readable } from 'stream';
import { describe, expect, it, vi } from 'vitest';
import { MISSING_PLUGIN_MESSAGE } from '../../../../../packages/platform-fastify/multipart/multipart/multipart.constants.js';
import {
  drainRequest,
  processMultipart,
  processStream,
  removeFiles,
  resolveStorage,
  validateLimits,
} from '../../../../../packages/platform-fastify/multipart/multipart/multipart.parser.js';
import { memoryStorage } from '../../../../../packages/platform-fastify/multipart/storage/memory.storage.js';
import { diskStorage } from '../../../../../packages/platform-fastify/multipart/storage/disk.storage.js';

type AnyPart = Record<string, any>;

const filePart = (
  fieldname: string,
  options: {
    content?: string;
    filename?: string;
    truncated?: boolean;
    stream?: Readable;
  } = {},
): AnyPart => {
  const stream =
    options.stream ?? (Readable.from([Buffer.from(options.content ?? 'data')]) as any);
  (stream as any).truncated = !!options.truncated;
  stream.on('error', () => undefined);
  return {
    type: 'file',
    fieldname,
    filename: 'filename' in options ? options.filename : `${fieldname}.txt`,
    encoding: '7bit',
    mimetype: 'text/plain',
    file: stream,
  };
};

const fieldPart = (
  fieldname: string,
  value: unknown,
  extra: Record<string, unknown> = {},
): AnyPart => ({
  type: 'field',
  fieldname,
  value,
  encoding: '7bit',
  mimetype: 'text/plain',
  ...extra,
});

const createRequest = (
  parts: AnyPart[] | (() => AsyncIterable<AnyPart>),
  options: { multipart?: boolean; plugin?: boolean } = {},
) => {
  const raw = new PassThrough() as any;
  raw.unpipe = vi.fn();
  raw.end();
  const req: any = {};
  req.raw = raw;
  if (options.plugin !== false) {
    req.isMultipart = () => options.multipart ?? true;
  }
  req.parts = vi.fn(() =>
    typeof parts === 'function'
      ? parts()
      : (async function* () {
          for (const part of parts) yield part;
        })(),
  );
  return req;
};

const spec = (fields: any = 'ANY', strategy: any = 'VALUE') => ({
  fields,
  strategy,
});

const run = (req: any, uploadSpec = spec(), options: any = {}) =>
  processMultipart(req, uploadSpec as any, options, resolveStorage(options));

describe('resolveStorage', () => {
  it('should prefer an explicit storage engine', () => {
    const storage = memoryStorage();
    expect(resolveStorage({ storage, dest: '/tmp' } as any)).toBe(storage);
  });

  it('should use disk storage when only "dest" is set', () => {
    const storage = resolveStorage({ dest: '/tmp' } as any);
    expect(typeof storage._handleFile).toBe('function');
    expect(typeof storage._removeFile).toBe('function');
  });

  it('should use memory storage by default', () => {
    const storage = resolveStorage({} as any);
    expect(storage._handleFile).toBeTypeOf('function');
  });
});

describe('validateLimits', () => {
  it('should accept undefined and empty limits', () => {
    expect(() => validateLimits(undefined)).not.toThrow();
    expect(() => validateLimits({})).not.toThrow();
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['zero', 0],
    ['positive integer', 10],
    ['Infinity', Infinity],
  ])('should accept a %s limit', (_name, value) => {
    expect(() => validateLimits({ files: value } as any)).not.toThrow();
  });

  it.each([
    ['negative', -1],
    ['float', 1.5],
    ['NaN', NaN],
    ['negative Infinity', -Infinity],
    ['string', '1'],
    ['boolean', true],
    ['object', {}],
  ])('should reject a %s limit', (name, value) => {
    expect(() => validateLimits({ files: value } as any)).toThrow(
      new TypeError(
        `Expected limits.files to be a non-negative integer or Infinity`,
      ),
    );
    expect(name).toBeTruthy();
  });
});

describe('drainRequest', () => {
  it('should unpipe and resolve when the request already ended', async () => {
    const raw = new PassThrough() as any;
    raw.unpipe = vi.fn();
    raw.end();
    await expect(drainRequest(raw)).resolves.toBeUndefined();
    expect(raw.unpipe).toHaveBeenCalled();
  });

  it('should resolve when the request is destroyed', async () => {
    const raw = new PassThrough() as any;
    raw.unpipe = vi.fn();
    raw.destroy();
    await expect(drainRequest(raw)).resolves.toBeUndefined();
  });

  it('should wait for the end of an ongoing request', async () => {
    const raw = new PassThrough() as any;
    raw.unpipe = vi.fn();
    const promise = drainRequest(raw);
    raw.end(Buffer.from('body'));
    await expect(promise).resolves.toBeUndefined();
  });

  it('should resolve on close', async () => {
    const raw = new PassThrough() as any;
    raw.unpipe = vi.fn();
    const promise = drainRequest(raw);
    raw.destroy();
    await expect(promise).resolves.toBeUndefined();
  });

  it('should resume the request so the body is consumed', async () => {
    const raw = new PassThrough() as any;
    raw.unpipe = vi.fn();
    const resume = vi.spyOn(raw, 'resume');
    const promise = drainRequest(raw);
    raw.end();
    await promise;
    expect(resume).toHaveBeenCalled();
  });
});

describe('removeFiles', () => {
  it('should ask the storage to remove every file and resolve', async () => {
    const storage = memoryStorage();
    const remove = vi.spyOn(storage, '_removeFile');
    const files = [
      { fieldname: 'a' },
      { fieldname: 'b' },
    ] as any;
    await expect(removeFiles(storage, {} as any, files)).resolves.toBeDefined();
    expect(remove).toHaveBeenCalledTimes(2);
  });

  it('should resolve for an empty list', async () => {
    await expect(removeFiles(memoryStorage(), {} as any, [])).resolves.toEqual(
      [],
    );
  });
});

describe('processMultipart', () => {
  it('should require the @fastify/multipart plugin', async () => {
    const req = createRequest([], { plugin: false });
    await expect(run(req)).rejects.toThrow(MISSING_PLUGIN_MESSAGE);
  });

  it('should pass a non-multipart request through', async () => {
    const req = createRequest([fieldPart('a', '1')], { multipart: false });
    await expect(run(req)).resolves.toEqual([]);
    expect(req.file).toBeUndefined();
    expect(req.files).toBeUndefined();
    expect(req.body).toBeUndefined();
  });

  it('should reset req.file and req.files before parsing', async () => {
    const req = createRequest([fieldPart('a', '1')]);
    req.file = 'old';
    req.files = 'old';
    await run(req);
    expect(req.file).toBeUndefined();
    expect(req.file).not.toBe('old');
  });

  it('should append text fields and nested bracket names', async () => {
    const req = createRequest([
      fieldPart('a', '1'),
      fieldPart('b[]', '2'),
      fieldPart('b[]', '3'),
      fieldPart('c[d]', '4'),
    ]);
    await run(req, spec([]));
    expect({ ...req.body }).toEqual({
      a: '1',
      b: ['2', '3'],
      c: { d: '4' },
    });
  });

  it('should decode the file name and the field name', async () => {
    const req = createRequest([
      fieldPart('%0Akey%22', 'v'),
      filePart('f%0D', { filename: 'a%22b%0Ac.txt' }),
    ]);
    const stored = await run(req);
    expect(stored[0].originalname).toBe('a"b\nc.txt');
    expect(Object.keys(req.body)).toEqual(['\nkey"']);
  });

  it('should store files in memory and expose the first one for VALUE', async () => {
    const req = createRequest([
      filePart('file', { content: 'hello' }),
      filePart('file', { content: 'world' }),
    ]);
    const stored = await run(req, spec([{ name: 'file', maxCount: 2 }]));
    expect(stored.map(f => f.buffer!.toString())).toEqual(['hello', 'world']);
    expect(req.file.buffer.toString()).toBe('hello');
  });

  it('should expose all files as an array for ARRAY', async () => {
    const req = createRequest([filePart('a'), filePart('b')]);
    const stored = await run(req, spec('ANY', 'ARRAY'));
    expect(req.files).toHaveLength(2);
    expect(stored).toHaveLength(2);
  });

  it('should group files by field name for OBJECT', async () => {
    const req = createRequest([
      filePart('a'),
      filePart('b'),
      filePart('a'),
    ]);
    await run(req, spec('ANY', 'OBJECT'));
    expect(Object.keys(req.files)).toEqual(['a', 'b']);
    expect(req.files.a).toHaveLength(2);
    expect(req.files.b).toHaveLength(1);
  });

  it('should leave req.file and req.files unset for NONE', async () => {
    const req = createRequest([fieldPart('a', '1')]);
    await run(req, spec([], 'NONE'));
    expect(req.file).toBeUndefined();
    expect(req.files).toBeUndefined();
  });

  it('should skip a file part without a filename and resume its stream', async () => {
    const part = filePart('a', { filename: undefined });
    const resume = vi.spyOn(part.file, 'resume');
    const req = createRequest([part]);
    const stored = await run(req);
    expect(stored).toEqual([]);
    expect(resume).toHaveBeenCalled();
  });

  it('should skip a file rejected by the file filter', async () => {
    const part = filePart('a');
    const resume = vi.spyOn(part.file, 'resume');
    const req = createRequest([part]);
    const stored = await run(req, spec(), {
      fileFilter: (_req: any, _file: any, cb: any) => cb(null, false),
    });
    expect(stored).toEqual([]);
    expect(resume).toHaveBeenCalled();
  });

  it('should store a file accepted by the filter', async () => {
    const req = createRequest([filePart('a')]);
    const stored = await run(req, spec(), {
      fileFilter: (_req: any, _file: any, cb: any) => cb(null, true),
    });
    expect(stored).toHaveLength(1);
  });

  it('should reject when the file filter reports an error', async () => {
    const req = createRequest([filePart('a')]);
    await expect(
      run(req, spec(), {
        fileFilter: (_req: any, _file: any, cb: any) => cb(new Error('filter')),
      }),
    ).rejects.toThrow('filter');
  });

  it('should enforce the per-field maxCount', async () => {
    const req = createRequest([filePart('a'), filePart('a')]);
    await expect(run(req, spec([{ name: 'a', maxCount: 1 }]))).rejects.toThrow(
      'Unexpected file field',
    );
  });

  it('should treat a missing maxCount as unlimited', async () => {
    const req = createRequest([filePart('a'), filePart('a'), filePart('a')]);
    await expect(run(req, spec([{ name: 'a' }]))).resolves.toHaveLength(3);
  });

  it('should reject a file whose count already reached zero', async () => {
    const req = createRequest([filePart('a')]);
    await expect(
      run(req, spec([{ name: 'a', maxCount: 0 }])),
    ).rejects.toThrow('Unexpected file field');
  });

  it('should reject an unexpected field name for a fixed spec', async () => {
    const req = createRequest([filePart('other')]);
    await expect(run(req, spec([{ name: 'a', maxCount: 1 }]))).rejects.toThrow(
      'Unexpected file field',
    );
  });

  it('should reject a truncated file after storing it', async () => {
    const req = createRequest([filePart('a', { truncated: true })]);
    await expect(run(req)).rejects.toThrow('File too large');
  });

  describe('field validation', () => {
    it('should reject a field without a name', async () => {
      const req = createRequest([
        { type: 'field', value: 'v' } as any,
      ]);
      await expect(run(req)).rejects.toThrow('Field name missing');
    });

    it('should reject a truncated field name', async () => {
      const req = createRequest([
        fieldPart('a', 'v', { fieldnameTruncated: true }),
      ]);
      await expect(run(req)).rejects.toThrow('Field name too long');
    });

    it('should reject a truncated field value and name the field', async () => {
      const req = createRequest([
        fieldPart('a', 'v', { valueTruncated: true }),
      ]);
      await expect(run(req)).rejects.toThrow('Field value too long - a');
    });

    it('should enforce fieldNameSize when it is a number', async () => {
      const req = createRequest([fieldPart('abcd', 'v')]);
      await expect(
        run(req, spec(), { limits: { fieldNameSize: 3 } }),
      ).rejects.toThrow('Field name too long');
    });

    it('should ignore a non-numeric fieldNameSize', async () => {
      const req = createRequest([fieldPart('abcd', 'v')]);
      await expect(
        run(req, spec(), { limits: { fieldNameSize: '3' } }),
      ).resolves.toEqual([]);
    });

    it('should reject a field name nested beyond the default depth', async () => {
      const name = 'a' + '[x]'.repeat(33);
      const req = createRequest([fieldPart(name, 'v')]);
      await expect(run(req, spec([]))).rejects.toThrow(
        'Field name nesting too deep',
      );
    });

    it('should accept a field name at the default depth', async () => {
      const name = 'a' + '[x]'.repeat(32);
      const req = createRequest([fieldPart(name, 'v')]);
      await expect(run(req, spec([]))).resolves.toEqual([]);
    });

    it('should honour a custom nesting depth', async () => {
      const req = createRequest([fieldPart('a[b][c]', 'v')]);
      await expect(
        run(req, spec(), { limits: { fieldNestingDepth: 1 } }),
      ).rejects.toThrow('Field name nesting too deep');
    });

    it('should reject an array index above the default limit', async () => {
      const req = createRequest([fieldPart('a[1001]', 'v')]);
      await expect(run(req, spec())).rejects.toThrow(
        'Field name array index too large',
      );
    });

    it('should accept an array index at the default limit', async () => {
      const req = createRequest([fieldPart('a[1000]', 'v')]);
      await expect(run(req, spec())).resolves.toEqual([]);
    });

    it('should honour a custom array index limit', async () => {
      const req = createRequest([fieldPart('a[3]', 'v')]);
      await expect(
        run(req, spec(), { limits: { fieldArrayIndexLimit: 2 } }),
      ).rejects.toThrow('Field name array index too large');
    });

    it('should skip the array index check for Infinity', async () => {
      const req = createRequest([fieldPart('a[999999]', 'v')]);
      await expect(
        run(req, spec(), { limits: { fieldArrayIndexLimit: Infinity } }),
      ).resolves.toEqual([]);
    });

    it('should not enforce the index limit on a name appendField keeps literal', async () => {
      const req = createRequest([fieldPart('a[1001]suffix', 'v')]);
      await expect(run(req, spec())).resolves.toEqual([]);
    });

    it('should not enforce the index limit on a leading bracket name', async () => {
      const req = createRequest([fieldPart('[1001]', 'v')]);
      await expect(run(req, spec())).resolves.toEqual([]);
    });

    it('should reject a prototype-polluting field name', async () => {
      const req = createRequest([fieldPart('__proto__', 'v')]);
      await expect(run(req, spec())).rejects.toThrow('Invalid field name');
    });
  });

  it('should use the limits function and pass its result to parts()', async () => {
    const req = createRequest([fieldPart('a', 'v')]);
    const limits = vi.fn(() => ({ files: 1, fileSize: undefined, parts: null }));
    await run(req, spec(), { limits, preservePath: false, defParamCharset: 'utf8' });
    expect(limits).toHaveBeenCalledWith(req);
    expect(req.parts).toHaveBeenCalledWith({
      throwFileSizeLimit: false,
      limits: { files: 1 },
      preservePath: false,
      defParamCharset: 'utf8',
    });
  });

  it('should validate the limits returned by the function', async () => {
    const req = createRequest([]);
    await expect(
      run(req, spec(), { limits: () => ({ files: -1 }) }),
    ).rejects.toThrow('Expected limits.files');
  });

  it('should leave out limits that are null or undefined', async () => {
    const req = createRequest([]);
    await run(req, spec(), { limits: { files: undefined, parts: null } });
    expect(req.parts).toHaveBeenCalledWith({
      throwFileSizeLimit: false,
      limits: {},
    });
  });

  it('should omit the body config when there are no limits', async () => {
    const req = createRequest([]);
    await run(req, spec());
    expect(req.parts).toHaveBeenCalledWith({ throwFileSizeLimit: false });
  });

  it('should transform a fastify limit error from the parts iterator', async () => {
    const req = createRequest(async function* () {
      yield fieldPart('a', 'v');
      throw Object.assign(new Error('limit'), { code: 'FST_FILES_LIMIT' });
    });
    await expect(run(req)).rejects.toThrow('Too many files');
  });

  it('should pass through an unknown error from the parts iterator', async () => {
    const req = createRequest(async function* () {
      yield fieldPart('a', 'v');
      throw new Error('unknown');
    });
    await expect(run(req)).rejects.toThrow('unknown');
  });

  it('should stop reading at the first failing part', async () => {
    const second = vi.fn();
    const req = createRequest(async function* () {
      yield fieldPart('__proto__', 'v');
      second();
      yield fieldPart('b', 'v');
    });
    await expect(run(req, spec([]))).rejects.toThrow('Invalid field name');
    expect(second).not.toHaveBeenCalled();
  });

  describe('aborted uploads', () => {
    const abortError = Object.assign(new Error('aborted'), {
      code: 'FST_MP_PREMATURE_CLOSE',
    });

    it('should report an unexpected end of file when the stream was already destroyed', async () => {
      const stream = new Readable({ read() {} });
      stream.destroy();
      const req = createRequest([filePart('a', { stream })]);
      await expect(run(req)).rejects.toThrow(
        'Multipart: Unexpected end of file',
      );
    });

    it('should reject with the reason the iterator reports', async () => {
      const stream = new Readable({ read() {} });
      stream.push('x');
      const part = filePart('a', { stream });
      const req = createRequest(async function* () {
        yield part;
        if (!stream.destroyed) {
          await new Promise(resolve => stream.once('close', resolve));
        }
        throw abortError;
      });
      setImmediate(() => stream.destroy());
      await expect(run(req)).rejects.toThrow('aborted');
    });

    it('should abort when the stream and the iterator report the same error', async () => {
      const error = Object.assign(new Error('premature close'), {
        code: 'FST_MP_PREMATURE_CLOSE',
      });
      const stream = new Readable({ read() {} });
      stream.push('x');
      const part = filePart('a', { stream });
      const storage: any = {
        _removeFile: vi.fn((_req: any, _file: any, callback: any) => callback()),
        _handleFile: vi.fn(),
      };
      const req = createRequest(async function* () {
        yield part;
        if (!stream.destroyed) {
          await new Promise(resolve => stream.once('close', resolve));
        }
        throw error;
      });
      setImmediate(() => stream.destroy(error));
      await expect(
        processMultipart(req, spec() as any, {}, storage),
      ).rejects.toThrow('premature close');
      expect(storage._handleFile).toHaveBeenCalled();
    });

    it('should ignore an abort that arrives after the engine already called back', async () => {
      const error = Object.assign(new Error('premature close'), {
        code: 'FST_MP_PREMATURE_CLOSE',
      });
      let releaseGate!: () => void;
      const gate = new Promise<void>(resolve => {
        releaseGate = resolve;
      });
      const stream = new Readable({ read() {} });
      stream.push('x');
      const part = filePart('a', { stream });
      const storage: any = {
        _removeFile: vi.fn((_req: any, _file: any, callback: any) => callback()),
        _handleFile: vi.fn((_req: any, _file: any, callback: any) => {
          stream.once('close', () => {
            callback(null, { size: 1 });
            // The read-ahead settles only after the engine called back.
            releaseGate();
          });
        }),
      };
      const req = createRequest(async function* () {
        yield part;
        await gate;
        throw error;
      });
      setImmediate(() => stream.destroy(error));
      await expect(
        processMultipart(req, spec() as any, {}, storage),
      ).rejects.toThrow('premature close');
      expect(storage._handleFile).toHaveBeenCalled();
    });

    it('should not abort when reading ahead succeeds', async () => {
      const error = new Error('stream reason');
      const stream = new Readable({ read() {} });
      stream.push('x');
      const part = filePart('a', { stream });
      const storage: any = {
        _removeFile: vi.fn((_req: any, _file: any, callback: any) => callback()),
        _handleFile: vi.fn((_req: any, _file: any, callback: any) => {
          setTimeout(() => callback(new Error('engine error')), 10);
        }),
      };
      const req = createRequest(async function* () {
        yield part;
        if (!stream.destroyed) {
          await new Promise(resolve => stream.once('close', resolve));
        }
      });
      setImmediate(() => stream.destroy(error));
      await expect(
        processMultipart(req, spec() as any, {}, storage),
      ).rejects.toThrow('engine error');
    });

    it('should ignore a late engine error after an abort without a path', async () => {
      const stream = new Readable({ read() {} });
      stream.push('x');
      const part = filePart('a', { stream });
      const remove = vi.fn((_req: any, _file: any, callback: any) => callback());
      const storage: any = {
        _removeFile: remove,
        _handleFile: vi.fn((_req: any, _file: any, callback: any) => {
          stream.once('close', () => {
            setTimeout(() => callback(new Error('late engine error')), 5);
          });
        }),
      };
      const req = createRequest(async function* () {
        yield part;
        if (!stream.destroyed) {
          await new Promise(resolve => stream.once('close', resolve));
        }
      });
      setImmediate(() => stream.destroy());
      await expect(
        processMultipart(req, spec() as any, {}, storage),
      ).rejects.toThrow('Multipart: Unexpected end of file');
      await new Promise(resolve => setTimeout(resolve, 20));
      expect(remove).not.toHaveBeenCalled();
    });

    it('should swallow a failure to remove a partial file after an abort', async () => {
      const stream = new Readable({ read() {} });
      stream.push('x');
      const part = filePart('a', { stream });
      const storage: any = {
        _removeFile: vi.fn(() => {
          throw new Error('remove failed');
        }),
        _handleFile: vi.fn((_req: any, file: any) => {
          file.path = '/tmp/partial';
        }),
      };
      const req = createRequest(async function* () {
        yield part;
        if (!stream.destroyed) {
          await new Promise(resolve => stream.once('close', resolve));
        }
      });
      setImmediate(() => stream.destroy());
      await expect(
        processMultipart(req, spec() as any, {}, storage),
      ).rejects.toThrow('Multipart: Unexpected end of file');
      expect(storage._removeFile).toHaveBeenCalled();
    });

    it('should swallow a removal failure after an aborted engine callback', async () => {
      const stream = new Readable({ read() {} });
      stream.push('x');
      const part = filePart('a', { stream });
      const storage: any = {
        _removeFile: vi.fn(() => {
          throw new Error('remove failed');
        }),
        _handleFile: vi.fn((_req: any, _file: any, callback: any) => {
          setTimeout(() => callback(null, { path: '/tmp/late', size: 1 }), 5);
        }),
      };
      const req = createRequest(async function* () {
        yield part;
        if (!stream.destroyed) {
          await new Promise(resolve => stream.once('close', resolve));
        }
      });
      setImmediate(() => stream.destroy());
      await expect(
        processMultipart(req, spec() as any, {}, storage),
      ).rejects.toThrow('Multipart: Unexpected end of file');
      await new Promise(resolve => setTimeout(resolve, 20));
      expect(storage._removeFile).toHaveBeenCalled();
    });

    it('should remove a partially stored file when the stream is destroyed', async () => {
      const stream = new Readable({ read() {} });
      stream.push('x');
      const remove = vi.fn((_req: any, _file: any, callback: any) => callback());
      const storage = {
        _handleFile: vi.fn((_req: any, file: any, _callback: any) => {
          file.path = '/tmp/partial';
        }),
        _removeFile: remove,
      };
      const part = filePart('a', { stream });
      (part as any).path = '/tmp/partial';
      const req = createRequest(async function* () {
        yield part;
        if (!stream.destroyed) {
          await new Promise(resolve => stream.once('close', resolve));
        }
      });
      setImmediate(() => stream.destroy());
      await expect(
        processMultipart(req, spec() as any, {}, storage as any),
      ).rejects.toThrow('Multipart: Unexpected end of file');
      expect(remove).toHaveBeenCalled();
    });

    it('should not abort when the iterator fails with another error', async () => {
      const stream = new Readable({ read() {} });
      stream.push('x');
      const destroyReason = new Error('stream reason');
      const iteratorError = new Error('iterator reason');
      const part = filePart('a', { stream });
      const storage: any = {
        _removeFile: vi.fn((_req: any, _file: any, callback: any) => callback()),
        _handleFile: vi.fn((_req: any, _file: any, callback: any) => {
          setTimeout(() => callback(new Error('engine error')), 10);
        }),
      };
      const req = createRequest(async function* () {
        yield part;
        if (!stream.destroyed) {
          await new Promise(resolve => stream.once('close', resolve));
        }
        throw iteratorError;
      });
      setImmediate(() => stream.destroy(destroyReason));
      await expect(
        processMultipart(req, spec() as any, {}, storage),
      ).rejects.toThrow('engine error');
    });

    it('should resolve an empty info object when the engine calls back without one', async () => {
      const storage: any = {
        _removeFile: vi.fn(),
        _handleFile: vi.fn((_req: any, _file: any, callback: any) =>
          callback(null, undefined),
        ),
      };
      const req = createRequest([filePart('a')]);
      const stored = await processMultipart(req, spec() as any, {}, storage);
      expect(stored).toHaveLength(1);
    });

    it('should remove what the engine stored after an abort', async () => {
      const stream = new Readable({ read() {} });
      stream.push('x');
      const remove = vi.fn((_req: any, file: any, callback: any) => callback());
      const part = filePart('a', { stream });
      const storage: any = {
        _removeFile: remove,
        _handleFile: vi.fn((_req: any, _file: any, callback: any) => {
          setTimeout(() => callback(null, { path: '/tmp/late', size: 1 }), 5);
        }),
      };
      const req = createRequest(async function* () {
        yield part;
        if (!stream.destroyed) {
          await new Promise(resolve => stream.once('close', resolve));
        }
      });
      setImmediate(() => stream.destroy());
      await expect(
        processMultipart(req, spec() as any, {}, storage),
      ).rejects.toThrow('Multipart: Unexpected end of file');
      await new Promise(resolve => setTimeout(resolve, 20));
      expect(remove).toHaveBeenCalledWith(
        req,
        expect.objectContaining({ path: '/tmp/late' }),
        expect.any(Function),
      );
    });
  });

  it('should discard the body after a parse failure', async () => {
    const req = createRequest(async function* () {
      yield fieldPart('__proto__', 'v');
    });
    const drain = vi.spyOn(req.raw, 'resume');
    await expect(run(req, spec([]))).rejects.toThrow();
    expect(drain).toHaveBeenCalled();
  });

  it('should use disk storage when configured with a dest', async () => {
    const req = createRequest([filePart('a', { content: 'x' })]);
    const stored = await run(req, spec(), {
      dest: 'node_modules/.cache/nest-ai-multipart',
    });
    expect(stored[0].path).toBeDefined();
    expect(stored[0].size).toBe(1);
    await removeFiles(
      diskStorage({ destination: 'node_modules/.cache/nest-ai-multipart' }),
      req,
      stored,
    );
  });
});

describe('processStream', () => {
  it('should require the plugin', async () => {
    const req = createRequest([], { plugin: false });
    await expect(processStream(req, 'file', {} as any)).rejects.toThrow(
      MISSING_PLUGIN_MESSAGE,
    );
  });

  it('should pass a non-multipart request through', async () => {
    const req = createRequest([], { multipart: false });
    await expect(processStream(req, 'file', {} as any)).resolves.toBeUndefined();
    expect(req.file).toBeUndefined();
  });

  it('should parse leading text fields and hand over the matching file stream', async () => {
    const part = filePart('file', { content: 'streamed' });
    const req = createRequest([fieldPart('a', '1'), part]);
    await processStream(req, 'file', {} as any);
    expect(req.body.a).toBe('1');
    expect(req.file.stream).toBe(part.file);
    expect(req.file.fieldname).toBe('file');
  });

  it('should skip a file without a filename', async () => {
    const part = filePart('file', { filename: undefined });
    const resume = vi.spyOn(part.file, 'resume');
    const req = createRequest([part, filePart('file', { content: 'x' })]);
    await processStream(req, 'file', {} as any);
    expect(resume).toHaveBeenCalled();
    expect(req.file.stream).toBeDefined();
  });

  it('should reject a file in another field', async () => {
    const req = createRequest([filePart('other')]);
    await expect(processStream(req, 'file', {} as any)).rejects.toThrow(
      'Unexpected file field',
    );
  });

  it('should skip a file rejected by the filter', async () => {
    const part = filePart('file');
    const resume = vi.spyOn(part.file, 'resume');
    const req = createRequest([part, filePart('file', { content: 'second' })]);
    let calls = 0;
    await processStream(req, 'file', {
      fileFilter: (_req: any, _file: any, cb: any) =>
        cb(null, ++calls > 1),
    } as any);
    expect(resume).toHaveBeenCalled();
    expect(req.file).toBeDefined();
  });

  it('should destroy an already truncated stream with a payload-too-large error', async () => {
    const part = filePart('file', { truncated: true });
    const destroy = vi.spyOn(part.file, 'destroy');
    const req = createRequest([part]);
    await processStream(req, 'file', {} as any);
    expect(destroy).toHaveBeenCalledWith(expect.any(PayloadTooLargeException));
    expect(req.file.stream).toBe(part.file);
  });

  it('should destroy the stream when the limit event fires', async () => {
    const part = filePart('file');
    const req = createRequest([part]);
    await processStream(req, 'file', {} as any);
    part.file.emit('limit');
    expect(part.file.destroyed).toBe(true);
  });

  it('should drain the request on a parse failure', async () => {
    const req = createRequest([filePart('other')]);
    const drain = vi.spyOn(req.raw, 'resume');
    await expect(processStream(req, 'file', {} as any)).rejects.toThrow();
    expect(drain).toHaveBeenCalled();
  });

  it('should transform a fastify error', async () => {
    const req = createRequest(async function* () {
      yield fieldPart('a', '1');
      throw Object.assign(new Error('x'), { code: 'FST_PARTS_LIMIT' });
    });
    await expect(processStream(req, 'file', {} as any)).rejects.toThrow(
      'Too many parts',
    );
  });

  it('should not parse parts after the matching file', async () => {
    const after = vi.fn();
    const req = createRequest(async function* () {
      yield filePart('file');
      after();
      yield fieldPart('late', 'x');
    });
    await processStream(req, 'file', {} as any);
    expect(after).not.toHaveBeenCalled();
  });
});
