/**
 * CFT checklist extracted from packages/core/middleware/utils.ts.
 * D counts atomic short-circuit decisions and loop/case guards. P = D + 1.
 * && evaluates the next condition only after T. || evaluates it only after F.
 * Each condition needs feasible T/F outcomes. Test inputs below exercise these paths.
 * This static checklist is separate from measured V8 branch coverage.
 * Optional chaining, nullish fallback and exceptional edges remain visible in the HTML report.
 * mapToExcludeRoute @L29 - D=0, P=1.
 * callback @L33 - D=4, P=5.
 *   1=isString(route)
 *   2=isString(route)
 *   3=route.version
 *   4=e instanceof TypeError
 * compileExcludedPath @L64 - D=4, P=5.
 *   1=!matchingOptions
 *   2=path.length > 1
 *   3c1=addLeadingSlash(routePath) | 3c2='/'
 * isStaticPath @L94 - D=0, P=1.
 * filterMiddleware @L98 - D=0, P=1.
 * callback @L115 - D=0, P=1.
 * mapToClass @L127 - D=2, P=3.
 *   1=isMiddlewareClass(middleware)
 *   2=excludedRoutes.length <= 0
 * use @L139 - D=1, P=2.
 *   1=isExcluded
 * callback @L158 - D=1, P=2.
 *   1=isExcluded
 * isMiddlewareClass @L176 - D=4, P=5.
 *   1=middlewareStr.substring(0, 5) === 'class'
 *   2c1=middlewareArr[0] === 'function' | 2c2=/[A-Z]/.test(middlewareArr[1]?.[0]) | 2c3=isFunction(middleware.prototype?.use)
 * assignToken @L189 - D=0, P=1.
 * isMiddlewareRouteExcluded @L194 - D=9, P=10.
 *   1=excludedRoutes.length <= 0
 *   2c1=!originalUrl?.startsWith('/') | 2c2=originalUrl.includes('#')
 *   3=queryParamsIndex >= 0
 *   4c1=ignoreTrailingSlash | 4c2=pathname.length > 1 | 4c3=pathname.endsWith('/')
 *   5c1=isExcluded(pathname) | 5c2=isExcluded(pathname.replace(/\/+$/, ''))
 * isRequestForRoute @L221 - D=3, P=4.
 *   1c1=isRouteExcluded([route], path, RequestMethod[reqMethod]) | 1c2=reqMethod === RequestMethod[RequestMethod.HEAD] | 1c3=isRouteExcluded([route], path, RequestMethod.GET)
 * isExcluded @L229 - D=0, P=1.
 * callback @L231 - D=2, P=3.
 *   1c1=isRequestForRoute(route, path) | 1c2=isVersionRequested(route)
 * createRequestedVersionMatcher @L257 - D=0, P=1.
 * callback @L262 - D=8, P=9.
 *   1c1=!version | 1c2=version === VERSION_NEUTRAL | 1c3=!versioningOptions | 1c4=versioningOptions.type === VersioningType.URI
 *   2=requestedVersions === undefined
 *   3=!requestedVersions
 *   4=Array.isArray(version)
 *   5=requestedVersions.length > 0
 * callback @L279 - D=0, P=1.
 * getRequestedVersions @L288 - D=8, P=9.
 *   1=case VersioningType.HEADER
 *   2c1=headers[versioningOptions.header] | 2c2=headers[versioningOptions.header.toLowerCase()]
 *   3=case VersioningType.MEDIA_TYPE
 *   4c1=headers['Accept'] | 4c2=headers['accept']
 *   5=case VersioningType.CUSTOM
 *   6=isUndefined(version)
 * splitOutsideQuotes @L322 - D=6, P=7.
 *   1=index < len
 *   2c1=isQuoted | 2c2=character === '\\'
 *   3=character === '"'
 *   4c1=character === separator | 4c2=!isQuoted
 * getMediaTypeVersion @L357 - D=5, P=6.
 *   1=next iteration of mediaRanges
 *   2=next iteration of parameters
 *   3=trimmedParameter.startsWith(key)
 *   4c1=version.startsWith('"') | 4c2=version.endsWith('"')
 * callback @L363 - D=0, P=1.
 */
