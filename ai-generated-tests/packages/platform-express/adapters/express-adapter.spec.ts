/**
 * CFT planning inventory for packages/platform-express/adapters/express-adapter.ts.
 * Decisions are numbered separately inside each function in source order.
 * xc1/xc2 identify atomic operands; &&/|| short-circuit before the next operand.
 * Loop and case guards count as decisions. Fallback operands are syntactic
 * planning entries, not independent boolean conditions. P=D+1 follows the
 * requested planning rule; these counts do not prove executable independent paths.
 * Cases exercise feasible T/F and error paths. V8 measures branch coverage,
 * not C3 or MC/DC directly. Nested callbacks have their own entries below.
 * isJsonContentType @L58: syntactic D=2, planning P=D+1=3.
 *   logical/fallback expression: 1c1=mediaType.startsWith('application/json') | 1c2=mediaType.endsWith('+json')
 * ExpressAdapter.constructor @L86: syntactic D=2, planning P=D+1=3.
 *   logical/fallback expression: 1c1=instance | 1c2=express()
 * callback @L88: syntactic D=2, planning P=D+1=3.
 *   if: 1=this.onResponseHook
 *   if: 2=this.onRequestHook
 * callback @L90: syntactic D=0, planning P=D+1=1.
 * ExpressAdapter.runRequestHook @L107: syntactic D=4, planning P=D+1=5.
 *   if: 1c1=result | 1c2=typeof result.then === 'function'
 *   logical/fallback expression: 2c1=err | 2c2=new Error('Request hook failed')
 * doneOnce @L113: syntactic D=2, planning P=D+1=3.
 *   if: 1=completed
 *   if: 2=err
 * callback @L128: syntactic D=2, planning P=D+1=3.
 *   logical/fallback expression: 1c1=err | 1c2=new Error('Request hook failed')
 * ExpressAdapter.setOnRequestHook @L143: syntactic D=0, planning P=D+1=1.
 * ExpressAdapter.setOnResponseHook @L157: syntactic D=0, planning P=D+1=1.
 * ExpressAdapter.reply @L166: syntactic D=17, planning P=D+1=18.
 *   if: 1=!isNil(statusCode)
 *   if: 2=isNil(body)
 *   if: 3=body instanceof StreamableFile
 *   if: 4=errored
 *   if: 5=response.req?.method === 'HEAD'
 *   if: 6=stream.readableEnded
 *   if: 7c1=body instanceof Error | 7c2=response.statusCode >= HttpStatus.BAD_REQUEST
 *   logical/fallback expression: 8c1=http.STATUS_CODES[response.statusCode] | 8c2='Error'
 *   if: 9c1=typeof responseContentType === 'string' | 9c2=!isJsonContentType(responseContentType) | 9c3=body?.statusCode >= HttpStatus.BAD_REQUEST | 9c4=isObject(body) | 9c5=!isNil(statusCode) | 9c6=statusCode >= HttpStatus.BAD_REQUEST
 *   conditional: 10=isObject(body)
 * callback @L182: syntactic D=0, planning P=D+1=1.
 * callback @L187: syntactic D=1, planning P=D+1=2.
 *   if: 1=!stream.readableEnded
 * end @L197: syntactic D=0, planning P=D+1=1.
 * callback @L203: syntactic D=0, planning P=D+1=1.
 * callback @L207: syntactic D=0, planning P=D+1=1.
 * ExpressAdapter.status @L239: syntactic D=0, planning P=D+1=1.
 * ExpressAdapter.end @L243: syntactic D=0, planning P=D+1=1.
 * ExpressAdapter.render @L247: syntactic D=0, planning P=D+1=1.
 * ExpressAdapter.redirect @L251: syntactic D=0, planning P=D+1=1.
 * ExpressAdapter.setErrorHandler @L255: syntactic D=1, planning P=D+1=2.
 *   if: 1=normalizedPrefix
 * ExpressAdapter.setNotFoundHandler @L268: syntactic D=2, planning P=D+1=3.
 *   if: 1=normalizedPrefix
 *   loop: 2=next iteration
 * callback @L291: syntactic D=3, planning P=D+1=4.
 *   loop: 1=next iteration
 *   if: 2c1=path === registeredPrefix | 2c2=path.startsWith(`${registeredPrefix}/`)
 * ExpressAdapter.isHeadersSent @L316: syntactic D=0, planning P=D+1=1.
 * ExpressAdapter.getHeader @L320: syntactic D=0, planning P=D+1=1.
 * ExpressAdapter.setHeader @L324: syntactic D=0, planning P=D+1=1.
 * ExpressAdapter.appendHeader @L328: syntactic D=0, planning P=D+1=1.
 * ExpressAdapter.normalizePath @L332: syntactic D=1, planning P=D+1=2.
 *   if: 1=e instanceof TypeError
 * ExpressAdapter.listen @L352: syntactic D=0, planning P=D+1=1.
 * ExpressAdapter.beforeClose @L356: syntactic D=0, planning P=D+1=1.
 * ExpressAdapter.close @L360: syntactic D=1, planning P=D+1=2.
 *   if: 1=!this.httpServer
 * callback @L367: syntactic D=0, planning P=D+1=1.
 * ExpressAdapter.set @L370: syntactic D=0, planning P=D+1=1.
 * ExpressAdapter.enable @L374: syntactic D=0, planning P=D+1=1.
 * ExpressAdapter.disable @L378: syntactic D=0, planning P=D+1=1.
 * ExpressAdapter.engine @L382: syntactic D=0, planning P=D+1=1.
 * ExpressAdapter.useStaticAssets @L386: syntactic D=2, planning P=D+1=3.
 *   if: 1c1=options | 1c2=options.prefix
 * ExpressAdapter.setBaseViewsDir @L393: syntactic D=0, planning P=D+1=1.
 * ExpressAdapter.setViewEngine @L397: syntactic D=0, planning P=D+1=1.
 * ExpressAdapter.getRequestHostname @L401: syntactic D=0, planning P=D+1=1.
 * ExpressAdapter.getRequestMethod @L405: syntactic D=0, planning P=D+1=1.
 * ExpressAdapter.getRequestUrl @L409: syntactic D=0, planning P=D+1=1.
 * ExpressAdapter.enableCors @L413: syntactic D=0, planning P=D+1=1.
 * ExpressAdapter.createMiddlewareFactory @L417: syntactic D=0, planning P=D+1=1.
 * callback @L420: syntactic D=7, planning P=D+1=8.
 *   conditional: 1=isExactPath
 *   if: 2c1=isExactPath | 2c2=router === this.instance.use
 *   if: 3c1=this.instance.router?.strict | 3c2=convertedPath.length > 1 | 3c3=convertedPath.endsWith('/')
 *   if: 4=e instanceof TypeError
 * ExpressAdapter.initHttpServer @L457: syntactic D=5, planning P=D+1=6.
 *   logical/fallback expression: 1c1=options | 1c2=options.httpsOptions
 *   if: 2=isHttpsEnabled
 *   if: 3=options?.return503OnClosing
 *   if: 4=options?.forceCloseConnections
 * callback @L469: syntactic D=1, planning P=D+1=2.
 *   if: 1=this.isShuttingDown
 * ExpressAdapter.registerParserMiddleware @L484: syntactic D=0, planning P=D+1=1.
 * callback @L497: syntactic D=0, planning P=D+1=1.
 * callback @L498: syntactic D=0, planning P=D+1=1.
 * ExpressAdapter.useBodyParser @L501: syntactic D=0, planning P=D+1=1.
 * ExpressAdapter.setLocal @L514: syntactic D=0, planning P=D+1=1.
 * ExpressAdapter.getType @L519: syntactic D=0, planning P=D+1=1.
 * ExpressAdapter.isRouteOrderSensitive @L523: syntactic D=0, planning P=D+1=1.
 * ExpressAdapter.getRouteMatchingOptions @L529: syntactic D=0, planning P=D+1=1.
 * ExpressAdapter.applyVersionFilter @L543: syntactic D=5, planning P=D+1=6.
 *   if: 1c1=version === VERSION_NEUTRAL | 1c2=versioningOptions.type === VersioningType.URI
 *   if: 2=versioningOptions.type === VersioningType.CUSTOM
 *   if: 3=versioningOptions.type === VersioningType.MEDIA_TYPE
 *   if: 4=versioningOptions.type === VersioningType.HEADER
 * callNextHandler @L548: syntactic D=1, planning P=D+1=2.
 *   if: 1=!next
 * handlerForNoVersioning @L562: syntactic D=0, planning P=D+1=1.
 * handlerForCustomVersioning @L570: syntactic D=10, planning P=D+1=11.
 *   if: 1=Array.isArray(version)
 *   if: 2c1=Array.isArray(extractedVersion) | 2c2=version.filter(v => extractedVersion.includes(v as string)).length
 *   if: 3c1=isString(extractedVersion) | 3c2=version.includes(extractedVersion)
 *   if: 4=isString(version)
 *   if: 5c1=Array.isArray(extractedVersion) | 5c2=extractedVersion.includes(version)
 *   if: 6c1=isString(extractedVersion) | 6c2=version === extractedVersion
 * callback @L576: syntactic D=0, planning P=D+1=1.
 * handlerForMediaTypeVersioning @L612: syntactic D=9, planning P=D+1=10.
 *   logical/fallback expression: 1c1=req.headers?.[MEDIA_TYPE_HEADER] | 1c2=req.headers?.[MEDIA_TYPE_HEADER.toLowerCase()]
 *   if: 2=isUndefined(headerVersion)
 *   if: 3=Array.isArray(version)
 *   if: 4=version.includes(VERSION_NEUTRAL)
 *   if: 5=Array.isArray(version)
 *   if: 6=version.includes(headerVersion)
 *   if: 7=isString(version)
 *   if: 8=version === headerVersion
 * handlerForHeaderVersioning @L654: syntactic D=9, planning P=D+1=10.
 *   logical/fallback expression: 1c1=req.headers?.[versioningOptions.header] | 1c2=req.headers?.[versioningOptions.header.toLowerCase()]
 *   if: 2=isUndefined(customHeaderVersionParameter)
 *   if: 3=Array.isArray(version)
 *   if: 4=version.includes(VERSION_NEUTRAL)
 *   if: 5=Array.isArray(version)
 *   if: 6=version.includes(customHeaderVersionParameter)
 *   if: 7=isString(version)
 *   if: 8=version === customHeaderVersionParameter
 * ExpressAdapter.mapException @L687: syntactic D=7, planning P=D+1=8.
 *   case: 1c1=error instanceof SyntaxError | 1c2=error instanceof URIError
 *   case: 2c1=isHttpError(error) | 2c2=error.statusCode < 500
 *   conditional: 3=error.expose === false
 *   logical/fallback expression: 4c1=http.STATUS_CODES[error.statusCode] | 4c2='Internal server error'
 * ExpressAdapter.normalizePrefix @L715: syntactic D=0, planning P=D+1=1.
 * ExpressAdapter.trackOpenConnections @L719: syntactic D=0, planning P=D+1=1.
 * callback @L720: syntactic D=0, planning P=D+1=1.
 * callback @L723: syntactic D=0, planning P=D+1=1.
 * ExpressAdapter.closeOpenConnections @L727: syntactic D=1, planning P=D+1=2.
 *   loop: 1=next iteration
 * ExpressAdapter.isMiddlewareApplied @L734: syntactic D=4, planning P=D+1=5.
 *   logical/fallback expression: 1c1=!!app.router | 1c2=!!app.router.stack | 1c3=isFunction(app.router.stack.filter) | 1c4=app.router.stack.some( (layer: any) => layer && layer.handle && layer.handle.name === name, )
 * callback @L741: syntactic D=3, planning P=D+1=4.
 *   logical/fallback expression: 1c1=layer | 1c2=layer.handle | 1c3=layer.handle.name === name
 * ExpressAdapter.setHeaderIfNotExists @L746: syntactic D=3, planning P=D+1=4.
 *   if: 1c1=value !== undefined | 1c2=response.getHeader(name) === undefined
 *   conditional: 2=Array.isArray(value)
 * ExpressAdapter.applyStreamHeaders @L757: syntactic D=1, planning P=D+1=2.
 *   if: 1=response.getHeader('Transfer-Encoding') === undefined
 * isHttpError @L777: syntactic D=5, planning P=D+1=6.
 *   logical/fallback expression: 1c1=isObject(err) | 1c2=err instanceof Error | 1c3=typeof (err as any).expose === 'boolean' | 1c4=typeof (err as any).statusCode === 'number' | 1c5=(err as any).status === (err as any).statusCode
 */
