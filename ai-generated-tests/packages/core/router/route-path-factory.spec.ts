/**
 * CFT checklist extracted from packages/core/router/route-path-factory.ts.
 * D counts atomic short-circuit decisions and loop/case guards. P = D + 1.
 * && evaluates the next condition only after T. || evaluates it only after F.
 * Each condition needs feasible T/F outcomes. Test inputs below exercise these paths.
 * This static checklist is separate from measured V8 branch coverage.
 * Optional chaining, nullish fallback and exceptional edges remain visible in the HTML report.
 * RoutePathFactory.constructor @L30 - D=0, P=1.
 * RoutePathFactory.create @L32 - D=5, P=6.
 *   1c1=versionOrVersions | 1c2=metadata.versioningOptions?.type === VersioningType.URI
 *   2=Array.isArray(versionOrVersions)
 *   3=versionOrVersions !== VERSION_NEUTRAL
 *   4=metadata.globalPrefix
 * RoutePathFactory.callback @L47 - D=0, P=1.
 * RoutePathFactory.callback @L48 - D=1, P=2.
 *   1=version === VERSION_NEUTRAL
 * RoutePathFactory.callback @L60 - D=0, P=1.
 * RoutePathFactory.callback @L71 - D=3, P=4.
 *   1=this.isExcludedFromGlobalPrefix( path, requestMethod, versionOrVersions, metadata.versioningOptions, )
 *   2c1=metadata.globalPrefix | 2c2=''
 * RoutePathFactory.callback @L93 - D=2, P=3.
 *   1c1=path | 1c2='/'
 * RoutePathFactory.callback @L94 - D=1, P=2.
 *   1=path !== '/'
 * RoutePathFactory.getVersion @L97 - D=2, P=3.
 *   1c1=metadata.methodVersion | 1c2=metadata.controllerVersion
 * RoutePathFactory.getVersionPrefix @L103 - D=3, P=4.
 *   1=versioningOptions.type === VersioningType.URI
 *   2=versioningOptions.prefix === false
 *   3=versioningOptions.prefix !== undefined
 * RoutePathFactory.appendToAllIfDefined @L115 - D=2, P=3.
 *   1=!fragmentToAppend
 *   2=Array.isArray(fragmentToAppend)
 * RoutePathFactory.concatPaths @L122 - D=0, P=1.
 * RoutePathFactory.callback @L126 - D=0, P=1.
 * RoutePathFactory.callback @L127 - D=0, P=1.
 * RoutePathFactory.callback @L131 - D=0, P=1.
 * RoutePathFactory.isExcludedFromGlobalPrefix @L134 - D=3, P=4.
 *   1=isUndefined(requestMethod)
 *   2c1=Array.isArray(excludedRoutes) | 2c2=isRouteExcluded( excludedRoutes, path.slice(versionPrefix.length), requestMethod, )
 * RoutePathFactory.getExcludedRoutePaths @L169 - D=0, P=1.
 * RoutePathFactory.callback @L172 - D=0, P=1.
 * RoutePathFactory.callback @L176 - D=1, P=2.
 *   1=versionPrefix
 * RoutePathFactory.trackExcludedRoute @L185 - D=2, P=3.
 *   1c1=!versioningOptions | 1c2=this.applicationConfig.getVersioning()
 * RoutePathFactory.callback @L207 - D=0, P=1.
 * RoutePathFactory.callback @L208 - D=0, P=1.
 * RoutePathFactory.getUriVersionPrefixOfPath @L216 - D=8, P=9.
 *   1c1=!versionOrVersions | 1c2=versionOrVersions === VERSION_NEUTRAL | 1c3=versioningOptions?.type !== VersioningType.URI
 *   2=Array.isArray(versionOrVersions)
 *   3=next iteration of versions
 *   4=typeof version !== 'string'
 *   5c1=path === prefix | 5c2=path.startsWith(`${prefix}/`)
 */
import { describe, it } from 'vitest';
import { RequestMethod, VERSION_NEUTRAL, VersioningType } from '@nestjs/common';
import { ApplicationConfig } from '../../../../packages/core/application-config.js';
import { RoutePathFactory } from '../../../../packages/core/router/route-path-factory.js';

describe('RoutePathFactory', () => {
  describe('create/getVersion/getVersionPrefix/appendToAllIfDefined', () => {
    it.each([
      {},
      { methodPath: '/' },
      { methodPath: 'hello', ctrlPath: 'users', modulePath: 'module' },
      {
        methodPath: ['one', 'two'],
        ctrlPath: ['a', 'b'],
        globalPrefix: '/api/',
      },
      { methodVersion: '1', versioningOptions: { type: VersioningType.URI } },
      {
        controllerVersion: '1',
        versioningOptions: { type: VersioningType.URI, prefix: false },
      },
      {
        methodVersion: VERSION_NEUTRAL,
        versioningOptions: { type: VersioningType.URI },
      },
      {
        methodVersion: [VERSION_NEUTRAL, '1', '2'],
        versioningOptions: { type: VersioningType.URI, prefix: 'version-' },
      },
      {
        methodVersion: '1',
        versioningOptions: { type: VersioningType.HEADER, header: 'version' },
      },
    ])('metadata %j', metadata => {
      const factory = new RoutePathFactory(new ApplicationConfig());
      factory.create(metadata as any, RequestMethod.GET);
      factory.getVersion(metadata as any);
    });
    it('non-URI default version prefix and empty append', () => {
      const factory = new RoutePathFactory(new ApplicationConfig());
      factory.getVersionPrefix({
        type: VersioningType.HEADER,
        header: 'version',
      });
      factory.appendToAllIfDefined(['/'], undefined);
    });
  });
  describe('isExcludedFromGlobalPrefix/trackExcludedRoute/getUriVersionPrefixOfPath/getExcludedRoutePaths', () => {
    it('absent exclusions and undefined method', () => {
      const factory = new RoutePathFactory(new ApplicationConfig());
      factory.isExcludedFromGlobalPrefix('/hello');
      factory.isExcludedFromGlobalPrefix('/hello', RequestMethod.GET);
      factory.getExcludedRoutePaths();
    });
    it('versioned/unversioned exclusions, repeat tracking and logging-only calls', () => {
      const config = new ApplicationConfig();
      config.setGlobalPrefixOptions({
        exclude: [
          {
            path: 'hello',
            requestMethod: RequestMethod.GET,
            pathRegex: /^\/hello\/?$/,
          },
          {
            path: 'unmatched',
            requestMethod: RequestMethod.GET,
            pathRegex: /^\/unmatched$/,
          },
        ],
      });
      const factory: any = new RoutePathFactory(config);
      const uri = { type: VersioningType.URI };
      const metadata = {
        methodPath: 'hello',
        globalPrefix: 'api',
        methodVersion: [VERSION_NEUTRAL, '1'],
        versioningOptions: uri,
      };
      factory.create(metadata, RequestMethod.GET);
      factory.create(metadata, RequestMethod.GET);
      factory.getExcludedRoutePaths();
      for (const version of [
        undefined,
        VERSION_NEUTRAL,
        '1',
        ['1', VERSION_NEUTRAL],
        ['2', '1'],
      ]) {
        factory.getUriVersionPrefixOfPath('/v1', version, uri);
        factory.getUriVersionPrefixOfPath('/v1/hello', version, uri);
        factory.getUriVersionPrefixOfPath('/other', version, uri);
      }
      factory.getUriVersionPrefixOfPath('/hello', '1', undefined);
      config.enableVersioning(uri as any);
      factory.create(
        { methodPath: 'hello', globalPrefix: 'api' },
        RequestMethod.GET,
      );
    });
  });
});
