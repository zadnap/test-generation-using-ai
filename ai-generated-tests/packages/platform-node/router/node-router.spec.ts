import { describe, expect, it, vi } from 'vitest';
import {
  createUriTooLongError,
  NodeRouter,
  PARAM_TOO_LONG_KEY,
} from '../../../../packages/platform-node/router/node-router.js';
import { NodeRequest } from '../../../../packages/platform-node/adapters/node-request.js';

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
