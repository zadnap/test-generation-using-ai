import { describe, expect, it, vi } from 'vitest';
import {
  createUriTooLongError,
  NodeRouter,
  PARAM_TOO_LONG_KEY,
} from '../../../../packages/platform-node/router/node-router.js';
import {
  NodeRequest,
  NodeResponse,
} from '../../../../packages/platform-node/adapters/node-request.js';

const makeReq = (url = '/', method = 'GET') => ({
  url,
  method,
  headers: {},
  socket: { remoteAddress: '127.0.0.1' },
});
const makeRes = () => ({}) as any;

function setup(options: any = {}) {
  const finalHandler = vi.fn();
  const router = new NodeRouter(finalHandler, options);
  return { router, finalHandler };
}

// CFG (C3) of NodeRouter:
//   constructor: maxParamLength undefined / invalid number / invalid type
//   handle: req is NodeRequest T/F; res is NodeResponse T/F
//   dispatch: malformed url T/F; table layer T/F; route found T/F;
//             PARAM_TOO_LONG T/F; error handler T/F; method filter T/F;
//             mount T/F; done present T/F
//   use: paths present T/F; array paths T/F; empty array T/F; root T/F;
//        non-function T/F
describe('NodeRouter', () => {
  describe('constructor', () => {
    it('should reject an invalid maxParamLength', () => {
      expect(() => new NodeRouter(vi.fn(), { maxParamLength: 0 })).toThrow(TypeError);
      expect(() => new NodeRouter(vi.fn(), { maxParamLength: NaN })).toThrow(
        TypeError,
      );
      expect(() =>
        new new NodeRouter(vi.fn(), { maxParamLength: '1' as any }),
      ).toThrow(TypeError);
    });
  });

  it('should expose createUriTooLongError', () => {
    const error = createUriTooLongError();
    expect(error.status).toBe(414);
    expect(error.message).toBe('Route parameter too long');
  });

  describe('routes', () => {
    it('should dispatch a matching route with params', () => {
      const { router, finalHandler } = setup();
      const handler = vi.fn();
      router.get('/users/:id', handler);
      const req = makeReq('/users/7');
      router.handle(req as any, makeRes());
      expect(handler).toHaveBeenCalledTimes(1);
      expect(req.params).toEqual({ id: '7' });
      expect((req as any).route.methods).toEqual({ get: true });
      expect(finalHandler).not.toHaveBeenCalled();
    });

    it('should register every method helper', () => {
      const { router } = setup();
      const methods: Record<string, string> = {
        post: 'POST',
        put: 'PUT',
        delete: 'DELETE',
        patch: 'PATCH',
        options: 'OPTIONS',
        head: 'HEAD',
        search: 'SEARCH',
        propfind: 'PROPFIND',
        proppatch: 'PROPPATCH',
        mkcol: 'MKCOL',
        copy: 'COPY',
        move: 'MOVE',
        lock: 'LOCK',
        unlock: 'UNLOCK',
      };
      for (const [method, httpMethod] of Object.entries(methods)) {
        const handler = vi.fn();
        (router as any)[method](`/${method}`, handler);
        router.handle(makeReq(`/${method}`, httpMethod) as any, makeRes());
        expect(handler).toHaveBeenCalledTimes(1);
      }
    });

    it('should register a route for every method with all()', () => {
      const { router } = setup();
      const handler = vi.fn();
      router.all('/any', handler);
      router.handle(makeReq('/any', 'DELETE') as any, makeRes());
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should default the path to /', () => {
      const { router } = setup();
      const handler = vi.fn();
      router.get(handler as any);
      router.handle(makeReq('/') as any, makeRes());
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should run handlers in order through next()', () => {
      const { router } = setup();
      const calls: string[] = [];
      router.get(
        '/x',
        (_req: any, _res: any, next: any) => {
          calls.push('first');
          next();
        },
        () => calls.push('second'),
      );
      router.handle(makeReq('/x') as any, makeRes());
      expect(calls).toEqual(['first', 'second']);
    });

    it('should pass an error to the error handler', () => {
      const { router } = setup();
      const error = new Error('boom');
      const errorHandler = vi.fn((_err, _req, _res, next) => next());
      router.get('/x', (_req: any, _res: any, next: any) => next(error));
      router.use(errorHandler);
      router.handle(makeReq('/x') as any, makeRes());
      expect(errorHandler).toHaveBeenCalledWith(
        error,
        expect.anything(),
        expect.anything(),
        expect.any(Function),
      );
    });
  });

  describe('middleware', () => {
    it('should run middleware for every path', () => {
      const { router } = setup();
      const handler = vi.fn((_req, _res, next) => next());
      router.use(handler);
      router.handle(makeReq('/anything') as any, makeRes());
      expect(handler).toHaveBeenCalled();
    });

    it('should mount middleware and restore the URL', () => {
      const { router } = setup();
      let seen: any;
      router.use('/api', (req: any, _res: any, next: any) => {
        seen = { url: req.url, baseUrl: req.baseUrl };
        next();
      });
      router.get('/api/users', () => {});
      router.handle(makeReq('/api/users?x=1') as any, makeRes());
      expect(seen).toEqual({ url: '/users?x=1', baseUrl: '/api' });
    });

    it('should mount an array of paths', () => {
      const { router } = setup();
      const handler = vi.fn((_req, _res, next) => next());
      router.use(['/a', '/b'], handler);
      router.handle(makeReq('/b/x') as any, makeRes());
      expect(handler).toHaveBeenCalled();
    });

    it('should reject a non-function middleware', () => {
      const { router } = setup();
      expect(() => router.use('/x', 'nope' as any)).toThrow(TypeError);
    });

    it('should match useExact only for the whole path and method', () => {
      const { router } = setup();
      const handler = vi.fn((_req, _res, next) => next());
      router.useExact('GET', '/exact', handler);
      router.handle(makeReq('/exact') as any, makeRes());
      router.handle(makeReq('/exact/more') as any, makeRes());
      router.handle(makeReq('/exact', 'POST') as any, makeRes());
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should report a registered middleware by name', () => {
      const { router } = setup();
      function namedMiddleware(_req: any, _res: any, next: any) {
        next();
      }
      router.use(namedMiddleware);
      expect(router.hasMiddleware('namedMiddleware')).toBe(true);
      expect(router.hasMiddleware('other')).toBe(false);
    });
  });

  describe('additional dispatch, mount and promise branches', () => {
    it('should reuse the original URL, base URL and params', () => {
      const { router } = setup();
      const handler = vi.fn();
      router.get('/x', handler);
      const req: any = makeReq('/x');
      req.originalUrl = '/old';
      req.baseUrl = '/base';
      req.params = { id: '1' };
      router.handle(req as any, makeRes());
      expect(handler).toHaveBeenCalled();
      expect([req.originalUrl, req.baseUrl]).toEqual(['/old', '/base']);
    });

    it('should accept a real NodeRequest and NodeResponse', () => {
      const { router } = setup();
      const handler = vi.fn();
      router.get('/x', handler);
      const req = makeReq('/x');
      Object.setPrototypeOf(req, NodeRequest.prototype);
      const res = Object.create(NodeResponse.prototype);
      router.handle(req as any, res);
      expect(handler).toHaveBeenCalled();
    });

    it('should mount a nested array of paths', () => {
      const { router } = setup();
      const handler = vi.fn((_req, _res, next) => next());
      router.use([['/a', '/b']], handler);
      router.handle(makeReq('/b/x') as any, makeRes());
      expect(handler).toHaveBeenCalled();
    });

    it('should decode a parameter in a mount path', () => {
      const { router } = setup();
      let seen: any;
      router.use('/u/:id', (req: any, _res: any, next: any) => {
        seen = req.params;
        next();
      });
      router.handle(makeReq('/u/a%20b/x') as any, makeRes());
      expect(seen).toEqual({ id: 'a b' });
    });

    it('should add a slash after mounting the whole URL', () => {
      const { router } = setup();
      let seen: any;
      router.use('/foo', (req: any, _res: any, next: any) => {
        seen = req.url;
        next();
      });
      router.handle(makeReq('/foo') as any, makeRes());
      expect(seen).toBe('/');
    });

    it('should strip a trailing slash from a mount path', () => {
      const { router } = setup();
      let seen: any;
      router.use('/foo/', (req: any, _res: any, next: any) => {
        seen = { url: req.url, baseUrl: req.baseUrl };
        next();
      });
      router.handle(makeReq('/foo/bar') as any, makeRes());
      expect(seen).toEqual({ url: '/bar', baseUrl: '/foo' });
    });

    it('should let HEAD use a GET exact middleware', () => {
      const { router } = setup();
      const handler = vi.fn((_req, _res, next) => next());
      router.useExact('GET', '/exact', handler);
      router.handle(makeReq('/exact', 'HEAD') as any, makeRes());
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should skip middleware layers sharing a prefix', () => {
      const { router } = setup();
      router.useExact('GET', '/api/users/one', (_req, _res, next) => next());
      router.useExact('GET', '/api/users/two', (_req, _res, next) => next());
      const other = vi.fn((_req, _res, next) => next());
      router.useExact('GET', '/other', other);
      router.handle(makeReq('/other') as any, makeRes());
      expect(other).toHaveBeenCalled();
    });

    it('should forward a rejected promise', async () => {
      const { router } = setup();
      const errorHandler = vi.fn((_err, _req, _res, next) => next());
      router.get('/x', async () => {
        throw new Error('async');
      });
      router.use(errorHandler);
      router.handle(makeReq('/x') as any, makeRes());
      await Promise.resolve();
      await Promise.resolve();
      expect(errorHandler).toHaveBeenCalledWith(
        expect.any(Error),
        expect.anything(),
        expect.anything(),
        expect.any(Function),
      );
    });

    it('should create an error for a rejected promise without a reason', async () => {
      const { router } = setup();
      const errorHandler = vi.fn((_err, _req, _res, next) => next());
      router.get('/x', () => Promise.reject());
      router.use(errorHandler);
      router.handle(makeReq('/x') as any, makeRes());
      await Promise.resolve();
      await Promise.resolve();
      expect(errorHandler).toHaveBeenCalledWith(
        expect.any(Error),
        expect.anything(),
        expect.anything(),
        expect.any(Function),
      );
    });

    it('should create an error for a thrown falsy value', () => {
      const { router } = setup();
      const errorHandler = vi.fn((_err, _req, _res, next) => next());
      router.get('/x', () => {
        throw 0;
      });
      router.use(errorHandler);
      router.handle(makeReq('/x') as any, makeRes());
      expect(errorHandler).toHaveBeenCalledWith(
        expect.any(Error),
        expect.anything(),
        expect.anything(),
        expect.any(Function),
      );
    });

    it('should stop route handlers when next receives an error', () => {
      const { router } = setup();
      const second = vi.fn();
      const errorHandler = vi.fn((_err, _req, _res, next) => next());
      router.get(
        '/x',
        (_req: any, _res: any, next: any) => next(new Error('boom')),
        second,
      );
      router.use(errorHandler);
      router.handle(makeReq('/x') as any, makeRes());
      expect(second).not.toHaveBeenCalled();
      expect(errorHandler).toHaveBeenCalled();
    });

    it('should use distinct parameter names per handler', () => {
      const { router } = setup();
      const seen: any[] = [];
      router.get('/u/:id', (req: any, _res: any, next: any) => {
        seen.push(req.params);
        next();
      });
      router.get('/u/:name', (req: any, _res: any, next: any) => {
        seen.push(req.params);
        next();
      });
      router.handle(makeReq('/u/7') as any, makeRes());
      expect(seen).toEqual([{ id: '7' }, { name: '7' }]);
    });

    it('should fall through to another route after the handlers pass', () => {
      const { router } = setup();
      const seen: any[] = [];
      router.get('/u/:id', (_req: any, _res: any, next: any) => next());
      router.get('/u/:value', (req: any) => seen.push(req.params));
      router.handle(makeReq('/u/7') as any, makeRes());
      expect(seen).toEqual([{ value: '7' }]);
    });

    it('should decode a percent sign that is left after decoding', () => {
      const { router, finalHandler } = setup();
      let seen: any;
      router.use('/u/:id', (req: any, _res: any, next: any) => {
        seen = req.params;
        next();
      });
      router.handle(makeReq('/u/%25x') as any, makeRes());
      expect(seen).toEqual({ id: '%x' });
      expect(finalHandler).toHaveBeenCalledWith(
        undefined,
        expect.anything(),
        expect.anything(),
      );
    });

    it('should fall through to a different route shape', () => {
      const { router } = setup();
      const seen: any[] = [];
      router.get('/u/:id', (_req: any, _res: any, next: any) => next());
      router.get('/u/*rest', (req: any) => seen.push(req.params));
      router.handle(makeReq('/u/7') as any, makeRes());
      expect(seen).toEqual([{ rest: ['7'] }]);
    });

    it('should not report a malformed target twice', () => {
      const { router } = setup();
      const rejected = vi.fn();
      const errorHandler = vi.fn((_err, _req, _res, next) => next());
      router.onRejectedTarget = rejected;
      router.use((req: any, _res: any, next: any) => {
        req.url = '/bad#/';
        next(new Error('boom'));
      });
      router.use(errorHandler);
      router.handle(makeReq('/x') as any, makeRes());
      expect(rejected).not.toHaveBeenCalled();
      expect(errorHandler).toHaveBeenCalled();
    });

    it('should skip route tables while handling an error', () => {
      const { router } = setup();
      const errorHandler = vi.fn((_err, _req, _res, next) => next());
      router.get('/x', (_req: any, _res: any, next: any) =>
        next(new Error('boom')),
      );
      router.use((_req, _res, next) => next());
      router.get('/y', vi.fn());
      router.use(errorHandler);
      router.handle(makeReq('/x') as any, makeRes());
      expect(errorHandler).toHaveBeenCalled();
    });

    it('should skip nested middleware prefixes', () => {
      const { router } = setup();
      router.useExact('GET', '/api', (_req, _res, next) => next());
      router.useExact('GET', '/api/users', (_req, _res, next) => next());
      router.useExact('GET', '/api/users/one', (_req, _res, next) => next());
      const other = vi.fn((_req, _res, next) => next());
      router.useExact('GET', '/other', other);
      router.handle(makeReq('/other') as any, makeRes());
      expect(other).toHaveBeenCalled();
    });

    it('should strip a trailing slash from a parameterized mount', () => {
      const { router } = setup();
      let seen: any;
      router.use('/foo/:id/', (req: any, _res: any, next: any) => {
        seen = { url: req.url, baseUrl: req.baseUrl };
        next();
      });
      router.handle(makeReq('/foo/x/bar') as any, makeRes());
      expect(seen).toEqual({ url: '/bar', baseUrl: '/foo/x' });
    });

    it('should continue after a route table miss', () => {
      const { router, finalHandler } = setup();
      router.get('/missing', () => {});
      router.use((_req, _res, next) => next());
      router.handle(makeReq('/other') as any, makeRes());
      expect(finalHandler).toHaveBeenCalled();
    });
  });

  describe('failures', () => {
    it('should call done when nothing matches', () => {
      const { router } = setup();
      const done = vi.fn();
      router.handle(makeReq('/missing') as any, makeRes(), done);
      expect(done).toHaveBeenCalledWith(undefined);
    });

    it('should call the final handler when nothing matches', () => {
      const { router, finalHandler } = setup();
      router.handle(makeReq('/missing') as any, makeRes());
      expect(finalHandler).toHaveBeenCalledWith(
        undefined,
        expect.anything(),
        expect.anything(),
      );
    });

    it('should reject a malformed target', () => {
      const { router, finalHandler } = setup();
      const rejected = vi.fn();
      router.onRejectedTarget = rejected;
      router.use((_req: any, _res: any, next: any) => next());
      router.handle(makeReq('/api#/') as any, makeRes());
      expect(rejected).toHaveBeenCalled();
      expect(finalHandler).toHaveBeenCalledWith(
        expect.any(URIError),
        expect.anything(),
        expect.anything(),
      );
    });

    it('should answer a too long parameter with 414', () => {
      const { router, finalHandler } = setup({ maxParamLength: 1 });
      router.get('/users/:id', () => {});
      const req = makeReq('/users/22');
      router.handle(req as any, makeRes());
      expect((req as any)[PARAM_TOO_LONG_KEY]).toBe(true);
      expect(finalHandler.mock.calls[0][0].status).toBe(414);
    });

    it('should run handleError through the error middleware', () => {
      const { router } = setup();
      const errorHandler = vi.fn((_err, _req, _res, next) => next());
      router.use(errorHandler);
      const req = makeReq('/x');
      router.handleError(new Error('late'), req as any, makeRes());
      expect(errorHandler).toHaveBeenCalled();
    });

    it('should apply requestPrototype to a foreign request', () => {
      class CustomRequest extends NodeRequest {}
      const { router } = setup();
      router.requestPrototype = CustomRequest.prototype as any;
      const req = makeReq('/');
      router.handle(req as any, makeRes());
      expect(req).toBeInstanceOf(CustomRequest);
    });
  });
});