import { afterEach, describe, it, vi } from 'vitest';
import {
  Logger,
  RequestMethod,
  StreamableFile,
  VERSION_NEUTRAL,
  VersioningType,
} from '@nestjs/common';
import express from 'express';
import request from 'supertest';
import { EventEmitter } from 'node:events';
import { Socket } from 'node:net';
import { PassThrough, Readable, Writable } from 'node:stream';
import { finished } from 'node:stream/promises';
import { ExpressAdapter } from '../../../../packages/platform-express/adapters/express-adapter.js';
import { LegacyRouteConverter } from '../../../../packages/core/router/legacy-route-converter.js';

const adapters: ExpressAdapter[] = [];
function adapter(instance?: any): any {
  const value = new ExpressAdapter(instance);
  adapters.push(value);
  return value;
}

class TestResponse extends Writable {
  headers: Record<string, any>;
  statusCode = 200;
  req: any;
  body: unknown;
  constructor(headers: Record<string, any> = {}, method = 'GET') {
    super({
      write(_chunk, _encoding, callback) {
        callback();
      },
    });
    this.headers = Object.fromEntries(
      Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]),
    );
    this.req = { method };
    this.on('error', () => undefined);
  }
  getHeader(name: string) {
    return this.headers[name.toLowerCase()];
  }
  setHeader(name: string, value: any) {
    this.headers[name.toLowerCase()] = value;
    return this;
  }
  get(name: string) {
    return this.getHeader(name);
  }
  set(name: string, value: any) {
    return this.setHeader(name, value);
  }
  append(name: string, value: any) {
    this.setHeader(
      name,
      [this.getHeader(name), value].filter(item => item !== undefined).flat(),
    );
    return this;
  }
  status(code: number) {
    this.statusCode = code;
    return this;
  }
  send(body?: unknown) {
    this.body = body;
    this.end();
    return this;
  }
  json(body: unknown) {
    return this.send(body);
  }
  render(view: string, options: unknown) {
    return { view, options };
  }
  redirect(code: number, url: string) {
    return { code, url };
  }
}

