/**
 * CFT checklist extracted from packages/core/middleware/route-info-path-extractor.ts.
 * D counts atomic short-circuit decisions and loop/case guards. P = D + 1.
 * && evaluates the next condition only after T. || evaluates it only after F.
 * Each condition needs feasible T/F outcomes. Test inputs below exercise these paths.
 * This static checklist is separate from measured V8 branch coverage.
 * Optional chaining, nullish fallback and exceptional edges remain visible in the HTML report.
 * RouteInfoPathExtractor.constructor @L26 - D=0, P=1.
 * RouteInfoPathExtractor.extractPathsFrom @L36 - D=5, P=6.
 *   1=this.isAWildcard(path)
 *   2=versionPaths.includes('')
 *   3=wildcardVersionPaths.length > 0
 *   4=this.prefixPath
 *   5=!Array.isArray(this.excludedGlobalPrefixRoutes)
 * RouteInfoPathExtractor.callback @L52 - D=0, P=1.
 * RouteInfoPathExtractor.callback @L69 - D=0, P=1.
 * RouteInfoPathExtractor.callback @L70 - D=0, P=1.
 * RouteInfoPathExtractor.callback @L71 - D=0, P=1.
 * RouteInfoPathExtractor.extractExcludedRoutesCoveredBy @L94 - D=3, P=4.
 *   1c1=!Array.isArray(this.excludedGlobalPrefixRoutes) | 1c2=this.isAWildcard(path) | 1c3=isRouteExcluded(this.excludedGlobalPrefixRoutes, path, method)
 * RouteInfoPathExtractor.callback @L115 - D=7, P=8.
 *   1=isRequestMethodAll(excludedRoute.requestMethod)
 *   2=!(isRequestMethodAll(method) || method === excludedMethod)
 *   3c1=isStaticPath(excludedPath) | 3c2=routeRegex.test(excludedPath)
 *   4=this.isExcludedWithTrailingSlash(excludedRoute, path)
 *   5=!coveredPath
 *   6=version
 * RouteInfoPathExtractor.extractExclusionsFrom @L153 - D=0, P=1.
 * RouteInfoPathExtractor.callback @L160 - D=0, P=1.
 * RouteInfoPathExtractor.callback @L161 - D=0, P=1.
 * RouteInfoPathExtractor.getVersionPathsOfExcludedRoutes @L175 - D=2, P=3.
 *   1=wildcardVersionPaths.length > 0
 *   2=this.versioningConfig?.type !== VersioningType.URI
 * RouteInfoPathExtractor.getPathsOfExcludedRoute @L196 - D=1, P=2.
 *   1=this.isExcludedWithTrailingSlash(route, parentPath)
 * RouteInfoPathExtractor.isExcludedWithTrailingSlash @L211 - D=3, P=4.
 *   1c1=pathWithoutSlash !== '' | 1c2=pathRegex.test(pathWithoutSlash + '/') | 1c3=!pathRegex.test(pathWithoutSlash)
 * RouteInfoPathExtractor.getVersioningOptions @L223 - D=0, P=1.
 * RouteInfoPathExtractor.extractPathFrom @L227 - D=2, P=3.
 *   1c1=this.isAWildcard(route.path) | 1c2=!route.version
 * RouteInfoPathExtractor.isAWildcard @L235 - D=1, P=2.
 *   1=isSimpleWildcard.includes(path)
 * RouteInfoPathExtractor.extractNonWildcardPathsFrom @L245 - D=4, P=5.
 *   1c1=Array.isArray(this.excludedGlobalPrefixRoutes) | 1c2=isRouteExcluded(this.excludedGlobalPrefixRoutes, path, method)
 *   2=!versionPaths.length
 *   3=!versionPaths.length
 * RouteInfoPathExtractor.callback @L261 - D=0, P=1.
 * RouteInfoPathExtractor.callback @L269 - D=0, P=1.
 * RouteInfoPathExtractor.getVersionOfUnversionedRoutes @L279 - D=3, P=4.
 *   1=this.versioningConfig?.type !== VersioningType.URI
 *   2=!defaultVersion
 *   3=Array.isArray(defaultVersion)
 * RouteInfoPathExtractor.callback @L291 - D=0, P=1.
 * RouteInfoPathExtractor.extractVersionPathFrom @L298 - D=3, P=4.
 *   1c1=!versionValue | 1c2=this.versioningConfig?.type !== VersioningType.URI
 *   2=Array.isArray(versionValue)
 * RouteInfoPathExtractor.toVersionPath @L305 - D=1, P=2.
 *   1=version === VERSION_NEUTRAL
 */
import { describe, it } from 'vitest';
import { RequestMethod, VERSION_NEUTRAL, VersioningType } from '@nestjs/common';
import { RouteInfoPathExtractor } from '../../../../packages/core/middleware/route-info-path-extractor.js';
import { ApplicationConfig } from '../../../../packages/core/application-config.js';
import { mapToExcludeRoute } from '../../../../packages/core/middleware/utils.js';
describe('RouteInfoPathExtractor', () => {
  describe('path/version/exclusion expansion through public entry points', () => {
    it.each([
      { prefix: '', exclusions: undefined, versioning: undefined },
      {
        prefix: 'api',
        exclusions: ['users/me', 'reports/{*path}'],
        versioning: undefined,
      },
      {
        prefix: 'api',
        exclusions: ['users/me', 'reports/{*path}'],
        versioning: { type: VersioningType.URI },
      },
      {
        prefix: 'api',
        exclusions: ['users/me'],
        versioning: { type: VersioningType.URI, defaultVersion: '1' },
      },
      {
        prefix: 'api',
        exclusions: ['users/me'],
        versioning: {
          type: VersioningType.URI,
          defaultVersion: ['1', VERSION_NEUTRAL],
        },
      },
      {
        prefix: 'api',
        exclusions: ['users/me'],
        versioning: { type: VersioningType.HEADER, header: 'version' },
      },
    ])('configuration %j', ({ prefix, exclusions, versioning }) => {
      const config = new ApplicationConfig();
      config.setGlobalPrefix(prefix);
      if (exclusions)
        config.setGlobalPrefixOptions({
          exclude: mapToExcludeRoute([
            ...exclusions,
            { path: 'other', method: RequestMethod.POST },
          ]),
        });
      if (versioning) config.enableVersioning(versioning as any);
      const extractor = new RouteInfoPathExtractor(config);
      extractor.getVersioningOptions();
      for (const path of [
        '*',
        '/*path',
        '/{*path}',
        '/users/:id',
        '/users/me',
        '/reports',
        '/other',
        '/bad[',
      ])
        for (const version of [
          undefined,
          '1',
          VERSION_NEUTRAL,
          ['1', VERSION_NEUTRAL],
        ]) {
          const route = { path, method: RequestMethod.GET, version };
          extractor.extractPathsFrom(route as any);
          extractor.extractPathFrom(route as any);
          extractor.extractExclusionsFrom(route as any);
        }
    });
  });
});
