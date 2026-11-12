import { createError } from '@fastify/error';
import {
  HttpException,
  Logger,
  RequestMethod,
  StreamableFile,
  VERSION_NEUTRAL,
  VersioningType,
} from '@nestjs/common';
import { LegacyRouteConverter } from '@nestjs/core/internal';
import { fastify, type FastifyInstance } from 'fastify';
import fastifySymbols from 'fastify/lib/symbols.js';
import createHttpError from 'http-errors';
import * as net from 'net';
import { PassThrough, Readable } from 'stream';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FastifyAdapter } from '../../../../packages/platform-fastify/adapters/fastify-adapter.js';
import {
  FASTIFY_ROUTE_CONFIG_METADATA,
  FASTIFY_ROUTE_CONSTRAINTS_METADATA,
  FASTIFY_ROUTE_SCHEMA_METADATA,
} from '../../../../packages/platform-fastify/constants.js';

const adapters: FastifyAdapter[] = [];
const createAdapter = (options?: any) => {
  const adapter = new FastifyAdapter(options);
  adapters.push(adapter);
  return adapter;
};

afterEach(async () => {
  vi.restoreAllMocks();
  for (const adapter of adapters.splice(0)) {
    try {
      await adapter.close();
    } catch {
      // ignore instances that were never started
    }
  }
});

const replyStub = (overrides: Record<string, any> = {}) => {
  const reply: any = {
    status: vi.fn(() => reply),
    send: vi.fn(() => reply),
    getHeader: vi.fn(() => undefined),
    header: vi.fn(() => reply),
    statusCode: 200,
    sent: false,
    raw: {},
    ...overrides,
  };
  return reply;
};

/**
 * CFG (C3) summary for fastify-adapter.ts (methods in source order):
 *   constructor: instance.server; skipMiddie; multipart === false / truthy /
 *     boolean true / object; securityHook?.() in frameworkErrors (try/catch).
 *   versionConstraint.validate: !string && !array.
 *   versionConstraint.storage: get array/string; set array/string; del
 *     array/string; deriveConstraint media/header/custom/other; extractor throw.
 *   runLifecycleHook: completed guard; thenable; reject with/without error; throw.
 *   init: multipart eager; middie registered; pending queue.
 *   listen: string non-numeric; object with any of host/port/path/fd; callback
 *     position; port validation.
 *   isValidPort: string with content; trimmed non-empty; number/integer/range.
 *   all: (path, handler) tuple; handler replacement.
 *   reply: native/reply; status nil; StreamableFile sent/stream destroy; content
 *     headers present/absent; HEAD; Error body with error status; non-JSON
 *     content type; isErrorBody atomic conditions.
 *   register: multipart off; plugin forms; already registered; user register.
 *   useMultipart: off/requested; already has decorator; limits object.
 *   close: instance.close rejection code.
 *   initHttpServer: return503OnClosing; forceCloseConnections.
 *   setViewEngine: string argument (exit) vs object.
 *   isHeadersSent/setHeader/appendHeader: native vs reply; set-cookie; raw sent.
 *   enableCors: hook non-onRequest; proxy addHook branches; options arity.
 *   registerParserMiddleware: already registered; prefix forms; custom parsers.
 *   useBodyParser: array; raw body; custom/default parser.
 *   createMiddlewareFactory: middie; `$`; `/*path`; path prefix; caseSensitive;
 *     middie contexts; query stripping; middleware run errors.
 *   getRouteMatchingOptions/sanitizeUrl/getPathFromRequestTarget/trimLastSlash.
 *   use: queue before init; delegate after init.
 *   mapException: FastifyError/http-errors 4xx vs 5xx; expose flag.
 *   injectRouteOptions: metadata; version; tuple vs object; addHttpMethod.
 *   requireNonEmptyParams: no parameter; empty parameter; `*` exemption.
 *   trackOpenConnections/closeOpenConnections: closing; duplicate; close.
 * Every feasible T/F pair is exercised below; the only unreachable branches
 * are noted at the end of the corresponding describe block.
 */

describe('FastifyAdapter constructor', () => {
  it('should create a Fastify instance by default', () => {
    const adapter = createAdapter();
    expect(adapter.getType()).toBe('fastify');
    expect(adapter.getInstance()).toBeDefined();
    expect(adapter.getHttpServer()).toBe(adapter.getInstance().server);
  });

  it('should reuse a provided Fastify instance', async () => {
    const instance = fastify();
    const adapter = new FastifyAdapter(instance);
    expect(adapter.getInstance()).toBe(instance);
    await adapter.close();
  });

  it.each([
    ['false disables multipart', false, 'off', {}],
    ['true requests multipart eagerly', true, 'eager', {}],
    ['an object requests multipart with options', { limits: { files: 1 } }, 'eager', { limits: { files: 1 } }],
  ])('should configure multipart when the option is %s', (_n, value, mode, options) => {
    const adapter = createAdapter({ multipart: value });
    expect((adapter as any).multipartMode).toBe(mode);
    expect((adapter as any).multipartOptions).toEqual(options);
  });

  it('should mark middie as registered when skipMiddie is set', async () => {
    const adapter = createAdapter({ skipMiddie: true });
    expect((adapter as any).isMiddieRegistered).toBe(true);
    await expect(adapter.init()).resolves.toBeUndefined();
  });

  it('should fold top-level router options into routerOptions', () => {
    const adapter = createAdapter({
      ignoreTrailingSlash: true,
      ignoreDuplicateSlashes: true,
      caseSensitive: false,
      useSemicolonDelimiter: true,
      maxParamLength: 10,
      allowUnsafeRegex: true,
      routerOptions: { caseSensitive: true },
    });
    expect(adapter.getInstance().initialConfig.routerOptions).toMatchObject({
      ignoreTrailingSlash: true,
      ignoreDuplicateSlashes: true,
      caseSensitive: true,
      useSemicolonDelimiter: true,
      maxParamLength: 10,
      allowUnsafeRegex: true,
    });
  });

  it('should ignore undefined top-level router options', () => {
    const adapter = createAdapter();
    expect((adapter as any).getTopLevelRouterOptions(undefined)).toEqual({});
    expect(
      (adapter as any).getTopLevelRouterOptions({
        ignoreTrailingSlash: undefined,
        caseSensitive: false,
      }),
    ).toEqual({ caseSensitive: false });
  });

  it('should run the security hook for framework errors and swallow its throw', async () => {
    const adapter = createAdapter();
    const hook = vi.fn(() => {
      throw new Error('hook failed');
    });
    adapter.registerSecurityHook(hook as any);

    const response = await adapter.inject({ method: 'GET', url: '/%' });
    expect(response.statusCode).toBe(400);
    expect(hook).toHaveBeenCalledOnce();
  });

  it('should run the security hook for framework errors without throwing', async () => {
    const adapter = createAdapter();
    const hook = vi.fn();
    adapter.registerSecurityHook(hook as any);
    const response = await adapter.inject({ method: 'GET', url: '/%' });
    expect(response.statusCode).toBe(400);
    expect(hook).toHaveBeenCalledOnce();
  });
});

describe('versionConstraint', () => {
  const constraint = (adapter: FastifyAdapter) => (adapter as any).versionConstraint;

  it.each([['1'], [['1', '2']]])('should validate %j', value => {
    expect(() => constraint(createAdapter()).validate(value)).not.toThrow();
  });

  it.each([[1], [null], [{}], [undefined]])(
    'should reject %j as a version constraint',
    value => {
      expect(() => constraint(createAdapter()).validate(value)).toThrow(
        'Version constraint should be a string or an array of strings.',
      );
    },
  );

  it('should get, set and delete single versions', () => {
    const storage = constraint(createAdapter()).storage();
    expect(storage.get('1')).toBeNull();
    storage.set('1', { route: 1 });
    expect(storage.get('1')).toEqual({ route: 1 });
    storage.del('1');
    expect(storage.get('1')).toBeNull();
  });

  it('should get, set and delete an array version by its first stored match', () => {
    const storage = constraint(createAdapter()).storage();
    storage.set(['1', '2'], { route: 1 });
    expect(storage.get(['2', '1'])).toEqual({ route: 1 });
    expect(storage.get(['3', '4'])).toBeNull();
    storage.del(['1', '2']);
    expect(storage.get('1')).toBeNull();
  });

  it('should clear every stored version', () => {
    const storage = constraint(createAdapter()).storage();
    storage.set(['1', '2'], {});
    storage.set('3', {});
    storage.empty();
    expect(storage.get('1')).toBeNull();
    expect(storage.get('3')).toBeNull();
  });

  const derive = (adapter: FastifyAdapter, headers: any) =>
    constraint(adapter).deriveConstraint({ headers } as any);

  it('should derive a media-type version from the Accept header', () => {
    const adapter = createAdapter();
    (adapter as any).versioningOptions = {
      type: VersioningType.MEDIA_TYPE,
      key: 'v=',
    };
    expect(derive(adapter, { Accept: 'application/json;v=2' })).toBe('2');
    expect(derive(adapter, { accept: 'application/json;v=3' })).toBe('3');
  });

  it('should use VERSION_NEUTRAL when the media type carries no version', () => {
    const adapter = createAdapter();
    (adapter as any).versioningOptions = {
      type: VersioningType.MEDIA_TYPE,
      key: 'v=',
    };
    expect(derive(adapter, { Accept: 'application/json' })).toBe(
      VERSION_NEUTRAL,
    );
    expect(derive(adapter, {})).toBe(VERSION_NEUTRAL);
  });

  it('should derive a header version from the custom header', () => {
    const adapter = createAdapter();
    (adapter as any).versioningOptions = {
      type: VersioningType.HEADER,
      header: 'X-Version',
    };
    expect(derive(adapter, { 'X-Version': '4' })).toBe('4');
    expect(derive(adapter, { 'x-version': '5' })).toBe('5');
  });

  it('should use VERSION_NEUTRAL when the custom header is missing', () => {
    const adapter = createAdapter();
    (adapter as any).versioningOptions = {
      type: VersioningType.HEADER,
      header: 'X-Version',
    };
    expect(derive(adapter, {})).toBe(VERSION_NEUTRAL);
  });

  it('should derive a version from a custom extractor', () => {
    const adapter = createAdapter();
    const extractor = vi.fn(() => 'custom');
    (adapter as any).versioningOptions = {
      type: VersioningType.CUSTOM,
      extractor,
    };
    expect(derive(adapter, {})).toBe('custom');
  });

  it('should record and swallow a custom extractor error', () => {
    const adapter = createAdapter();
    const error = new Error('extractor');
    (adapter as any).versioningOptions = {
      type: VersioningType.CUSTOM,
      extractor: () => {
        throw error;
      },
    };
    const req: any = { headers: {} };
    expect(constraint(adapter).deriveConstraint(req)).toBeUndefined();
    expect((adapter as any).versionExtractorErrors.get(req)).toBe(error);
  });

  it('should return undefined when no versioning type is configured', () => {
    expect(derive(createAdapter(), {})).toBeUndefined();
  });
});