async function errorPath(operation: () => unknown | Promise<unknown>) {
  try {
    await operation();
  } catch (error) {
    if (!(error instanceof Error)) throw error;
  }
}

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(adapters.splice(0).map(value => value.close()));
});

describe('ExpressAdapter lifecycle hooks', () => {
  describe('constructor/setOnRequestHook/runRequestHook', () => {
    it.each([
      'no hook',
      'done',
      'double done',
      'late error',
      'throw',
      'throw undefined',
      'reject',
      'reject undefined',
      'done then reject',
      'resolved promise',
    ])('request completion %s', async mode => {
      const value = adapter();
      vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
      let pending: Promise<unknown> | undefined;
      let continueRequest: Function | undefined;
      if (mode !== 'no hook')
        value.setOnRequestHook((_req: any, _res: any, done: Function) => {
          if (mode === 'throw') throw new Error('hook');
          if (mode === 'throw undefined') throw undefined;
          if (mode.startsWith('reject') || mode === 'done then reject') {
            if (mode === 'done then reject') done();
            pending = Promise.reject(
              mode === 'reject undefined'
                ? undefined
                : new Error('rejected hook'),
            );
            return pending;
          }
          if (mode === 'resolved promise') {
            continueRequest = done;
            pending = Promise.resolve();
            return pending;
          }
          done();
          if (mode === 'double done') done();
          if (mode === 'late error') done(new Error('late hook error'));
        });
      const entry = value.getInstance().router.stack[0].handle;
      const response = new EventEmitter();
      entry({}, response, () => undefined);
      await pending?.catch(() => undefined);
      continueRequest?.();
    });
  });

  describe('setOnResponseHook and finish listener', () => {
    it.each([false, true])('response hook rejects %s', async reject => {
      const value = adapter();
      vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
      value.setOnResponseHook(async () => {
        if (reject) throw new Error('response hook');
      });
      const res = new EventEmitter();
      value.getInstance().router.stack[0].handle({}, res, () => undefined);
      for (const listener of res.listeners('finish')) await listener();
    });
  });
});

