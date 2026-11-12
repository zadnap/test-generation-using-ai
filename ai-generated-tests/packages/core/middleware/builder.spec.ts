/**
 * CFT checklist extracted from packages/core/middleware/builder.ts.
 * D counts atomic short-circuit decisions and loop/case guards. P = D + 1.
 * && evaluates the next condition only after T. || evaluates it only after F.
 * Each condition needs feasible T/F outcomes. Test inputs below exercise these paths.
 * This static checklist is separate from measured V8 branch coverage.
 * Optional chaining, nullish fallback and exceptional edges remain visible in the HTML report.
 * MiddlewareBuilder.constructor @L23 - D=0, P=1.
 * MiddlewareBuilder.apply @L29 - D=0, P=1.
 * MiddlewareBuilder.build @L39 - D=0, P=1.
 * MiddlewareBuilder.getHttpAdapter @L43 - D=0, P=1.
 * MiddlewareBuilder.constructor @L50 - D=0, P=1.
 * MiddlewareBuilder.getExcludedRoutes @L56 - D=0, P=1.
 * MiddlewareBuilder.exclude @L60 - D=0, P=1.
 * MiddlewareBuilder.callback @L65 - D=0, P=1.
 * MiddlewareBuilder.forRoutes @L77 - D=0, P=1.
 * MiddlewareBuilder.getRoutesFlatList @L99 - D=0, P=1.
 * MiddlewareBuilder.callback @L105 - D=0, P=1.
 * MiddlewareBuilder.addCoveredExcludedRoutes @L115 - D=3, P=4.
 *   1=next iteration of routes
 *   2=next iteration of this.routeInfoPathExtractor.extractExcludedRoutesCoveredBy( route, )
 *   3=!isListed
 * MiddlewareBuilder.callback @L122 - D=3, P=4.
 *   1c1=item.path === excludedRoute.path | 1c2=item.method === excludedRoute.method | 1c3=item.version === excludedRoute.version
 * MiddlewareBuilder.removeOverlappedRoutes @L142 - D=0, P=1.
 * MiddlewareBuilder.callback @L144 - D=0, P=1.
 * MiddlewareBuilder.callback @L145 - D=0, P=1.
 * MiddlewareBuilder.callback @L150 - D=1, P=2.
 *   1=!mountPaths.every(isStaticPath)
 * MiddlewareBuilder.isOverlapped @L155 - D=4, P=5.
 *   1c1=route.method === item.method | 1c2=isRequestMethodAll(item.method) | 1c3=(route.method as number) !== -1 | 1c4=mountPaths.every(path => item.regexes.some(regex => regex.test(path)), )
 * MiddlewareBuilder.callback @L170 - D=0, P=1.
 * MiddlewareBuilder.callback @L171 - D=0, P=1.
 * MiddlewareBuilder.compileMountPaths @L177 - D=0, P=1.
 * MiddlewareBuilder.callback @L180 - D=0, P=1.
 */
import { describe, it } from 'vitest';
import { RequestMethod, VersioningType } from '@nestjs/common';
import { MiddlewareBuilder } from '../../../../packages/core/middleware/builder.js';
import { RoutesMapper } from '../../../../packages/core/middleware/routes-mapper.js';
import { RouteInfoPathExtractor } from '../../../../packages/core/middleware/route-info-path-extractor.js';
import { NestContainer } from '../../../../packages/core/injector/container.js';
import { ApplicationConfig } from '../../../../packages/core/application-config.js';
import { mapToExcludeRoute } from '../../../../packages/core/middleware/utils.js';
describe('MiddlewareBuilder/ConfigProxy', () => {
  it('apply/build/exclude/forRoutes overlap and coverage of prefix exclusions', () => {
    const config = new ApplicationConfig();
    config.setGlobalPrefix('api');
    config.setGlobalPrefixOptions({ exclude: mapToExcludeRoute(['users/me']) });
    config.enableVersioning({ type: VersioningType.URI });
    const builder = new MiddlewareBuilder(
      new RoutesMapper(new NestContainer(), config),
      {} as any,
      new RouteInfoPathExtractor(config),
    );
    const proxy: any = builder.apply([
      (_req: any, _res: any, next: Function) => next(),
    ]);
    proxy.getExcludedRoutes();
    proxy
      .exclude('users/me')
      .exclude({ path: 'skip', method: RequestMethod.GET });
    proxy.forRoutes(
      'users/:id',
      'users/me',
      { path: 'users/me', method: RequestMethod.GET },
      { path: 'users/me', method: RequestMethod.POST },
      'other',
      { path: 'bad[/:id', method: RequestMethod.GET },
    );
    builder.getHttpAdapter();
    builder.build();
  });
});