describe('lifecycle hooks', () => {
  const registerRoute = (adapter: FastifyAdapter) => {
    adapter.get('/', () => 'ok');
    return adapter;
  };

  it('should call the onRequest hook with done', async () => {
    const adapter = registerRoute(createAdapter());
    const hook = vi.fn((_req, _reply, done) => done());
    adapter.setOnRequestHook(hook as any);
    const res = await adapter.inject('/');
    expect(res.statusCode).toBe(200);
    expect(hook).toHaveBeenCalledOnce();
  });

  it('should call the onResponse hook with done', async () => {
    const adapter = registerRoute(createAdapter());
    const hook = vi.fn((_req, _reply, done) => done());
    adapter.setOnResponseHook(hook as any);
    await adapter.inject('/');
    expect(hook).toHaveBeenCalledOnce();
  });

  it('should complete an async onRequest hook', async () => {
    const adapter = registerRoute(createAdapter());
    adapter.setOnRequestHook((async () => undefined) as any);
    const res = await adapter.inject('/');
    expect(res.statusCode).toBe(200);
  });

  it('should reject the request when an async onRequest hook rejects', async () => {
    const adapter = registerRoute(createAdapter());
    adapter.setOnRequestHook((() => Promise.reject(new Error('hook'))) as any);
    const res = await adapter.inject('/');
    expect(res.statusCode).toBe(500);
  });

  it('should reject with a Fastify error when the hook rejects without a reason', async () => {
    const adapter = registerRoute(createAdapter());
    adapter.setOnRequestHook((() => Promise.reject(undefined)) as any);
    const res = await adapter.inject('/');
    expect(res.statusCode).toBe(500);
  });

  it('should reject the request when a sync onRequest hook throws', async () => {
    const adapter = registerRoute(createAdapter());
    adapter.setOnRequestHook((() => {
      throw new Error('sync hook');
    }) as any);
    const res = await adapter.inject('/');
    expect(res.statusCode).toBe(500);
  });

  it('should ignore the return value of a hook that is not thenable', async () => {
    const adapter = registerRoute(createAdapter());
    adapter.setOnRequestHook(((_req, _reply, done) => {
      done();
      return 42;
    }) as any);
    expect((await adapter.inject('/')).statusCode).toBe(200);
  });

  it('should call done only once when a hook calls it twice', async () => {
    const adapter = registerRoute(createAdapter());
    adapter.setOnRequestHook(((_req, _reply, done) => {
      done();
      done(new Error('second'));
    }) as any);
    expect((await adapter.inject('/')).statusCode).toBe(200);
  });

  it('should run the 503 hook when shutting down', async () => {
    const adapter = registerRoute(createAdapter());
    adapter.initHttpServer({ return503OnClosing: true });
    adapter.beforeClose();
    const res = await adapter.inject('/');
    expect(res.statusCode).toBe(503);
    expect(res.headers.connection).toBe('close');
  });

  it('should skip the Connection header for HTTP/2 in the 503 hook', async () => {
    const adapter = registerRoute(createAdapter());
    adapter.initHttpServer({ return503OnClosing: true });
    adapter.beforeClose();
    await adapter.getInstance().ready();
    const hooks = (adapter.getInstance() as any)[
      fastifySymbols.kHooks
    ].onRequest as Function[];
    const header = vi.fn();
    const send = vi.fn();
    const reply = { header, code: vi.fn(() => ({ send })) };
    hooks[1]({ raw: { httpVersionMajor: 2 } }, reply, vi.fn());
    expect(header).not.toHaveBeenCalled();
    expect(reply.code).toHaveBeenCalledWith(503);
  });

  it('should call notFound for a non-routable target in the request hook', async () => {
    const adapter = registerRoute(createAdapter());
    await adapter.getInstance().ready();
    const hooks = (adapter.getInstance() as any)[
      fastifySymbols.kHooks
    ].onRequest as Function[];
    const reply = { callNotFound: vi.fn() };
    const done = vi.fn();
    hooks[4]({ is404: false, raw: { url: '*users' } }, reply, done);
    expect(reply.callNotFound).toHaveBeenCalled();
    expect(done).not.toHaveBeenCalled();
  });

  it('should use a Fastify error for a falsy extractor error', async () => {
    const adapter = registerRoute(createAdapter());
    await adapter.getInstance().ready();
    const hooks = (adapter.getInstance() as any)[
      fastifySymbols.kHooks
    ].onRequest as Function[];
    const raw = {};
    (adapter as any).versionExtractorErrors.set(raw, undefined);
    const done = vi.fn();
    hooks[5]({ raw }, {}, done);
    expect(done).toHaveBeenCalledWith(expect.any(Error));
  });

  it('should cover the CORS proxy fallback when a hook is already set', async () => {
    const adapter = registerRoute(createAdapter());
    (adapter as any).corsHook = (_req: any, reply: any, done: any) => {
      reply.header('x-test-cors', '1');
      done();
    };
    adapter.enableCors();
    const res = await adapter.inject({
      method: 'GET',
      url: '/',
      headers: { origin: 'http://example.com' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['x-test-cors']).toBe('1');
  });

  it('should not add the Connection header on HTTP/2', async () => {
    const adapter = registerRoute(createAdapter({ http2: true }));
    adapter.initHttpServer({ return503OnClosing: true });
    adapter.beforeClose();
    const res = await adapter.inject('/');
    expect(res.statusCode).toBe(503);
  });

  it('should pass requests through when the 503 hook is inactive', async () => {
    const adapter = registerRoute(createAdapter());
    adapter.initHttpServer({ return503OnClosing: false });
    adapter.beforeClose();
    expect((await adapter.inject('/')).statusCode).toBe(200);
  });

  it('should copy CORS headers into a raw response and skip undefined values', () => {
    const adapter = createAdapter();
    const raw: any = { headersSent: false, setHeader: vi.fn() };
    const reply: any = {
      raw,
      getHeaders: () => ({
        vary: 'Origin',
        'access-control-allow-origin': '*',
        'content-type': 'text/plain',
        'access-control-allow-headers': undefined,
      }),
    };
    (adapter as any).copyCorsHeadersToRaw(reply);
    expect(raw.setHeader).toHaveBeenCalledWith('vary', 'Origin');
    expect(raw.setHeader).toHaveBeenCalledWith(
      'access-control-allow-origin',
      '*',
    );
    expect(raw.setHeader).toHaveBeenCalledTimes(2);
  });

  it('should not copy CORS headers once the raw response was sent', () => {
    const adapter = createAdapter();
    const raw: any = { headersSent: true, setHeader: vi.fn() };
    (adapter as any).copyCorsHeadersToRaw({
      raw,
      getHeaders: () => ({ vary: 'Origin' }),
    });
    expect(raw.setHeader).not.toHaveBeenCalled();
  });

  it('should enable CORS with the default onRequest hook', async () => {
    const adapter = registerRoute(createAdapter());
    adapter.enableCors();
    const res = await adapter.inject({
      method: 'GET',
      url: '/',
      headers: { origin: 'http://example.com' },
    });
    expect(res.headers['access-control-allow-origin']).toBe('*');
  });

  it('should register the plugin directly for a later CORS hook', async () => {
    const adapter = createAdapter();
    const register = vi.spyOn(adapter.getInstance(), 'register');
    adapter.enableCors({ hook: 'preHandler' });
    expect(register).toHaveBeenCalled();
  });

  it('should resolve function options taking the instance', async () => {
    const adapter = registerRoute(createAdapter());
    const options = vi.fn(() => ({ origin: true }));
    adapter.enableCors(options as any);
    const res = await adapter.inject({
      method: 'GET',
      url: '/',
      headers: { origin: 'http://example.com' },
    });
    expect(options).toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
  });

  it('should treat a two-argument function as CORS options', () => {
    const adapter = registerRoute(createAdapter());
    const options = (_req: any, callback: any) => callback(null, {});
    expect(() => adapter.enableCors(options as any)).not.toThrow();
  });

  it('should install a security hook header on matched and unmatched responses', async () => {
    const adapter = registerRoute(createAdapter());
    adapter.registerSecurityHook(((_req: any, raw: any) => {
      raw.setHeader('x-security', 'on');
    }) as any);
    expect((await adapter.inject('/')).headers['x-security']).toBe('on');
    expect((await adapter.inject('/missing')).headers['x-security']).toBe('on');
  });

  it('should send a security hook rejection through the error layer', async () => {
    const adapter = registerRoute(createAdapter());
    adapter.registerSecurityHook((() => new Error('blocked')) as any);
    const res = await adapter.inject('/');
    expect(res.statusCode).toBe(500);
  });

  it('should route a custom versioning extractor error to the error handler', async () => {
    const adapter = createAdapter();
    (adapter as any).versioningOptions = {
      type: VersioningType.CUSTOM,
      extractor: () => {
        throw new Error('bad version');
      },
    };
    const handler: any = () => 'ok';
    handler.version = '1';
    adapter.get('/', handler);
    const res = await adapter.inject('/');
    expect(res.statusCode).toBe(500);
  });

  it('should pass a non-routable request target to the not-found handler', async () => {
    const adapter = registerRoute(createAdapter());
    expect((await adapter.inject({ url: '*users' })).statusCode).toBe(404);
    expect((await adapter.inject({ url: '/' })).statusCode).toBe(200);
  });
});

describe('init, listen and close', () => {
  it('should register middie and flush queued middleware', async () => {
    const adapter = createAdapter();
    adapter.use(() => undefined);
    adapter.get('/', () => 'ok');
    expect((adapter as any).pendingMiddlewares).toHaveLength(1);
    await adapter.init();
    expect((adapter.getInstance() as any).use).toBeTypeOf('function');
    expect((adapter as any).pendingMiddlewares).toHaveLength(0);
  });

  it('should request multipart eagerly during init', async () => {
    const adapter = createAdapter({ multipart: { limits: { files: 1 } } });
    const useMultipart = vi.spyOn(adapter, 'useMultipart');
    await adapter.init();
    expect(useMultipart).toHaveBeenCalled();
  });

  it('should return early from init when middie is already registered', async () => {
    const adapter = createAdapter({ skipMiddie: true });
    const registerMiddie = vi.spyOn(adapter as any, 'registerMiddie');
    await adapter.init();
    expect(registerMiddie).not.toHaveBeenCalled();
  });

  it('should listen on a Unix socket path for a non-numeric string', () => {
    const adapter = createAdapter();
    const listen = vi
      .spyOn(adapter.getInstance(), 'listen')
      .mockResolvedValue({} as any);
    const callback = vi.fn();
    adapter.listen('/tmp/socket.sock', callback);
    expect(listen).toHaveBeenCalledWith({ path: '/tmp/socket.sock' }, callback);
  });

  it.each([
    [{ port: 3000, host: 'localhost' }],
    [{ host: 'localhost' }],
    [{ port: 3000 }],
    [{ path: '/tmp/x' }],
    [{ fd: 3 }],
  ])('should use an object with listen attributes %j', options => {
    const adapter = createAdapter();
    const listen = vi
      .spyOn(adapter.getInstance(), 'listen')
      .mockResolvedValue({} as any);
    adapter.listen(options as any);
    expect(listen).toHaveBeenCalledWith(options, undefined);
  });

  it('should parse a numeric string port and attach the hostname', () => {
    const adapter = createAdapter();
    const listen = vi
      .spyOn(adapter.getInstance(), 'listen')
      .mockResolvedValue({} as any);
    adapter.listen('3000', 'localhost', vi.fn());
    expect(listen).toHaveBeenCalledWith(
      { port: 3000, host: 'localhost' },
      expect.any(Function),
    );
  });

  it('should not attach a hostname when the first extra argument is a callback', () => {
    const adapter = createAdapter();
    const listen = vi
      .spyOn(adapter.getInstance(), 'listen')
      .mockResolvedValue({} as any);
    const callback = vi.fn();
    adapter.listen(0, callback);
    expect(listen).toHaveBeenCalledWith({ port: 0 }, callback);
  });

  it.each([[-1], [70000], [1.5], [NaN]])(
    'should reject an invalid port %j',
    port => {
      const adapter = createAdapter();
      expect(() => adapter.listen(port as any)).toThrow(RangeError);
      try {
        adapter.listen(port as any);
      } catch (error: any) {
        expect(error.code).toBe('ERR_SOCKET_BAD_PORT');
      }
    },
  );

  it('should treat an object without listen attributes as a port', () => {
    const adapter = createAdapter();
    expect(() => adapter.listen({} as any)).toThrow(RangeError);
  });

  it.each([
    [0, true],
    [65535, true],
    [65536, false],
    [-1, false],
    [1.5, false],
    ['3000', true],
    ['  ', false],
    [' 3000 ', true],
    ['abc', false],
    [null, false],
  ])('should validate the port %j', (port, valid) => {
    const adapter = createAdapter();
    expect((adapter as any).isValidPort(port)).toBe(valid);
  });

  it('should close a server that never ran', async () => {
    const adapter = new FastifyAdapter();
    await expect(adapter.close()).resolves.toBeUndefined();
  });

  it('should ignore ERR_SERVER_NOT_RUNNING on close', async () => {
    const adapter = createAdapter();
    vi.spyOn(adapter.getInstance(), 'close').mockRejectedValue({
      code: 'ERR_SERVER_NOT_RUNNING',
    });
    await expect(adapter.close()).resolves.toBeUndefined();
  });

  it('should rethrow other close errors', async () => {
    const adapter = createAdapter();
    vi.spyOn(adapter.getInstance(), 'close').mockRejectedValue(
      Object.assign(new Error('close'), { code: 'OTHER' }),
    );
    await expect(adapter.close()).rejects.toThrow('close');
  });

  it('should set the HTTP server and shutdown flags', () => {
    const adapter = createAdapter();
    adapter.initHttpServer({ return503OnClosing: true });
    expect(adapter.getHttpServer()).toBe(adapter.getInstance().server);
    expect((adapter as any).return503OnClosing).toBe(true);
  });

  it('should track and close open connections', () => {
    const adapter = createAdapter();
    adapter.initHttpServer({ forceCloseConnections: true });
    const connections = (adapter as any).openConnections as Set<any>;
    const socket: any = new PassThrough();
    adapter.getHttpServer().emit('connection', socket);
    expect(connections.size).toBe(1);
    adapter.getHttpServer().emit('connection', socket);
    expect(connections.size).toBe(1);
    socket.emit('close');
    expect(connections.size).toBe(0);
  });

  it('should destroy connections that arrive while closing', () => {
    const adapter = createAdapter();
    adapter.initHttpServer({ forceCloseConnections: true });
    const socket: any = new PassThrough();
    (adapter as any).isClosing = true;
    const destroy = vi.spyOn(socket, 'destroy');
    adapter.getHttpServer().emit('connection', socket);
    expect(destroy).toHaveBeenCalled();
    expect((adapter as any).openConnections.size).toBe(0);
  });

  it('should destroy every tracked connection on close', () => {
    const adapter = createAdapter();
    adapter.initHttpServer({ forceCloseConnections: true });
    const socket: any = new PassThrough();
    adapter.getHttpServer().emit('connection', socket);
    const destroy = vi.spyOn(socket, 'destroy');
    (adapter as any).closeOpenConnections();
    expect(destroy).toHaveBeenCalled();
    expect((adapter as any).openConnections.size).toBe(0);
  });

  it('should track net.Socket instances seen on requests', async () => {
    const adapter = createAdapter();
    adapter.initHttpServer({ forceCloseConnections: true });
    await adapter.getInstance().ready();
    const hooks = (adapter.getInstance() as any)[fastifySymbols.kHooks]
      .onRequest as Function[];
    const socket = new net.Socket();
    const done = vi.fn();
    hooks[hooks.length - 1]({ raw: { socket } }, {}, done);
    expect((adapter as any).openConnections.has(socket)).toBe(true);
    socket.emit('close');
    expect((adapter as any).openConnections.size).toBe(0);
    socket.destroy();
    expect(done).toHaveBeenCalled();
  });

  it('should not track a mock socket from inject()', async () => {
    const adapter = createAdapter();
    adapter.initHttpServer({ forceCloseConnections: true });
    adapter.get('/', () => 'ok');
    // inject() uses a mock socket (not a net.Socket), so the request hook must
    // leave it untracked.
    await adapter.inject('/');
    expect((adapter as any).openConnections.size).toBe(0);
  });
});describe('HTTP methods and version filters', () => {
  const methods = [
    'get',
    'post',
    'head',
    'delete',
    'put',
    'patch',
    'options',
    'search',
    'query',
    'propfind',
    'proppatch',
    'mkcol',
    'copy',
    'move',
    'lock',
    'unlock',
  ] as const;

  it.each(methods)('should delegate %s to injectRouteOptions', method => {
    const adapter = createAdapter();
    const injectRouteOptions = vi
      .spyOn(adapter as any, 'injectRouteOptions')
      .mockReturnValue(undefined);
    (adapter as any)[method]('/x', () => undefined);
    expect(injectRouteOptions).toHaveBeenCalledWith(
      method.toUpperCase(),
      '/x',
      expect.any(Function),
    );
  });

  it('should route with the supported methods for a "all" tuple', () => {
    const adapter = createAdapter();
    const injectRouteOptions = vi
      .spyOn(adapter as any, 'injectRouteOptions')
      .mockReturnValue(undefined);
    const handler = () => undefined;
    adapter.all('/x', handler);
    expect(injectRouteOptions).toHaveBeenCalledWith(
      adapter.getInstance().supportedMethods,
      '/x',
      handler,
    );
  });

  it('should keep the handler when "all" receives route options', () => {
    const adapter = createAdapter();
    const all = vi
      .spyOn(adapter.getInstance(), 'all' as any)
      .mockReturnValue(undefined as any);
    const handler = () => undefined;
    adapter.all('/x', {}, handler);
    expect(all).toHaveBeenCalledWith('/x', {}, handler);
    expect((all.mock.calls[0] as any[])[2]).toBe(handler);
  });

  it('should apply and keep the versioning options', () => {
    const adapter = createAdapter();
    const handler: any = () => undefined;
    const options = { type: VersioningType.HEADER } as any;
    const versioned = adapter.applyVersionFilter(handler, '1', options);
    expect(versioned).toBe(handler);
    expect(versioned.version).toBe('1');
    expect((adapter as any).versioningOptions).toBe(options);

    const other = { type: VersioningType.CUSTOM } as any;
    adapter.applyVersionFilter(handler, '2', other);
    expect((adapter as any).versioningOptions).toBe(options);
  });

  it('should expose route matching options from both locations', () => {
    const adapter = createAdapter();
    expect(adapter.getRouteMatchingOptions()).toEqual({
      caseSensitive: true,
      ignoreTrailingSlash: false,
    });

    (adapter as any).instance.initialConfig = {
      routerOptions: { caseSensitive: false, ignoreTrailingSlash: true },
      caseSensitive: false,
      ignoreTrailingSlash: false,
    };
    expect(adapter.getRouteMatchingOptions()).toEqual({
      caseSensitive: false,
      ignoreTrailingSlash: true,
    });

    (adapter as any).instance.initialConfig = {
      routerOptions: {},
      caseSensitive: false,
      ignoreTrailingSlash: true,
    };
    expect(adapter.getRouteMatchingOptions()).toEqual({
      caseSensitive: false,
      ignoreTrailingSlash: true,
    });

    (adapter as any).instance.initialConfig = {
      routerOptions: undefined,
      caseSensitive: false,
      ignoreTrailingSlash: true,
    };
    expect(adapter.getRouteMatchingOptions()).toEqual({
      caseSensitive: false,
      ignoreTrailingSlash: true,
    });
  });

  it('should report route order insensitivity', () => {
    expect(createAdapter().isRouteOrderSensitive()).toBe(false);
  });
});

describe('register, useMultipart and static assets', () => {
  it('should register an ordinary plugin through Fastify', () => {
    const adapter = createAdapter();
    const register = vi.spyOn(adapter.getInstance(), 'register');
    const plugin = () => undefined;
    adapter.register(plugin as any);
    expect(register).toHaveBeenCalledWith(plugin, undefined);
  });

  it('should not intercept a multipart plugin when multipart is off', () => {
    const adapter = createAdapter({ multipart: false });
    const register = vi.spyOn(adapter.getInstance(), 'register');
    const plugin: any = () => undefined;
    plugin[Symbol.for('plugin-meta')] = { name: '@fastify/multipart' };
    adapter.register(plugin);
    expect(register).toHaveBeenCalledWith(plugin, undefined);
    expect((adapter as any).isMultipartRequested).toBe(false);
  });

  it.each([
    ['the plugin function name', () => {
      const plugin: any = function fastifyMultipart() {};
      return plugin;
    }],
    ['plugin metadata', () => {
      const plugin: any = () => undefined;
      plugin[Symbol.for('plugin-meta')] = { name: '@fastify/multipart' };
      return plugin;
    }],
    ['a default export', () => {
      const plugin: any = () => undefined;
      const wrapper: any = { default: plugin };
      plugin[Symbol.for('plugin-meta')] = { name: '@fastify/multipart' };
      return wrapper;
    }],
  ])('should detect the multipart plugin by %s', (_name, factory) => {
    const adapter = createAdapter();
    const instance = adapter.getInstance();
    const result = adapter.register(factory(), { limits: { files: 2 } } as any);
    expect(result).toBe(instance);
    expect((adapter as any).isMultipartRequested).toBe(true);
    expect((adapter as any).multipartOptions).toEqual({ limits: { files: 2 } });
  });

  it('should pass the multipart plugin through when it is already registered', () => {
    const adapter = createAdapter();
    const instance = adapter.getInstance();
    vi.spyOn(instance, 'hasRequestDecorator')
      .mockReturnValue(true);
    const register = vi.spyOn(instance, 'register');
    const plugin: any = () => undefined;
    plugin[Symbol.for('plugin-meta')] = { name: '@fastify/multipart' };
    adapter.register(plugin);
    expect(register).toHaveBeenCalledWith(plugin, undefined);
  });

  it('should skip useMultipart when multipart is off', () => {
    const adapter = createAdapter({ multipart: false });
    adapter.useMultipart();
    expect((adapter as any).isMultipartRequested).toBe(false);
  });

  it('should be idempotent in useMultipart', () => {
    const adapter = createAdapter();
    const register = vi.spyOn(adapter.getInstance(), 'register');
    adapter.useMultipart();
    adapter.useMultipart();
    expect(register).toHaveBeenCalledTimes(1);
  });

  it('should register the real multipart plugin with limits', async () => {
    const adapter = createAdapter({ multipart: { limits: { files: 1 } } });
    await adapter.init();
    await adapter.getInstance().ready();
    expect(adapter.getInstance().hasRequestDecorator('isMultipart')).toBe(true);
  });

  it('should skip registering when the plugin is already present', async () => {
    const adapter = createAdapter();
    const registered: Function[] = [];
    (adapter as any).instance = {
      register: (fn: Function) => registered.push(fn),
    };
    adapter.useMultipart();
    const registerMultipart: any = registered[0];
    const instance = {
      hasRequestDecorator: () => true,
      register: vi.fn(),
    };
    await registerMultipart(instance);
    expect(instance.register).not.toHaveBeenCalled();
  });

  it('should load and register the multipart package', async () => {
    const adapter = createAdapter();
    const registered: Function[] = [];
    (adapter as any).instance = {
      register: (fn: Function) => registered.push(fn),
    };
    (adapter as any).multipartOptions = { limits: { files: 1 }, preservePath: true };
    adapter.useMultipart();
    const registerMultipart: any = registered[0];
    const instance = {
      hasRequestDecorator: () => false,
      register: vi.fn(),
    };
    await registerMultipart(instance);
    expect(instance.register).toHaveBeenCalledWith(
      expect.anything(),
      { preservePath: true, limits: { files: 1 } },
    );
  });

  it('should register static assets', () => {
    const adapter = createAdapter();
    const register = vi.spyOn(adapter, 'register').mockReturnValue(undefined as any);
    adapter.useStaticAssets({ root: '/tmp' } as any);
    expect(register).toHaveBeenCalledWith(expect.anything(), { root: '/tmp' });
  });

  it('should register a view engine', () => {
    const adapter = createAdapter();
    const register = vi.spyOn(adapter, 'register').mockReturnValue(undefined as any);
    adapter.setViewEngine({ engine: { compile: () => () => '' }, root: '/tmp' } as any);
    expect(register).toHaveBeenCalled();
  });

  it('should exit when setViewEngine receives a string', () => {
    const adapter = createAdapter();
    const error = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as any);
    adapter.setViewEngine('ejs');
    expect(error).toHaveBeenCalled();
    expect(exit).toHaveBeenCalledWith(1);
  });
});

describe('reply and response helpers', () => {
  it('should apply the status code when one is given', () => {
    const adapter = createAdapter();
    const reply = replyStub();
    adapter.reply(reply, { ok: true }, 404);
    expect(reply.status).toHaveBeenCalledWith(404);
    expect(reply.send).toHaveBeenCalledWith({ ok: true });
  });

  it.each([[0], [NaN]])('should forward the falsy status code %j', statusCode => {
    const adapter = createAdapter();
    const reply = replyStub();
    adapter.reply(reply, {}, statusCode);
    expect(reply.status).toHaveBeenCalledWith(statusCode);
  });

  it('should not set a status when it is omitted', () => {
    const adapter = createAdapter();
    const reply = replyStub();
    adapter.reply(reply, {});
    expect(reply.status).not.toHaveBeenCalled();
  });

  it('should wrap a native response in a Fastify reply', async () => {
    const adapter = createAdapter();
    adapter.get('/', (_req, reply: any) => {
      reply.hijack();
      adapter.reply(reply.raw, { ok: true }, 201);
    });
    const res = await adapter.inject('/');
    expect(res.statusCode).toBe(201);
    expect(res.json()).toEqual({ ok: true });
  });

  it('should send a StreamableFile with its headers', async () => {
    const adapter = createAdapter();
    adapter.get('/', (_req, reply: any) => {
      adapter.reply(
        reply,
        new StreamableFile(Buffer.from('hello'), {
          type: 'text/plain',
          disposition: 'attachment; filename="a.txt"',
          length: 5,
        }),
      );
    });
    const res = await adapter.inject('/');
    expect(res.body).toBe('hello');
    expect(res.headers['content-type']).toBe('text/plain');
    expect(res.headers['content-disposition']).toContain('attachment');
    expect(res.headers['content-length']).toBe('5');
  });

  it('should keep existing StreamableFile headers', () => {
    const adapter = createAdapter();
    const reply = replyStub({
      getHeader: vi.fn((name: string) => {
        if (name === 'Content-Type') return 'application/custom';
        if (name === 'Content-Disposition') return 'inline';
        if (name === 'Content-Length') return '1';
        return undefined;
      }),
    });
    adapter.reply(reply, new StreamableFile(Buffer.from('x')));
    expect(reply.header).not.toHaveBeenCalledWith(
      'Content-Type',
      expect.anything(),
    );
    expect(reply.header).not.toHaveBeenCalledWith(
      'Content-Length',
      expect.anything(),
    );
  });

  it('should omit Content-Length when Transfer-Encoding is set', async () => {
    const adapter = createAdapter();
    adapter.get('/', (_req, reply: any) => {
      reply.header('Transfer-Encoding', 'chunked');
      adapter.reply(reply, new StreamableFile(Buffer.from('abc')));
    });
    const res = await adapter.inject('/');
    expect(res.headers['transfer-encoding']).toBe('chunked');
    expect(res.headers['content-length']).toBeUndefined();
  });

  it('should not set a stream header when its value is undefined', () => {
    const adapter = createAdapter();
    const reply = replyStub();
    class WithoutHeaders extends StreamableFile {
      getHeaders(): any {
        return { type: undefined, disposition: undefined, length: undefined };
      }
    }
    adapter.reply(reply, new WithoutHeaders(Readable.from([])));
    expect(reply.header).not.toHaveBeenCalled();
  });

  it('should destroy the stream of a sent reply', () => {
    const adapter = createAdapter();
    const stream = new PassThrough();
    const destroy = vi.spyOn(stream, 'destroy');
    const reply = replyStub({ sent: true });
    adapter.reply(reply, new StreamableFile(stream));
    expect(destroy).toHaveBeenCalled();
  });

  it('should not destroy a sent stream without a destroy method', () => {
    const adapter = createAdapter();
    const reply = replyStub({ sent: true });
    class WithoutDestroy extends StreamableFile {
      getStream(): any {
        return {};
      }
      getHeaders(): any {
        return {};
      }
    }
    expect(() => adapter.reply(reply, new WithoutDestroy(Buffer.from('x')))).not.toThrow();
  });

  it('should send an empty stream for a HEAD request', () => {
    const adapter = createAdapter();
    const stream = new PassThrough();
    const destroy = vi.spyOn(stream, 'destroy');
    const reply = replyStub({ raw: { req: { method: 'HEAD' } } });
    adapter.reply(reply, new StreamableFile(stream));
    expect(destroy).toHaveBeenCalled();
    expect(reply.send).toHaveBeenCalled();
  });

  it('should not destroy a HEAD stream without a destroy method', () => {
    const adapter = createAdapter();
    const reply = replyStub({ raw: { req: { method: 'HEAD' } } });
    class WithoutDestroy extends StreamableFile {
      getStream(): any {
        return {};
      }
      getHeaders(): any {
        return {};
      }
    }
    expect(() => adapter.reply(reply, new WithoutDestroy(Buffer.from('x')))).not.toThrow();
  });

  it('should replace an Error body for an unknown error status', () => {
    const adapter = createAdapter();
    const reply = replyStub({ statusCode: 599 });
    adapter.reply(reply, new Error('boom'));
    expect(reply.send).toHaveBeenCalledWith({
      statusCode: 599,
      message: 'Error',
    });
  });

  it.each([
    [400, true],
    [200, false],
  ])('should replace an Error body for status %i', (statusCode, replaced) => {
    const adapter = createAdapter();
    const reply = replyStub({ statusCode });
    const body = new Error('boom');
    adapter.reply(reply, body);
    if (replaced) {
      expect(reply.send).toHaveBeenCalledWith({
        statusCode,
        message: expect.any(String),
      });
    } else {
      expect(reply.send).toHaveBeenCalledWith(body);
    }
  });

  it.each([
    ['application/json', false],
    ['application/problem+json', false],
    ['Application/JSON; charset=utf-8', false],
    ['text/html', true],
  ])('should handle the content type %s', (contentType, forcesJson) => {
    const adapter = createAdapter();
    const warn = vi.spyOn(Logger, 'warn').mockImplementation(() => undefined);
    const reply = replyStub({
      getHeader: vi.fn(() => contentType),
      statusCode: 400,
    });
    adapter.reply(reply, { statusCode: 400 }, 400);
    if (forcesJson) {
      expect(reply.header).toHaveBeenCalledWith(
        'Content-Type',
        'application/json',
      );
      expect(warn).toHaveBeenCalled();
    } else {
      expect(reply.header).not.toHaveBeenCalled();
    }
  });

  it('should ignore a non-string response content type', () => {
    const adapter = createAdapter();
    const reply = replyStub({
      getHeader: vi.fn(() => 123),
    });
    adapter.reply(reply, { statusCode: 500 });
    expect(reply.header).not.toHaveBeenCalled();
  });

  it.each([
    ['body statusCode', { statusCode: 400 }, undefined, false],
    ['status argument', { errors: [] }, 400, false],
    ['status argument without serializer', { errors: [] }, 400, true],
  ])('should classify an error body by %s', (_name, body, status, hasSerializer) => {
    const adapter = createAdapter();
    vi.spyOn(Logger, 'warn').mockImplementation(() => undefined);
    const reply = replyStub({
      getHeader: vi.fn(() => 'text/csv'),
      statusCode: status ?? 200,
    });
    if (hasSerializer) {
      // The reply serializer symbol is a module-level import.
      reply[fastifySymbols.kReplySerializer] = () => '';
    }
    adapter.reply(reply, body, status);
    expect(reply.send).toHaveBeenCalled();
  });

  it.each([
    ['stream', new PassThrough(), false],
    ['web stream', new ReadableStream(), false],
    ['Response', new Response('x'), false],
    ['typed array', new Uint8Array([1]), false],
  ])('should not force JSON for %s', (_name, body, _unused) => {
    const adapter = createAdapter();
    const reply = replyStub({ getHeader: vi.fn(() => 'text/csv'), statusCode: 400 });
    adapter.reply(reply, body, 400);
    expect(reply.header).not.toHaveBeenCalledWith(
      'Content-Type',
      'application/json',
    );
  });

  it('should set the status on a native response', () => {
    const adapter = createAdapter();
    const response: any = { statusCode: 200 };
    expect(adapter.status(response, 201)).toBe(response);
    expect(response.statusCode).toBe(201);
  });

  it('should set the status on a reply', () => {
    const adapter = createAdapter();
    const code = vi.fn(() => 'reply');
    const response: any = { code, status: vi.fn() };
    expect(adapter.status(response, 201)).toBe('reply');
    expect(code).toHaveBeenCalledWith(201);
  });

  it('should end a native response', () => {
    const adapter = createAdapter();
    const response: any = { end: vi.fn() };
    adapter.end(response, 'body');
    expect(response.end).toHaveBeenCalledWith('body');
  });

  it('should end the raw response of a reply', () => {
    const adapter = createAdapter();
    const response: any = { raw: { end: vi.fn() }, status: vi.fn() };
    adapter.end(response, 'body');
    expect(response.raw.end).toHaveBeenCalledWith('body');
  });

  it('should render a view when available', () => {
    const adapter = createAdapter();
    const view = vi.fn(() => 'html');
    expect(adapter.render({ view } as any, 'index', { a: 1 })).toBe('html');
    expect(view).toHaveBeenCalledWith('index', { a: 1 });
    expect(adapter.render(null as any, 'index', {})).toBeNull();
  });

  it('should redirect with the given or default status', () => {
    const adapter = createAdapter();
    const response: any = {
      status: vi.fn(() => response),
      redirect: vi.fn(() => 'ok'),
    };
    expect(adapter.redirect(response, 301, '/x')).toBe('ok');
    expect(response.status).toHaveBeenCalledWith(301);
    adapter.redirect(response, undefined as any, '/y');
    expect(response.status).toHaveBeenCalledWith(302);
  });

  it('should delegate error and not-found handlers', () => {
    const adapter = createAdapter();
    const setErrorHandler = vi.spyOn(adapter.getInstance(), 'setErrorHandler');
    const setNotFoundHandler = vi.spyOn(adapter.getInstance(), 'setNotFoundHandler');
    const handler = () => undefined;
    adapter.setErrorHandler(handler as any);
    adapter.setNotFoundHandler(handler);
    expect(setErrorHandler).toHaveBeenCalledWith(handler);
    expect(setNotFoundHandler).toHaveBeenCalledWith(handler);
  });

  it('should report whether headers were sent', () => {
    const adapter = createAdapter();
    expect(adapter.isHeadersSent({ headersSent: true } as any)).toBe(true);
    expect(adapter.isHeadersSent({ headersSent: false } as any)).toBe(false);
    expect(
      adapter.isHeadersSent({
        sent: true,
        raw: { headersSent: false },
        status: undefined,
      } as any),
    ).toBe(true);
    expect(
      adapter.isHeadersSent({
        sent: false,
        raw: { headersSent: true },
        status: undefined,
      } as any),
    ).toBe(true);
    expect(
      adapter.isHeadersSent({
        sent: false,
        raw: { headersSent: false },
        status: undefined,
      } as any),
    ).toBe(false);});

  it('should read and write headers on both response kinds', () => {
    const adapter = createAdapter();
    const reply: any = {
      getHeader: vi.fn(() => 'v'),
      header: vi.fn(),
      status: vi.fn(),
    };
    expect(adapter.getHeader(reply, 'x')).toBe('v');

    const native: any = { setHeader: vi.fn() };
    adapter.setHeader(native, 'x', '1');
    expect(native.setHeader).toHaveBeenCalledWith('x', '1');

    const reply2: any = { header: vi.fn(), status: vi.fn() };
    adapter.setHeader(reply2, 'x', '1');
    expect(reply2.header).toHaveBeenCalledWith('x', '1');
  });

  it('should append a header on a native response', () => {
    const adapter = createAdapter();
    const native: any = { getHeader: vi.fn(() => undefined), setHeader: vi.fn() };
    adapter.appendHeader(native, 'x', '1');
    expect(native.setHeader).toHaveBeenCalledWith('x', '1');

    native.getHeader.mockReturnValue('0');
    adapter.appendHeader(native, 'x', '1');
    expect(native.setHeader).toHaveBeenCalledWith('x', ['0', '1']);

    native.getHeader.mockReturnValue([0, 'a']);
    adapter.appendHeader(native, 'x', '1');
    expect(native.setHeader).toHaveBeenCalledWith('x', ['0', 'a', '1']);
  });

  it('should append a non-cookie header on a reply', () => {
    const adapter = createAdapter();
    const reply: any = {
      getHeader: vi.fn(() => undefined),
      header: vi.fn(),
      status: vi.fn(),
    };
    adapter.appendHeader(reply, 'x', '1');
    expect(reply.header).toHaveBeenCalledWith('x', '1');

    reply.getHeader.mockReturnValue('0');
    adapter.appendHeader(reply, 'x', '1');
    expect(reply.header).toHaveBeenCalledWith('x', ['0', '1']);

    reply.getHeader.mockReturnValue(['0', 'a']);
    adapter.appendHeader(reply, 'x', '1');
    expect(reply.header).toHaveBeenCalledWith('x', ['0', 'a', '1']);
  });

  it('should merge set-cookie headers into the reply and the raw response', () => {
    const adapter = createAdapter();
    const raw: any = { headersSent: false, setHeader: vi.fn() };
    const reply: any = {
      raw,
      getHeader: vi.fn(() => undefined),
      header: vi.fn(),
      removeHeader: vi.fn(),
      status: vi.fn(),
    };
    adapter.appendHeader(reply, 'Set-Cookie', 'a=1');
    expect(reply.removeHeader).toHaveBeenCalledWith('Set-Cookie');
    expect(reply.header).toHaveBeenCalledWith('Set-Cookie', ['a=1']);
    expect(raw.setHeader).toHaveBeenCalledWith('Set-Cookie', ['a=1']);

    reply.getHeader.mockReturnValue(['a=1', 'b=2']);
    adapter.appendHeader(reply, 'set-cookie', 'c=3');
    expect(reply.header).toHaveBeenCalledWith('set-cookie', [
      'a=1',
      'b=2',
      'c=3',
    ]);
  });

  it('should not touch the raw headers once they were sent', () => {
    const adapter = createAdapter();
    const raw: any = { headersSent: true, setHeader: vi.fn() };
    const reply: any = {
      raw,
      getHeader: vi.fn(() => 'a=1'),
      header: vi.fn(),
      removeHeader: vi.fn(),
      status: vi.fn(),
    };
    adapter.appendHeader(reply, 'Set-Cookie', 'b=2');
    expect(raw.setHeader).not.toHaveBeenCalled();
  });

  it('should read request metadata', () => {
    const adapter = createAdapter();
    expect(adapter.getRequestHostname({ hostname: 'x' } as any)).toBe('x');
    expect(adapter.getRequestMethod({ raw: { method: 'POST' } } as any)).toBe(
      'POST',
    );
    expect(adapter.getRequestMethod({ method: 'GET' } as any)).toBe('GET');
    expect(
      adapter.getRequestUrl({ raw: { originalUrl: '/a', url: '/b' } } as any),
    ).toBe('/a');
    expect(adapter.getRequestUrl({ raw: { url: '/b' } } as any)).toBe('/b');
    expect(adapter.getRequestUrl({ url: '/c' } as any)).toBe('/c');
  });
});

describe('body parsers', () => {
  it('should register the default parsers once with a prefix', () => {
    const adapter = createAdapter();
    adapter.registerParserMiddleware('api');
    expect(adapter.isParserRegistered).toBe(true);
    expect((adapter as any)._pathPrefix).toBe('/api');

    const addContentTypeParser = vi.spyOn(
      adapter.getInstance(),
      'addContentTypeParser',
    );
    adapter.registerParserMiddleware('other');
    expect(addContentTypeParser).not.toHaveBeenCalled();
  });

  it.each([
    [undefined, undefined],
    ['/api', '/api'],
    ['api', '/api'],
  ])('should normalize the prefix %j', (prefix, expected) => {
    const adapter = createAdapter();
    adapter.registerParserMiddleware(prefix as any);
    expect((adapter as any)._pathPrefix).toBe(expected);
  });

  it('should parse JSON and urlencoded bodies', async () => {
    const adapter = createAdapter();
    adapter.registerParserMiddleware();
    adapter.post('/json', (req: any) => req.body);
    adapter.post('/form', (req: any) => req.body);

    const json = await adapter.inject({
      method: 'POST',
      url: '/json',
      headers: { 'content-type': 'application/json' },
      payload: '{"a":1}',
    });
    expect(json.json()).toEqual({ a: 1 });

    const form = await adapter.inject({
      method: 'POST',
      url: '/form',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload: 'a=1&b=2',
    });
    expect(form.json()).toEqual({ a: '1', b: '2' });
  });

  it('should store the raw body when requested', async () => {
    const adapter = createAdapter();
    adapter.registerParserMiddleware(undefined, true);
    adapter.post('/raw', (req: any) => ({
      raw: req.rawBody?.toString(),
      body: req.body,
    }));
    const res = await adapter.inject({
      method: 'POST',
      url: '/raw',
      headers: { 'content-type': 'application/json' },
      payload: '{"a":1}',
    });
    expect(res.json()).toEqual({ raw: '{"a":1}', body: { a: 1 } });
  });

  it('should accept an array of content types', () => {
    const adapter = createAdapter();
    const parser = vi.fn((_req, _body, done) => done(null, 'parsed'));
    adapter.useBodyParser(['text/a', 'text/b'], false, {}, parser as any);
    const types = (adapter as any).registeredContentTypes;
    expect(types.has('text/a')).toBe(true);
    expect(types.has('text/b')).toBe(true);
  });

  it('should store a Buffer body when no parser is given', async () => {
    const adapter = createAdapter();
    adapter.useBodyParser('text/plain', false, {}, undefined);
    adapter.post('/plain', (req: any) => req.body.toString());
    const res = await adapter.inject({
      method: 'POST',
      url: '/plain',
      headers: { 'content-type': 'text/plain' },
      payload: 'hello',
    });
    expect(res.body).toBe('hello');
  });

  it('should use a custom parser', async () => {
    const adapter = createAdapter();
    adapter.useBodyParser('text/custom', false, undefined, ((_req, body, done) =>
      done(null, `custom:${body.toString()}`)) as any);
    adapter.post('/custom', (req: any) => req.body);
    const res = await adapter.inject({
      method: 'POST',
      url: '/custom',
      headers: { 'content-type': 'text/custom' },
      payload: 'x',
    });
    expect(res.body).toBe('custom:x');
  });

  it('should normalize content types before tracking them', () => {
    const adapter = createAdapter();
    adapter.useBodyParser(' Application/JSON ', false, {}, undefined);
    const types = (adapter as any).registeredContentTypes;
    expect(types.has('application/json')).toBe(true);
  });

  it('should not register the default JSON parser after a custom one', () => {
    const adapter = createAdapter();
    adapter.useBodyParser('application/json', false, {}, ((_r, _b, done) =>
      done(null, 'custom')) as any);
    const addContentTypeParser = vi.spyOn(
      adapter.getInstance(),
      'addContentTypeParser',
    );
    adapter.registerParserMiddleware();
    // Only the urlencoded parser is added; JSON was custom.
    expect(addContentTypeParser).toHaveBeenCalledTimes(1);
  });

  it('should detect a catch-all custom parser', () => {
    const adapter = createAdapter();
    adapter.useBodyParser('*', false, {}, undefined);
    const addContentTypeParser = vi.spyOn(
      adapter.getInstance(),
      'addContentTypeParser',
    );
    adapter.registerParserMiddleware();
    expect(addContentTypeParser).not.toHaveBeenCalled();
  });

  it('should detect a RegExp custom parser and reset lastIndex', () => {
    const adapter = createAdapter();
    adapter.useBodyParser(/^application\//, false, {}, undefined);
    const addContentTypeParser = vi.spyOn(
      adapter.getInstance(),
      'addContentTypeParser',
    );
    adapter.registerParserMiddleware();
    expect(addContentTypeParser).not.toHaveBeenCalled();
  });

  it('should not treat a non-matching RegExp as a custom parser', () => {
    const adapter = createAdapter();
    adapter.useBodyParser(/^text\/plain$/, false, {}, undefined);
    adapter.registerParserMiddleware();
    expect(adapter.isParserRegistered).toBe(true);
  });

  it('should parse JSON with the default Fastify parser', async () => {
    const adapter = createAdapter();
    const parser: any = (adapter as any).getDefaultBodyParser('application/json');
    const done = vi.fn();
    parser({} as any, Buffer.from('{"a":1}'), done);
    expect(done).toHaveBeenCalledWith(null, { a: 1 });
  });

  it('should default the poisoning options when they are falsy', () => {
    const adapter = createAdapter();
    const instance: any = adapter.getInstance();
    instance.initialConfig = {
      ...instance.initialConfig,
      onProtoPoisoning: '',
      onConstructorPoisoning: undefined,
    };
    const parser: any = (adapter as any).getDefaultBodyParser('application/json');
    const done = vi.fn();
    parser({} as any, Buffer.from('{"a":1}'), done);
    expect(done).toHaveBeenCalledWith(null, { a: 1 });
  });

  it('should parse urlencoded bodies with the default parser', () => {
    const adapter = createAdapter();
    const parser: any = (adapter as any).getDefaultBodyParser(
      'application/x-www-form-urlencoded',
    );
    const done = vi.fn();
    parser({} as any, Buffer.from('a=1&b=2'), done);
    expect(done).toHaveBeenCalledWith(null, { a: '1', b: '2' });
  });

  it('should have no default parser for other content types', () => {
    const adapter = createAdapter();
    expect((adapter as any).getDefaultBodyParser('text/plain')).toBeUndefined();
    expect(
      (adapter as any).getDefaultBodyParser(/^text\//),
    ).toBeUndefined();
  });
});

describe('middleware factory', () => {
  const setup = async (
    options: any = {},
    optionsModifier?: (adapter: FastifyAdapter) => void,
  ) => {
    const adapter = createAdapter(options);
    (adapter as any).isMiddieRegistered = true;
    optionsModifier?.(adapter);
    const use = vi.fn();
    (adapter.getInstance() as any).use = use;
    const factory = await (adapter as any).createMiddlewareFactory(
      RequestMethod.ALL,
    );
    return { adapter, factory, use };
  };

  it('should register middie when it is not registered yet', async () => {
    const adapter = createAdapter();
    const registerMiddie = vi
      .spyOn(adapter as any, 'registerMiddie')
      .mockResolvedValue(undefined);
    (adapter.getInstance() as any).use = vi.fn();
    await (adapter as any).createMiddlewareFactory(RequestMethod.ALL);
    expect(registerMiddie).toHaveBeenCalled();
  });

  it('should strip the end-of-string marker', async () => {
    const { adapter, factory } = await setup();
    const callback = vi.fn();
    factory('/users$', callback);
    const middleware = (adapter.getInstance().use as any).mock.calls[0][1];
    const req: any = { originalUrl: '/users' };
    const next = vi.fn();
    middleware(req, {}, next);
    expect(callback).toHaveBeenCalledWith(req, {}, expect.any(Function));
  });

  it('should fall back to the wildcard route', async () => {
    const { factory } = await setup();
    factory('/*', vi.fn());
    expect((factory as any)).toBeTypeOf('function');
  });

  it('should map a legacy repeating parameter to the *path fallback', async () => {
    const { factory, use } = await setup();
    factory('/+', vi.fn());
    expect(use).toHaveBeenCalledWith('*path', expect.any(Function));
  });

  it('should add the application prefix for the root path', async () => {
    const { adapter, factory, use } = await setup({});
    adapter.registerParserMiddleware('api');
    factory('/', vi.fn());
    expect(use).toHaveBeenCalledWith('/api/{*path}', expect.any(Function));
  });

  it('should add the application prefix for an empty path', async () => {
    const { adapter, factory, use } = await setup({});
    adapter.registerParserMiddleware('api');
    factory('', vi.fn());
    expect(use).toHaveBeenCalledWith('/api', expect.any(Function));
  });

  it('should not match a request outside the middleware path', async () => {
    const { adapter, factory } = await setup();
    const callback = vi.fn();
    factory('/users', callback);
    const middleware = (adapter.getInstance().use as any).mock.calls[0][1];
    const next = vi.fn();
    middleware({ originalUrl: '/other' }, {}, next);
    expect(next).toHaveBeenCalled();
    expect(callback).not.toHaveBeenCalled();
  });

  it('should run the middleware for a matching path through the query', async () => {
    const { adapter, factory } = await setup();
    const callback = vi.fn();
    factory('/users', callback);
    const middleware = (adapter.getInstance().use as any).mock.calls[0][1];
    const req: any = { originalUrl: '/users?a=1' };
    middleware(req, {}, vi.fn());
    expect(callback).toHaveBeenCalled();
  });

  it('should match a request path that already ends with a slash', async () => {
    const { adapter, factory } = await setup();
    const callback = vi.fn();
    factory('/users', callback);
    const middleware = (adapter.getInstance().use as any).mock.calls[0][1];
    middleware({ originalUrl: '/users/' }, {}, vi.fn());
    expect(callback).toHaveBeenCalled();
  });

  it('should strip the path on a case-insensitive router', async () => {
    const { adapter, factory } = await setup({ caseSensitive: false });
    const callback = vi.fn();
    factory('/USERS', callback);
    const middleware = (adapter.getInstance().use as any).mock.calls[0][1];
    const req: any = { originalUrl: '/users?x=1' };
    middleware(req, {}, vi.fn());
    expect(req.url).toBe('/?x=1');
  });

  it('should set req.url to "/" when the case-insensitive match has no suffix', async () => {
    const { adapter, factory } = await setup({ caseSensitive: false });
    const callback = vi.fn();
    factory('/users', callback);
    const middleware = (adapter.getInstance().use as any).mock.calls[0][1];
    const req: any = { originalUrl: '/users' };
    middleware(req, {}, vi.fn());
    expect(req.url).toBe('/');
  });

  it('should register the middleware on tracked middie contexts', async () => {
    const { adapter, factory } = await setup();
    const context = { use: vi.fn() };
    (adapter as any).middieContexts.push(context);
    const callback = vi.fn();
    factory('/users', callback);
    expect(context.use).toHaveBeenCalled();
  });

  it('should run middleware for an empty normalized path', async () => {
    const { adapter, factory } = await setup();
    const callback = vi.fn();
    factory('', callback);
    const middleware = (adapter.getInstance().use as any).mock.calls[0][1];
    const req: any = { originalUrl: '/' };
    middleware(req, {}, vi.fn());
    expect(callback).toHaveBeenCalled();
  });

  it('should run a middleware that returns a non-thenable', async () => {
    const { factory } = await setup();
    const callback = vi.fn(() => 42);
    factory('/x', callback);
    const middleware = callback;
    const next = vi.fn();
    (createAdapter() as any).runMiddleware(middleware, {}, {}, next);
    expect(next).not.toHaveBeenCalled();
  });

  it('should pass a thrown middleware error to next', () => {
    const adapter = createAdapter();
    const error = new Error('middleware');
    const next = vi.fn();
    (adapter as any).runMiddleware(() => {
      throw error;
    }, {}, {}, next);
    expect(next).toHaveBeenCalledWith(error);
  });

  it('should pass a rejected middleware promise to next', async () => {
    const adapter = createAdapter();
    const error = new Error('async middleware');
    const next = vi.fn();
    (adapter as any).runMiddleware(
      () => Promise.reject(error),
      {},
      {},
      next,
    );
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(next).toHaveBeenCalledWith(error);
  });

  it('should use a Fastify error when a middleware rejects without a reason', async () => {
    const adapter = createAdapter();
    const next = vi.fn();
    (adapter as any).runMiddleware(() => Promise.reject(undefined), {}, {}, next);
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });

  it('should log a late middleware rejection after next was called', async () => {
    const adapter = createAdapter();
    const log = vi.spyOn((adapter as any).logger, 'error').mockImplementation(
      () => undefined,
    );
    const next = vi.fn();
    (adapter as any).runMiddleware(
      (_req: any, _res: any, done: any) => {
        done();
        return Promise.reject(new Error('late'));
      },
      {},
      {},
      next,
    );
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(log).toHaveBeenCalled();
  });

  it('should not call next for a resolved middleware promise', async () => {
    const adapter = createAdapter();
    const next = vi.fn();
    (adapter as any).runMiddleware(
      () => Promise.resolve('done'),
      {},
      {},
      next,
    );
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(next).not.toHaveBeenCalled();
  });

  it('should call next only once', () => {
    const adapter = createAdapter();
    const next = vi.fn();
    (adapter as any).runMiddleware(
      (_req: any, _res: any, done: any) => {
        done();
        done();
      },
      {},
      {},
      next,
    );
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('should report and rethrow an invalid middleware path', async () => {
    const { factory } = await setup();
    const printError = vi
      .spyOn(LegacyRouteConverter, 'printError')
      .mockImplementation(() => undefined);
    expect(() => factory('/users/{', vi.fn())).toThrow(TypeError);
    expect(printError).toHaveBeenCalledWith('/users/{');
  });

  it('should not report a non-TypeError thrown while registering', async () => {
    const { adapter, factory, use } = await setup();
    use.mockImplementation(() => {
      throw new Error('registration failed');
    });
    const printError = vi
      .spyOn(LegacyRouteConverter, 'printError')
      .mockImplementation(() => undefined);
    expect(() => factory('/users', vi.fn())).toThrow('registration failed');
    expect(printError).not.toHaveBeenCalled();
  });
});

describe('URL normalization', () => {
  const adapter = () => createAdapter();
  const sanitize = (instance: FastifyAdapter, url: string) =>
    (instance as any).sanitizeUrl(url);

  it('should leave a normal path untouched', () => {
    expect(sanitize(adapter(), '/users')).toBe('/users');
  });

  it('should resolve an absolute-form target', () => {
    expect(sanitize(adapter(), 'http://host/users')).toBe('/users');
    expect(sanitize(adapter(), 'https://host/users')).toBe('/users');
  });

  it('should resolve an absolute-form target with a query only', () => {
    // sanitizeUrl() drops the query when it decodes the path.
    expect(sanitize(adapter(), 'http://host?a=b')).toBe('/');
  });

  it('should leave a malformed absolute target untouched', () => {
    expect(sanitize(adapter(), 'http://host/users')).toBe('/users');
    expect(sanitize(adapter(), 'ftp://host/users')).toBe('ftp://host/users');
    expect(sanitize(adapter(), 'host/users')).toBe('host/users');
  });

  it('should lower-case paths on a case-insensitive router', () => {
    const instance = createAdapter({ caseSensitive: false });
    expect(sanitize(instance, '/USERS')).toBe('/users');
  });

  it('should remove duplicate slashes when configured on routerOptions', () => {
    const instance = createAdapter({ routerOptions: { ignoreDuplicateSlashes: true } });
    expect(sanitize(instance, '/a//b///c')).toBe('/a/b/c');
  });

  it('should remove duplicate slashes when configured at the top level', () => {
    const instance = createAdapter({ ignoreDuplicateSlashes: true });
    expect(sanitize(instance, '/a//b')).toBe('/a/b');
  });

  it('should read duplicate-slash options from initialConfig without routerOptions', () => {
    const instance = createAdapter();
    (instance.getInstance() as any).initialConfig = {
      routerOptions: undefined,
      ignoreDuplicateSlashes: true,
      caseSensitive: true,
      ignoreTrailingSlash: false,
    };
    expect(sanitize(instance, '/a//b')).toBe('/a/b');
  });

  it('should trim the trailing slash when configured', () => {
    const instance = createAdapter({ ignoreTrailingSlash: true });
    expect(sanitize(instance, '/a/')).toBe('/a');
  });

  it('should keep the root slash', () => {
    expect((adapter() as any).trimLastSlash('/')).toBe('/');
    expect((adapter() as any).trimLastSlash('/a')).toBe('/a');
  });

  it('should not change paths without duplicate slashes', () => {
    expect((adapter() as any).removeDuplicateSlashes('/a/b')).toBe('/a/b');
  });

  describe('getPathFromRequestTarget', () => {
    const target = (url: string) =>
      (adapter() as any).getPathFromRequestTarget(url);

    it.each([
      ['/users', '/users'],
      ['*users', '*users'],
      ['http://host/users', '/users'],
      ['https://host/users?x=1', '/users?x=1'],
      ['http://host', '/'],
      ['https://host?a=/users', 'https://host?a=/users'],
      ['ftp://host/users', 'ftp://host/users'],
      ['host/users', 'host/users'],
      ['http:///users', 'http:///users'],
    ])('should resolve %s to %s', (url, expected) => {
      expect(target(url)).toBe(expected);
    });
  });

  it('should classify routable request targets', () => {
    const instance = adapter();
    expect((instance as any).isRoutableRequestTarget(undefined)).toBe(false);
    expect((instance as any).isRoutableRequestTarget('')).toBe(false);
    expect((instance as any).isRoutableRequestTarget('*users')).toBe(false);
    expect((instance as any).isRoutableRequestTarget('/users')).toBe(true);
    expect(
      (instance as any).isRoutableRequestTarget('http://host/users'),
    ).toBe(true);
  });
});

describe('use', () => {
  it('should queue middleware before middie is registered', async () => {
    const adapter = createAdapter();
    const result = adapter.use(() => undefined);
    expect(result).toBe(adapter);
    expect((adapter as any).pendingMiddlewares).toHaveLength(1);
  });

  it('should delegate middleware after middie is registered', async () => {
    const adapter = createAdapter();
    (adapter as any).isMiddieRegistered = true;
    const use = vi.fn();
    (adapter.getInstance() as any).use = use;
    const middleware = () => undefined;
    adapter.use(middleware);
    expect(use).toHaveBeenCalledWith(middleware);
  });
});

describe('mapException', () => {
  it('should map a 4xx FastifyError to an HttpException', () => {
    const adapter = createAdapter();
    const FastifyError = createError('FST_ERR_TEST', 'boom', 400);
    const error = new FastifyError();
    const mapped = adapter.mapException(error) as HttpException;
    expect(mapped).toBeInstanceOf(HttpException);
    expect(mapped.getStatus()).toBe(400);
    expect(mapped.message).toBe('boom');
  });

  it('should keep a 5xx FastifyError unmapped', () => {
    const adapter = createAdapter();
    const FastifyError = createError('FST_ERR_TEST_5', 'boom', 500);
    const error = new FastifyError();
    expect(adapter.mapException(error)).toBe(error);
  });

  it('should map a 4xx http-errors instance', () => {
    const adapter = createAdapter();
    const error = createHttpError(413, 'too large');
    const mapped = adapter.mapException(error) as HttpException;
    expect(mapped.getStatus()).toBe(413);
    expect(mapped.message).toBe('too large');
  });

  it('should hide the message of a non-exposed http-errors instance', () => {
    const adapter = createAdapter();
    const error = createHttpError(400, 'secret', { expose: false });
    const mapped = adapter.mapException(error) as HttpException;
    expect(mapped.message).toBe('Bad Request');
  });

  it('should fall back to a generic text for an unknown non-exposed status', () => {
    const adapter = createAdapter();
    const error = Object.assign(new Error('secret'), {
      statusCode: 499,
      status: 499,
      expose: false,
    });
    const mapped = adapter.mapException(error) as HttpException;
    expect(mapped.getStatus()).toBe(499);
    expect(mapped.message).toBe('Internal server error');
  });

  it('should keep a 5xx http-errors instance unmapped', () => {
    const adapter = createAdapter();
    const error = createHttpError(500, 'boom');
    expect(adapter.mapException(error)).toBe(error);
  });

  it('should keep an unknown error unmapped', () => {
    const adapter = createAdapter();
    const error = new Error('unknown');
    expect(adapter.mapException(error)).toBe(error);
  });

  it('should not treat a plain FastifyError-shaped object as a FastifyError', () => {
    const adapter = createAdapter();
    const error = { statusCode: 400, name: 'FastifyError' };
    expect(adapter.mapException(error)).toBe(error);
  });

  it('should not treat an http-errors-like object with a mismatched status as http-errors', () => {
    const adapter = createAdapter();
    const error = Object.assign(new Error('x'), {
      statusCode: 400,
      status: 401,
      expose: true,
    });
    expect(adapter.mapException(error)).toBe(error);
  });
});

describe('route options injection', () => {
  const setup = () => {
    const adapter = createAdapter();
    const instance = adapter.getInstance();
    const route = vi.spyOn(instance, 'route').mockReturnValue(undefined as any);
    return { adapter, instance, route };
  };

  it('should register a plain route', () => {
    const { adapter, route } = setup();
    const handler = () => undefined;
    (adapter as any).injectRouteOptions('GET', '/x', handler);
    expect(route).toHaveBeenCalledWith({
      method: 'GET',
      url: '/x',
      handler,
    });
  });

  it('should inject config, constraints and schema metadata', () => {
    const { adapter, route } = setup();
    const handler: any = () => undefined;
    Reflect.defineMetadata(FASTIFY_ROUTE_CONFIG_METADATA, { cache: 1 }, handler);
    Reflect.defineMetadata(
      FASTIFY_ROUTE_CONSTRAINTS_METADATA,
      { host: 'x' },
      handler,
    );
    Reflect.defineMetadata(FASTIFY_ROUTE_SCHEMA_METADATA, { body: {} }, handler);

    (adapter as any).injectRouteOptions('GET', '/x', handler);
    expect(route).toHaveBeenCalledWith({
      method: 'GET',
      url: '/x',
      handler,
      constraints: { host: 'x' },
      config: { cache: 1 },
      schema: { body: {} },
    });
  });

  it('should inject the version constraint for a versioned handler', () => {
    const { adapter, route } = setup();
    const handler: any = () => undefined;
    handler.version = '2';
    (adapter as any).injectRouteOptions('GET', '/x', handler);
    expect(route).toHaveBeenCalledWith(
      expect.objectContaining({ constraints: { version: '2' } }),
    );
  });

  it('should not treat VERSION_NEUTRAL as a version', () => {
    const { adapter, route } = setup();
    const handler: any = () => undefined;
    handler.version = VERSION_NEUTRAL;
    (adapter as any).injectRouteOptions('GET', '/x', handler);
    expect(route).toHaveBeenCalledWith({
      method: 'GET',
      url: '/x',
      handler,
    });
  });

  it('should not build route options when the path is not a tuple', () => {
    const { adapter, route } = setup();
    const handler: any = () => undefined;
    handler.version = '2';
    (adapter as any).injectRouteOptions('GET', '/x', {}, handler);
    expect(route).toHaveBeenCalledWith({
      method: 'GET',
      url: '/x',
      handler,
    });
  });

  it('should add an unsupported HTTP method', () => {
    const { adapter, instance } = setup();
    const addHttpMethod = vi.spyOn(instance, 'addHttpMethod');
    (adapter as any).injectRouteOptions('SEARCH', '/x', () => undefined);
    expect(addHttpMethod).toHaveBeenCalledWith('SEARCH', { hasBody: true });
  });

  it('should not add a supported HTTP method', () => {
    const { adapter, instance } = setup();
    const addHttpMethod = vi.spyOn(instance, 'addHttpMethod');
    (adapter as any).injectRouteOptions('GET', '/x', () => undefined);
    expect(addHttpMethod).not.toHaveBeenCalled();
  });

  it('should accept an array of methods', () => {
    const { adapter, instance, route } = setup();
    const addHttpMethod = vi.spyOn(instance, 'addHttpMethod');
    (adapter as any).injectRouteOptions(['GET', 'POST'], '/x', () => undefined);
    expect(addHttpMethod).not.toHaveBeenCalled();
    expect(route).toHaveBeenCalled();
  });
});

describe('requireNonEmptyParams', () => {
  const adapter = () => createAdapter();

  it('should keep the handler for a URL without parameters', () => {
    const handler = () => 'ok';
    expect((adapter() as any).requireNonEmptyParams('/x', handler)).toBe(handler);
  });

  it('should keep the handler for a non-string URL without parameters', () => {
    const handler = () => 'ok';
    const wrapped = (adapter() as any).requireNonEmptyParams(['GET'], handler);
    expect(wrapped).not.toBe(handler);
    expect(wrapped({ params: {} }, {})).toBe('ok');
  });

  it('should wrap a parameterized route and keep the handler name', () => {
    const handler = function namedHandler() {
      return 'ok';
    };
    const wrapped = (adapter() as any).requireNonEmptyParams('/x/:id', handler);
    expect(wrapped).not.toBe(handler);
    expect(wrapped.name).toBe('namedHandler');
  });

  it('should call the handler when parameters are non-empty or the wildcard', () => {
    const handler = vi.fn(() => 'ok');
    const wrapped = (adapter() as any).requireNonEmptyParams('/x/:id', handler);
    const reply = { callNotFound: vi.fn() };
    expect(wrapped({ params: { id: '1', '*': '' } }, reply)).toBe('ok');
    expect(handler).toHaveBeenCalled();
    expect(reply.callNotFound).not.toHaveBeenCalled();
  });

  it('should call the not-found handler for an empty parameter', () => {
    const handler = vi.fn(() => 'ok');
    const wrapped = (adapter() as any).requireNonEmptyParams('/x/:id', handler);
    const reply = { callNotFound: vi.fn() };
    expect(wrapped({ params: { id: '' } }, reply)).toBeUndefined();
    expect(handler).not.toHaveBeenCalled();
    expect(reply.callNotFound).toHaveBeenCalled();
  });
});

describe('registerWithPrefix and misc', () => {
  it('should register with a default and custom prefix', () => {
    const adapter = createAdapter();
    const register = vi
      .spyOn(adapter.getInstance(), 'register')
      .mockReturnValue(undefined as any);
    const factory = () => undefined;
    (adapter as any).registerWithPrefix(factory);
    expect(register).toHaveBeenCalledWith(factory, { prefix: '/' });
    (adapter as any).registerWithPrefix(factory, '/api');
    expect(register).toHaveBeenCalledWith(factory, { prefix: '/api' });
  });

  it('should register middie and track encapsulated contexts', async () => {
    const adapter = createAdapter();
    const register = vi
      .spyOn(adapter, 'register')
      .mockResolvedValue(undefined as any);
    const addHook = vi.spyOn(adapter.getInstance(), 'addHook');
    await (adapter as any).registerMiddie();
    expect(register).toHaveBeenCalled();
    expect((adapter as any).isMiddieRegistered).toBe(true);

    const hook = addHook.mock.calls.find(call => call[0] === 'onRegister')![1];
    const context = {};
    hook(context);
    expect((adapter as any).middieContexts).toContain(context);
  });

  it('should resolve the original URL', () => {
    const adapter = createAdapter();
    expect(
      (adapter as any).getRequestOriginalUrl({ originalUrl: '/a', url: '/b' }),
    ).toBe('/a');
    expect((adapter as any).getRequestOriginalUrl({ url: '/b' })).toBe('/b');
  });

  it('should delegate inject', async () => {
    const adapter = createAdapter();
    adapter.get('/', () => 'ok');
    expect((await adapter.inject('/')).statusCode).toBe(200);
    expect((await adapter.inject({ method: 'GET', url: '/' })).statusCode).toBe(
      200,
    );
    const chain = adapter.inject();
    expect(chain).toBeDefined();
    const response = await chain.get('/');
    expect(response.statusCode).toBe(200);
  });
});