describe('ExpressAdapter response helpers', () => {
  describe('reply/isJsonContentType', () => {
    it.each([
      { body: undefined, code: 204 },
      { body: null },
      { body: false },
      { body: 0 },
      { body: 'value' },
      { body: {} },
      { body: new Error('internal'), code: 400 },
      { body: new Error('internal'), code: 499 },
      { body: new Error('ordinary'), code: 200 },
      { body: { statusCode: 400 }, contentType: 'text/plain' },
      { body: { message: 'bad' }, code: 404, contentType: 'text/plain' },
      { body: { message: 'ok' }, code: 200, contentType: 'text/plain' },
      { body: { message: 'ok' }, contentType: 'text/plain' },
      { body: 'bad', code: 400, contentType: 'text/plain' },
      {
        body: { statusCode: 400 },
        contentType: 'application/json; charset=utf8',
      },
      { body: { statusCode: 400 }, contentType: 'application/problem+json' },
      { body: { statusCode: 400 }, contentType: ['text/plain'] },
    ])('reply %j', async ({ body, code, contentType }: any) => {
      vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      const res = new TestResponse({ 'Content-Type': contentType });
      adapter().reply(res, body, code);
      await finished(res);
    });
  });

  describe('reply StreamableFile and applyStreamHeaders', () => {
    it.each([
      'normal',
      'HEAD',
      'HEAD ended',
      'HEAD empty',
      'HEAD response error',
      'source error',
      'already errored',
      'disconnect',
      'response error',
    ])('stream %s', async mode => {
      const source =
        mode === 'source error'
          ? new Readable({
              read() {
                this.destroy(new Error('source failed'));
              },
            })
          : mode === 'disconnect'
            ? new PassThrough()
            : Readable.from(mode === 'HEAD empty' ? [] : ['value']);
      const body = new StreamableFile(source, {
        type: 'text/plain',
        disposition: 'attachment',
        length: 5,
      })
        .setErrorHandler((_error, response: any) => response.end())
        .setErrorLogger(() => undefined);
      if (mode === 'already errored') {
        source.destroy(new Error('failed before reply'));
        await new Promise(resolve => source.once('close', resolve));
      }
      if (mode === 'HEAD ended') {
        source.resume();
        await finished(source);
      }
      const res = new TestResponse(
        {},
        mode.startsWith('HEAD') ? 'HEAD' : 'GET',
      );
      adapter().reply(res, body);
      if (mode === 'response error' || mode === 'HEAD response error')
        res.destroy(new Error('response failed'));
      if (mode === 'disconnect') res.destroy();
      await finished(res).catch(() => undefined);
      source.destroy();
    });
    it('preserves response headers and Transfer-Encoding with undefined/array header values', async () => {
      const value = adapter();
      const res = new TestResponse({
        'Content-Type': 'existing',
        'Transfer-Encoding': 'chunked',
      });
      value.setHeaderIfNotExists(res, 'X-Array', ['one', 'two']);
      value.setHeaderIfNotExists(res, 'X-Missing', undefined);
      value.reply(res, new StreamableFile(Buffer.from('value')));
      await finished(res);
    });
  });

  describe('status/end/render/redirect/headers', () => {
    it('delegates all response helpers', async () => {
      const value = adapter();
      const res = new TestResponse();
      value.status(res, 202);
      value.render(res, 'fixture', {});
      value.redirect(res, 302, '/next');
      value.setHeader(res, 'X-Fixture', 'value');
      value.appendHeader(res, 'X-Fixture', 'second');
      value.getHeader(res, 'X-Fixture');
      value.isHeadersSent(res);
      value.end(res, 'done');
      await finished(res);
    });
  });
});