import { afterEach, describe, it, vi } from 'vitest';
import {
  Logger,
  RequestMethod,
  VersioningType,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import {
  mapToExcludeRoute,
  isStaticPath,
  isMiddlewareClass,
  assignToken,
  mapToClass,
  filterMiddleware,
  isMiddlewareRouteExcluded,
  createRequestedVersionMatcher,
} from '../../../../packages/core/middleware/utils.js';
afterEach(() => vi.restoreAllMocks());
const adapter: any = {
  getRequestMethod: (req: any) => req.method,
  getRequestUrl: (req: any) => req.url,
};
describe('middleware utilities', () => {
  describe('mapToExcludeRoute/compileExcludedPath/isStaticPath', () => {
    it.each([undefined, { caseSensitive: true, ignoreTrailingSlash: false }])(
      'matching options %j',
      options => {
        mapToExcludeRoute(
          ['/', { path: 'users/', method: 0, version: '1' }],
          options,
        );
        isStaticPath('/users');
        isStaticPath('/:id');
      },
    );
    it('invalid exclusion', () => {
      vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
      try {
        mapToExcludeRoute(['bad[']);
      } catch (error) {
        if (!(error instanceof TypeError)) throw error;
      }
    });
  });
  describe('isMiddlewareClass/assignToken/mapToClass/filterMiddleware', () => {
    it('ES class, old-style uppercase function, lower-case function and arrow', () => {
      class Middleware {
        use(_req: any, _res: any, next: Function) {
          next();
        }
      }
      function Legacy() {}
      Legacy.prototype.use = () => undefined;
      function Uppercase() {}
      function lower() {}
      const arrow = (_req: any, _res: any, next: Function) => next();
      for (const middleware of [Middleware, Legacy, Uppercase, lower, arrow])
        isMiddlewareClass(middleware);
      assignToken(class Fixture {});
      const routes = mapToExcludeRoute(['/excluded']);
      for (const middleware of [Middleware, arrow]) {
        const Wrapped: any = mapToClass(middleware, routes, adapter);
        new Wrapped().use(
          { method: 'GET', url: '/excluded' },
          {},
          () => undefined,
        );
        new Wrapped().use(
          { method: 'GET', url: '/other' },
          {},
          () => undefined,
        );
        mapToClass(middleware, [], adapter);
      }
      filterMiddleware([null, arrow, Middleware] as any, [], adapter);
      filterMiddleware([arrow], [], {
        ...adapter,
        getRouteMatchingOptions: () => ({
          caseSensitive: false,
          ignoreTrailingSlash: true,
        }),
      });
    });
  });
  describe('isMiddlewareRouteExcluded', () => {
    it.each([
      ['GET', '/excluded'],
      ['HEAD', '/excluded'],
      ['POST', '/excluded'],
      ['GET', '/other'],
      ['GET', '/excluded?x=1'],
      ['GET', '/excluded/'],
      ['GET', '/other/'],
      ['GET', '/'],
      ['GET', undefined],
      ['GET', 'http://host/excluded'],
      ['GET', '/excluded#part'],
    ])('method %s URL %s', (method, url) => {
      const routes = mapToExcludeRoute(
        [{ path: '/excluded', method: RequestMethod.GET }],
        { caseSensitive: true, ignoreTrailingSlash: true },
      );
      isMiddlewareRouteExcluded({ method, url }, [], adapter);
      isMiddlewareRouteExcluded({ method, url }, routes, adapter, true);
    });
  });
  describe('createRequestedVersionMatcher/getRequestedVersions/getMediaTypeVersion/splitOutsideQuotes', () => {
    it.each([
      { options: undefined, request: {} },
      { options: { type: VersioningType.URI }, request: {} },
      {
        options: { type: VersioningType.HEADER, header: 'X-Version' },
        request: { headers: { 'X-Version': '1' } },
      },
      {
        options: { type: VersioningType.HEADER, header: 'X-Version' },
        request: { headers: { 'x-version': '2' } },
      },
      {
        options: { type: VersioningType.HEADER, header: 'X-Version' },
        request: {},
      },
      {
        options: { type: VersioningType.CUSTOM, extractor: () => ['1', '2'] },
        request: {},
      },
      {
        options: {
          type: VersioningType.CUSTOM,
          extractor: () => {
            throw new Error('fixture');
          },
        },
        request: {},
      },
      ...[
        undefined,
        '',
        'a;x=1',
        'a;v=1',
        'a;v="1"',
        'a;x="semi;comma,escaped\\\"";v="1\\x"',
        'a;v="open',
        'a;v=x"',
        'a;x=\\;v=1',
        ['a', 'b;v=2'],
      ].map(accept => ({
        options: { type: VersioningType.MEDIA_TYPE, key: 'v=' },
        request: { headers: { accept } },
      })),
      {
        options: { type: VersioningType.MEDIA_TYPE, key: 'v=' },
        request: { headers: { Accept: 'a;v=1' } },
      },
    ])('versioning %j', ({ options, request }) => {
      const match = createRequestedVersionMatcher(request, options as any);
      for (const version of [
        undefined,
        VERSION_NEUTRAL,
        '1',
        ['1', '2'],
        [VERSION_NEUTRAL],
      ])
        match({ version } as any);
    });
  });
});
