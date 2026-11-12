import { StreamableFile } from '@nestjs/common';
import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host.js';
import { PassThrough, Readable } from 'stream';
import { lastValueFrom, of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import {
  createMultipartInterceptor,
  createMultipartStreamInterceptor,
} from '../../../../../packages/platform-fastify/multipart/multipart/multipart-interceptor.factory.js';
import {
  MISSING_PLUGIN_MESSAGE,
  PLUGIN_NOT_REGISTERED_AT_STARTUP_MESSAGE,
  WRONG_ADAPTER_MESSAGE,
} from '../../../../../packages/platform-fastify/multipart/multipart/multipart.constants.js';

/**
 * CFG (C3) for the interceptor factory:
 *   constructor: 1 typeof options.limits !== 'function'
 *   setUpHttpAdapter:
 *     2  !adapterHost?.httpAdapter
 *     3  httpAdapter.getType() !== 'fastify'
 *     4  verifiedInstances.has(instance)
 *     5  !isRegistered() (onReady)
 *     6  catch -> !isRegistered()
 *   MultipartInterceptor.intercept:
 *     7  isRejectedByPipes: req[symbol] === true || core.isRejectedByPipes?.(req) === true
 *     8  result instanceof StreamableFile (stream interceptor)
 *   Both T/F of every feasible condition are exercised below.
 */
type AnyPart = Record<string, any>;

const filePart = (fieldname: string, content = 'data'): AnyPart => {
  const stream = Readable.from([Buffer.from(content)]) as any;
  stream.truncated = false;
  stream.on('error', () => undefined);
  return {
    type: 'file',
    fieldname,
    filename: `${fieldname}.txt`,
    encoding: '7bit',
    mimetype: 'text/plain',
    file: stream,
  };
};

const fieldPart = (fieldname: string, value: string): AnyPart => ({
  type: 'field',
  fieldname,
  value,
  encoding: '7bit',
  mimetype: 'text/plain',
});

const createRequest = (parts: AnyPart[] = []) => {
  const raw = new PassThrough() as any;
  raw.unpipe = vi.fn();
  raw.end();
  const req: any = {
    raw,
    isMultipart: () => true,
  };
  req.parts = () =>
    (async function* () {
      for (const part of parts) yield part;
    })();
  return req;
};

const context = (req: any, reply: any = {}) =>
  new ExecutionContextHost([req, reply]);

const nextWith = (value: any) => ({ handle: () => of(value) });
const nextError = (error: any) => ({ handle: () => throwError(() => error) });

const adapterHost = (type: string, instance: any = {}) =>
  ({
    httpAdapter: {
      getType: () => type,
      getInstance: () => instance,
    },
  }) as any;

const fakeInstance = (hasPlugin: boolean) => {
  const hooks: Function[] = [];
  return {
    hooks,
    addHook: vi.fn((_name: string, hook: Function) => hooks.push(hook)),
    hasRequestDecorator: vi.fn(() => hasPlugin),
  };
};

describe('createMultipartInterceptor', () => {
  const Interceptor = (options?: any) =>
    createMultipartInterceptor({ fields: 'ANY', strategy: 'ARRAY' }, options);

  it('should validate non-function limits in the constructor', () => {
    expect(
      () => new (Interceptor({ limits: { files: 1.5 } }))(),
    ).toThrow(TypeError);
    expect(
      () => new (Interceptor({ limits: { files: 1 } }))(),
    ).not.toThrow();
    expect(
      () => new (Interceptor({ limits: () => ({ files: 1 }) }))(),
    ).not.toThrow();
  });

  it('should resolve memory, disk and custom storage', () => {
    expect(
      (new (Interceptor())() as any).storage._handleFile,
    ).toBeTypeOf('function');

    const custom = { _handleFile: vi.fn(), _removeFile: vi.fn() };
    expect(new (Interceptor({ storage: custom }))().storage).toBe(custom);
    expect(
      (new (Interceptor({ dest: 'node_modules/.cache/ai-multipart' }))() as any)
        .storage._removeFile,
    ).toBeTypeOf('function');
  });

  it('should parse the request and pass the handler result through', async () => {
    const req = createRequest([fieldPart('a', '1'), filePart('file')]);
    const interceptor = new (Interceptor())();
    const result = await lastValueFrom(
      await interceptor.intercept(context(req, {}), nextWith('ok') as any),
    );
    expect(result).toBe('ok');
    expect(req.body.a).toBe('1');
    expect(req.files).toHaveLength(1);
  });

  it('should rethrow a handler error when the pipes did not reject', async () => {
    const req = createRequest([fieldPart('a', '1')]);
    const interceptor = new (Interceptor())();
    const observable = await interceptor.intercept(
      context(req, {}),
      nextError(new Error('handler')) as any,
    );
    await expect(lastValueFrom(observable)).rejects.toThrow('handler');
  });

  it('should remove stored files once the response finished after a pipe rejection', async () => {
    const req = createRequest([fieldPart('a', '1'), filePart('file')]);
    req[Symbol.for('nestjs:rejected-by-pipes')] = true;
    const raw = new PassThrough() as any;
    raw.end();
    raw.resume();
    const reply = { raw };
    const interceptor = new (Interceptor())();

    const observable = await interceptor.intercept(
      context(req, reply),
      nextError(new Error('pipes')) as any,
    );
    await expect(lastValueFrom(observable)).rejects.toThrow('pipes');
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(req.files[0].buffer).toBeUndefined();
  });

  it('should not remove files for a handler error without a pipe rejection', async () => {
    const req = createRequest([filePart('file')]);
    const raw = new PassThrough() as any;
    raw.end();
    const interceptor = new (Interceptor())();
    const observable = await interceptor.intercept(
      context(req, { raw }),
      nextError(new Error('handler')) as any,
    );
    await expect(lastValueFrom(observable)).rejects.toThrow('handler');
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(req.files[0].buffer.toString()).toBe('data');
  });

  it('should swallow a failure to remove files after a pipe rejection', async () => {
    const req = createRequest([filePart('file')]);
    req[Symbol.for('nestjs:rejected-by-pipes')] = true;
    const raw = new PassThrough() as any;
    raw.end();
    raw.resume();
    const storage = {
      _handleFile: vi.fn((_req: any, _file: any, callback: any) =>
        callback(null, { buffer: Buffer.from('x'), size: 1 }),
      ),
      _removeFile: vi.fn(() => {
        throw new Error('remove failed');
      }),
    };
    const interceptor = new (Interceptor({ storage }))();
    const observable = await interceptor.intercept(
      context(req, { raw }),
      nextError(new Error('pipes')) as any,
    );
    await expect(lastValueFrom(observable)).rejects.toThrow('pipes');
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(storage._removeFile).toHaveBeenCalled();
  });
});

describe('createMultipartStreamInterceptor', () => {
  const Interceptor = (fieldName = 'file', options?: any) =>
    createMultipartStreamInterceptor(fieldName, options);

  it('should hand the matching file stream to the handler', async () => {
    const req = createRequest([fieldPart('a', '1'), filePart('file', 'abc')]);
    const raw = new PassThrough() as any;
    raw.end();
    const reply = { raw };
    const interceptor = new (Interceptor())();

    const result = await lastValueFrom(
      await interceptor.intercept(context(req, reply), nextWith('ok') as any),
    );
    expect(result).toBe('ok');
    expect(req.body.a).toBe('1');
    expect(req.file.stream).toBeDefined();
    expect(req.file.fieldname).toBe('file');
  });

  it('should not drain before a StreamableFile result', async () => {
    const req = createRequest([filePart('file')]);
    const raw = new PassThrough() as any;
    raw.end();
    const reply = { raw };
    const interceptor = new (Interceptor())();
    const streamable = new StreamableFile(Buffer.from('x'));

    const result = await lastValueFrom(
      await interceptor.intercept(context(req, reply), nextWith(streamable) as any),
    );
    expect(result).toBe(streamable);
  });

  it('should drain the request and rethrow a handler error', async () => {
    const req = createRequest([fieldPart('a', '1')]);
    const raw = new PassThrough() as any;
    raw.end();
    const reply = { raw };
    const interceptor = new (Interceptor())();
    const observable = await interceptor.intercept(
      context(req, reply),
      nextError(new Error('handler')) as any,
    );
    await expect(lastValueFrom(observable)).rejects.toThrow('handler');
  });

  it('should drain whatever is left when the response closes', async () => {
    const req = createRequest([fieldPart('a', '1')]);
    const raw = new PassThrough() as any;
    raw.end();
    const reply = { raw };
    const interceptor = new (Interceptor())();
    await lastValueFrom(
      await interceptor.intercept(context(req, reply), nextWith('ok') as any),
    );
    expect(() => raw.emit('close')).not.toThrow();
  });

  it('should reject a non-Fastify file field', async () => {
    const req = createRequest([filePart('other')]);
    const raw = new PassThrough() as any;
    raw.end();
    const interceptor = new (Interceptor())();
    await expect(
      interceptor.intercept(context(req, { raw }), nextWith('ok') as any),
    ).rejects.toThrow('Unexpected file field');
  });
});

describe('upload interceptor bootstrap', () => {
  it('should do nothing without an HTTP adapter host', () => {
    const target = new (createMultipartInterceptor({ fields: 'ANY', strategy: 'ARRAY' }))(
      {},
      undefined,
    );
    expect(() => target.onModuleInit!()).not.toThrow();
    const target2 = new (createMultipartInterceptor({ fields: 'ANY', strategy: 'ARRAY' }))(
      {},
      {} as any,
    );
    expect(() => target2.onModuleInit!()).not.toThrow();
  });

  it('should reject a non-Fastify adapter', () => {
    const target = new (createMultipartInterceptor({ fields: 'ANY', strategy: 'ARRAY' }))(
      {},
      adapterHost('express'),
    );
    expect(() => target.onModuleInit!()).toThrow(WRONG_ADAPTER_MESSAGE);
  });

  it('should ask the FastifyAdapter to register the plugin', () => {
    const instance = fakeInstance(true);
    const host = adapterHost('fastify', instance);
    host.httpAdapter.useMultipart = vi.fn();
    new (createMultipartInterceptor({ fields: 'ANY', strategy: 'ARRAY' }))(
      {},
      host,
    ).onModuleInit!();
    expect(host.httpAdapter.useMultipart).toHaveBeenCalledOnce();
    expect(instance.addHook).toHaveBeenCalledWith(
      'onReady',
      expect.any(Function),
    );
  });

  it('should fail the onReady hook when the plugin is missing', async () => {
    const instance = fakeInstance(false);
    const target = new (createMultipartInterceptor({ fields: 'ANY', strategy: 'ARRAY' }))(
      {},
      adapterHost('fastify', instance),
    );
    target.onModuleInit!();
    await expect(instance.hooks[0]()).rejects.toThrow(MISSING_PLUGIN_MESSAGE);
  });

  it('should pass the onReady hook when the plugin is registered', async () => {
    const instance = fakeInstance(true);
    const target = new (createMultipartInterceptor({ fields: 'ANY', strategy: 'ARRAY' }))(
      {},
      adapterHost('fastify', instance),
    );
    target.onModuleInit!();
    await expect(instance.hooks[0]()).resolves.toBeUndefined();
  });

  it('should add the hook once per Fastify instance', () => {
    const instance = fakeInstance(true);
    const host = adapterHost('fastify', instance);
    new (createMultipartInterceptor({ fields: 'ANY', strategy: 'ARRAY' }))(
      {},
      host,
    ).onModuleInit!();
    new (createMultipartInterceptor({ fields: 'ANY', strategy: 'ARRAY' }))(
      {},
      host,
    ).onModuleInit!();
    expect(instance.addHook).toHaveBeenCalledTimes(1);
  });

  it('should fail right away when a booted instance lacks the plugin', () => {
    const instance = {
      addHook: vi.fn(() => {
        throw new Error('already booted');
      }),
      hasRequestDecorator: () => false,
    };
    const host = adapterHost('fastify', instance);
    host.httpAdapter.useMultipart = vi.fn(() => {
      throw new Error('already booted');
    });
    const target = new (createMultipartInterceptor({ fields: 'ANY', strategy: 'ARRAY' }))(
      {},
      host,
    );
    expect(() => target.onModuleInit!()).toThrow(
      PLUGIN_NOT_REGISTERED_AT_STARTUP_MESSAGE,
    );
  });

  it('should accept a booted instance that already has the plugin', () => {
    const instance = {
      addHook: vi.fn(() => {
        throw new Error('already booted');
      }),
      hasRequestDecorator: () => true,
    };
    const target = new (createMultipartInterceptor({ fields: 'ANY', strategy: 'ARRAY' }))(
      {},
      adapterHost('fastify', instance),
    );
    expect(() => target.onModuleInit!()).not.toThrow();
  });
});