describe('ExpressAdapter routes and application configuration', () => {
  describe('setErrorHandler/setNotFoundHandler/normalizePrefix', () => {
    it.each([undefined, '', '/', 'api', '/api/'])('prefix %s', async prefix => {
      const value = adapter();
      value.get('/error', (_req: any, _res: any, next: Function) =>
        next(new Error('fixture')),
      );
      value.setErrorHandler(
        (_error: any, _req: any, res: any, _next: Function) =>
          res.status(500).end(),
        prefix,
      );
      value.setNotFoundHandler(
        (_req: any, res: any) => res.status(404).end(),
        prefix,
        [{ path: '/excluded', method: RequestMethod.GET }],
      );
      for (const url of ['/error', '/api/missing', '/missing', '/excluded']) {
        await request(value.getInstance()).get(url);
      }
    });
    it('lets a root not-found handler skip other registered prefixes', async () => {
      const value = adapter();
      value.setNotFoundHandler((_req: any, res: any) => res.status(404).end());
      value.setNotFoundHandler(
        (_req: any, res: any) => res.status(404).end(),
        '/api',
      );
      for (const url of ['/api', '/api/path?x=1', '/apiary'])
        await request(value.getInstance()).get(url);
    });
  });

  describe('normalizePath/createMiddlewareFactory', () => {
    it('propagates a non-TypeError from the route converter', async () => {
      vi.spyOn(LegacyRouteConverter, 'tryConvert').mockImplementation(() => {
        throw new Error('converter unavailable');
      });
      await errorPath(() => adapter().normalizePath('/fixture'));
    });
    it.each(['/', '/users/:id', '/legacy/*', '/bad['])(
      'normalizes %s',
      async path => {
        vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
        vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
        await errorPath(() => adapter().normalizePath(path));
      },
    );
    it.each([
      { strict: false, method: RequestMethod.GET, path: '/users' },
      { strict: true, method: RequestMethod.GET, path: '/users/' },
      { strict: true, method: RequestMethod.GET, path: '/' },
      { strict: true, method: 999, path: '/users$' },
      { strict: false, method: 999, path: '/users' },
    ])('registers middleware %j', ({ strict, method, path }) => {
      const instance = express();
      instance.set('strict routing', strict);
      const value = adapter(instance);
      value.createMiddlewareFactory(method)(
        path,
        (_req: any, _res: any, next: Function) => next(),
      );
    });
    it.each([new TypeError('external router'), new Error('external router')])(
      'forwards middleware registration error %s',
      async error => {
        const instance: any = {
          use: vi.fn(),
          router: undefined,
          get() {
            throw error;
          },
        };
        const value = adapter(instance);
        vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
        await errorPath(() =>
          value.createMiddlewareFactory(RequestMethod.GET)(
            '/path',
            () => undefined,
          ),
        );
      },
    );
  });

  describe('set/enable/disable/engine/static/views/request/local/cors helpers', () => {
    it('delegates Express configuration methods', async () => {
      const value = adapter();
      value.set('fixture', 'value');
      value.enable('fixture');
      value.disable('fixture');
      value.engine(
        'fixture',
        (_path: string, _options: any, callback: Function) =>
          callback(null, 'rendered'),
      );
      value.setBaseViewsDir(['views']);
      value.setViewEngine('fixture');
      value.setLocal('fixture', true);
      value.useStaticAssets(process.cwd(), undefined);
      value.useStaticAssets(process.cwd(), { prefix: '/static' });
      value.getRequestHostname({ hostname: 'fixture.test' });
      value.getRequestMethod({ method: 'GET' });
      value.getRequestUrl({ originalUrl: '/path' });
      value.getType();
      value.isRouteOrderSensitive();
      value.enableCors({ origin: true });
      value.get('/cors', (_req: any, res: any) => res.send('value'));
      await request(value.getInstance())
        .get('/cors')
        .set('Origin', 'https://fixture.test');
    });
  });

  describe('getRouteMatchingOptions/isMiddlewareApplied', () => {
    it.each([
      undefined,
      {},
      { stack: {} },
      {
        stack: [
          undefined,
          {},
          { handle: {} },
          { handle: function wanted() {} },
        ],
      },
    ])('custom router %j', router => {
      const value = adapter({ use: vi.fn(), router });
      value.getRouteMatchingOptions();
      value.isMiddlewareApplied('wanted');
    });
  });
});

