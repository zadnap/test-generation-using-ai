/**
 * CFT checklist extracted from packages/core/middleware/routes-mapper.ts.
 * D counts atomic short-circuit decisions and loop/case guards. P = D + 1.
 * && evaluates the next condition only after T. || evaluates it only after F.
 * Each condition needs feasible T/F outcomes. Test inputs below exercise these paths.
 * This static checklist is separate from measured V8 branch coverage.
 * Optional chaining, nullish fallback and exceptional edges remain visible in the HTML report.
 * RoutesMapper.constructor @L22 - D=0, P=1.
 * RoutesMapper.mapRouteToRouteInfo @L29 - D=2, P=3.
 *   1=isString(controllerOrRoute)
 *   2=this.isRouteInfo(routePathOrPaths, controllerOrRoute)
 * RoutesMapper.getRouteInfoFromPath @L46 - D=0, P=1.
 * RoutesMapper.getRouteInfoFromObject @L56 - D=1, P=2.
 *   1=routeInfoObject.version
 * RoutesMapper.getRouteInfoFromController @L68 - D=0, P=1.
 * RoutesMapper.concatPaths @L80 - D=0, P=1.
 * RoutesMapper.toRouteInfo @L83 - D=0, P=1.
 * RoutesMapper.callback @L88 - D=4, P=5.
 *   1c1=version | 1c2=versioningConfig
 *   2c1=typeof version !== 'string' | 2c2=Array.isArray(version)
 * RoutesMapper.callback @L103 - D=0, P=1.
 * RoutesMapper.callback @L116 - D=0, P=1.
 * RoutesMapper.callback @L117 - D=0, P=1.
 * RoutesMapper.callback @L119 - D=0, P=1.
 * RoutesMapper.isRouteInfo @L126 - D=0, P=1.
 * RoutesMapper.normalizeGlobalPath @L133 - D=1, P=2.
 *   1=prefix === '/'
 * RoutesMapper.getRoutePath @L138 - D=0, P=1.
 * RoutesMapper.getModulePathsOfController @L146 - D=1, P=2.
 *   1=modulePaths.length > 0
 * RoutesMapper.callback @L148 - D=0, P=1.
 * RoutesMapper.getHostModulesOfController @L153 - D=1, P=2.
 *   1=!metatype
 * RoutesMapper.callback @L158 - D=0, P=1.
 * RoutesMapper.getModulePath @L163 - D=1, P=2.
 *   1=!metatype
 * RoutesMapper.getVersionMetadata @L177 - D=1, P=2.
 *   1=versioningConfig
 */
import { describe, it } from 'vitest';
import {
  Controller,
  Get,
  Version,
  VersioningType,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import { MODULE_PATH } from '@nestjs/common/internal';
import { RoutesMapper } from '../../../../packages/core/middleware/routes-mapper.js';
import { NestContainer } from '../../../../packages/core/injector/container.js';
import { ApplicationConfig } from '../../../../packages/core/application-config.js';
describe('RoutesMapper', () => {
  describe('mapRouteToRouteInfo and path/object/controller/version/module helpers', () => {
    it.each([false, true])('versioning %s', async enabled => {
      @Controller(['', 'users'])
      class Fixture {
        @Get(['', 'child']) @Version(['1', VERSION_NEUTRAL]) handle() {}
        @Get('plain') plain() {}
      }
      const config = new ApplicationConfig();
      if (enabled)
        config.enableVersioning({
          type: VersioningType.URI,
          defaultVersion: '2',
        });
      const container = new NestContainer();
      const mapper: any = new RoutesMapper(container, config);
      mapper.mapRouteToRouteInfo('path');
      mapper.mapRouteToRouteInfo({ path: 'path', method: 0, version: '1' });
      mapper.mapRouteToRouteInfo({ path: 'path', method: 0 });
      mapper.mapRouteToRouteInfo(Fixture);
      const first = (await container.addModule(class Root {}, []))!.moduleRef;
      first.addController(Fixture);
      Reflect.defineMetadata(MODULE_PATH, 'module', first.metatype);
      mapper.mapRouteToRouteInfo(Fixture);
      mapper.getHostModulesOfController(undefined);
      mapper.getModulePath(undefined);
      Reflect.defineMetadata(
        MODULE_PATH + container.getModules().applicationId,
        'scoped',
        first.metatype,
      );
      mapper.mapRouteToRouteInfo(Fixture);
    });
  });
});