describe('ExpressAdapter HTTP server and body parsers', () => {
  describe('initHttpServer/listen/beforeClose/close/connections', () => {
    it.each([
      undefined,
      {},
      { httpsOptions: {} },
      { return503OnClosing: true },
      { forceCloseConnections: true },
    ])('server options %j', async options => {
      const value = adapter();
      value.initHttpServer(options);
      vi.spyOn(value.getHttpServer(), 'listen').mockImplementation(
        (...args: any[]) => {
          args
            .filter(arg => typeof arg === 'function')
            .forEach(callback => callback());
          return value.getHttpServer();
        },
      );
      value.listen(0, () => undefined);
      value.listen(0, 'localhost', () => undefined);
      if (options?.return503OnClosing) {
        value.get('/available', (_req: any, res: any) => res.end());
        await request(value.getInstance()).get('/available');
        value.beforeClose();
        await request(value.getInstance()).get('/available');
      }
      if (options?.forceCloseConnections) {
        const socket = new Socket();
        value.getHttpServer().emit('connection', socket);
        socket.destroy();
        const pending = new Socket();
        value.getHttpServer().emit('connection', pending);
      }
    });
    it('closes an adapter without a server', () => {
      adapter().close();
    });
  });

  describe('registerParserMiddleware/useBodyParser', () => {
    it.each([false, true])(
      'registers parsers idempotently with raw body %s',
      async rawBody => {
        const value = adapter();
        value.registerParserMiddleware('/api', rawBody);
        value.registerParserMiddleware('/api', rawBody);
        value.post('/body', (req: any, res: any) =>
          res.json({ body: req.body, raw: req.rawBody?.toString() }),
        );
        await request(value.getInstance())
          .post('/body')
          .send({ fixture: true });
        await request(value.getInstance())
          .post('/body')
          .type('form')
          .send({ fixture: 'value' });
      },
    );
    it.each(['json', 'urlencoded', 'text', 'raw'] as const)(
      'explicit parser %s',
      async type => {
        const value = adapter();
        value.useBodyParser(
          type,
          true,
          type === 'urlencoded' ? { extended: true } : {},
        );
        value.post('/body', (req: any, res: any) => res.end());
        const types = {
          json: 'application/json',
          urlencoded: 'application/x-www-form-urlencoded',
          text: 'text/plain',
          raw: 'application/octet-stream',
        };
        await request(value.getInstance())
          .post('/body')
          .set('Content-Type', types[type])
          .send(type === 'json' ? '{}' : 'fixture=value');
      },
    );
  });
});

describe('ExpressAdapter.applyVersionFilter', () => {
  const handler = () => undefined;
  const next = () => undefined;
  describe('neutral and URI versions', () => {
    it.each([VERSION_NEUTRAL, '1'])('version %s', version => {
      const value = adapter();
      value.applyVersionFilter(handler, version, { type: VersioningType.URI })(
        {},
        {},
        next,
      );
    });
  });
  describe('custom extractor', () => {
    it.each([
      { version: ['1'], extracted: ['1'] },
      { version: ['1'], extracted: ['2'] },
      { version: ['1'], extracted: '1' },
      { version: ['1'], extracted: '2' },
      { version: '1', extracted: ['1'] },
      { version: '1', extracted: ['2'] },
      { version: '1', extracted: '1' },
      { version: '1', extracted: '2' },
      { version: '1', extracted: undefined },
      { version: [], extracted: [] },
      { version: Symbol('invalid version'), extracted: '1' },
    ])('version/extractor %j', ({ version, extracted }) => {
      adapter().applyVersionFilter(handler, version, {
        type: VersioningType.CUSTOM,
        extractor: () => extracted,
      })({}, {}, next);
    });
    it('reports a mismatch when there is no next handler', async () => {
      const filter = adapter().applyVersionFilter(handler, '1', {
        type: VersioningType.CUSTOM,
        extractor: () => '2',
      });
      await errorPath(() => filter({}, {}, undefined));
    });
  });
  for (const type of [VersioningType.HEADER, VersioningType.MEDIA_TYPE]) {
    describe(`header-based versioning type ${type}`, () => {
      it.each([
        { version: '1', header: undefined },
        { version: ['1'], header: undefined },
        { version: [VERSION_NEUTRAL], header: undefined },
        { version: '1', header: '1' },
        { version: '1', header: '2' },
        { version: ['1'], header: '1' },
        { version: ['1'], header: '2' },
        { version: Symbol('invalid version'), header: '1' },
      ])('version/header %j', ({ version, header }) => {
        const options: any = { type, header: 'X-Version', key: 'v=' };
        const name = type === VersioningType.HEADER ? 'X-Version' : 'Accept';
        const value =
          type === VersioningType.HEADER
            ? header
            : header === undefined
              ? undefined
              : `application/json;v=${header}`;
        const filter = adapter().applyVersionFilter(handler, version, options);
        filter({}, {}, next);
        filter({ headers: { [name]: value } }, {}, next);
        filter({ headers: { [name.toLowerCase()]: value } }, {}, next);
      });
    });
  }
  it('rejects an unsupported versioning type', async () => {
    await errorPath(() =>
      adapter().applyVersionFilter(handler, '1', { type: 999 }),
    );
  });
});

describe('ExpressAdapter.mapException/isHttpError', () => {
  it.each([
    undefined,
    null,
    {},
    new Error('plain'),
    new SyntaxError('bad JSON'),
    new URIError('bad URI'),
    { expose: true, statusCode: 400, status: 400 },
    Object.assign(new Error('missing expose'), {
      statusCode: 400,
      status: 400,
    }),
    Object.assign(new Error('bad status type'), {
      expose: true,
      statusCode: '400',
      status: '400',
    }),
    Object.assign(new Error('mismatched status'), {
      expose: true,
      statusCode: 400,
      status: 401,
    }),
    ...[true, false].flatMap(expose =>
      [400, 499, 500].map(statusCode =>
        Object.assign(new Error('http error'), {
          expose,
          statusCode,
          status: statusCode,
        }),
      ),
    ),
  ])('maps error %s', error => {
    adapter().mapException(error);
  });
});
